import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"
import { CLIENT_CONFIG } from "@/client.config"
import { cookies, headers } from "next/headers"

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: CLIENT_CONFIG.schema
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
)

// Helper to get brand_id from request headers (set by middleware)
function getBrandIdFromHeaders(): string | null {
  try {
    const headersList = headers()
    return headersList.get('x-brand-id') || null
  } catch {
    return null
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Google OAuth (FREE!)
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),

    // Email/Password
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Get brand_id from request headers (set by middleware)
          const brandId = getBrandIdFromHeaders()

          // Use Supabase client to query auth_users table for authentication
          let authQuery = supabase
            .from('auth_users')
            .select('id, email, name, image, password_hash, brand_id')
            .eq('email', credentials.email)

          // Filter by brand if available (allows same email on different brands)
          if (brandId) {
            authQuery = authQuery.eq('brand_id', brandId)
          }

          const { data: authUsers, error: authError } = await authQuery.limit(1)

          if (authError) {
            console.error('❌ Supabase query error:', authError)
            return null
          }

          if (!authUsers || authUsers.length === 0) {
            console.log('❌ User not found:', credentials.email)
            return null
          }

          const authUser = authUsers[0]

          // Check if user signed up with Google (no password hash)
          if (!authUser || !authUser.password_hash) {
            console.log('❌ User registered with Google, needs to use Google sign-in:', credentials.email)
            // Throw error with special code for Google users
            throw new Error('GOOGLE_USER')
          }

          // Verify password
          const passwordValid = await bcrypt.compare(
            credentials.password as string,
            authUser.password_hash
          )

          if (!passwordValid) {
            console.log('❌ Invalid password for:', credentials.email)
            return null
          }

          // Fetch role and permission_id from user_profiles table
          const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('role, permission_id')
            .eq('id', authUser.id)
            .limit(1)

          const userRole = profiles && profiles.length > 0 ? profiles[0].role : 'عميل'
          const permissionId = profiles && profiles.length > 0 ? profiles[0].permission_id : null

          // Fetch page restrictions for employees
          let pageRestrictions: string[] = []
          if (userRole === 'موظف' && permissionId) {
            const { data: restrictions } = await supabase
              .from('permission_template_restrictions')
              .select('permission_code')
              .eq('template_id', permissionId)
              .like('permission_code', 'page_access.%')

            pageRestrictions = restrictions?.map(r => r.permission_code) || []
          }

          console.log('✅ Login successful for:', credentials.email, 'with role:', userRole, 'restrictions:', pageRestrictions.length)

          // Return user object
          return {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            image: authUser.image,
            role: userRole,
            pageRestrictions,
            brandId: (authUser as any).brand_id || brandId || null
          }
        } catch (error) {
          console.error('❌ Auth error during login:', error)
          console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })
          return null
        }
      }
    })
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign-in
      if (account?.provider === "google") {
        try {
          const brandId = getBrandIdFromHeaders()

          // Check if user exists using Supabase (scoped by brand)
          let existingQuery = supabase
            .from('auth_users')
            .select('id')
            .eq('email', user.email!)

          if (brandId) {
            existingQuery = existingQuery.eq('brand_id', brandId)
          }

          const { data: existingUsers, error: queryError } = await existingQuery.limit(1)

          if (queryError) {
            console.error('❌ Error checking existing user:', queryError)
            return false
          }

          // If user doesn't exist, create one
          if (!existingUsers || existingUsers.length === 0) {
            // Create auth_users entry (with brand_id)
            const insertData: any = {
              email: user.email!,
              name: user.name || user.email!.split('@')[0],
              image: user.image || null,
              password_hash: '' // No password for OAuth users
            }
            if (brandId) {
              insertData.brand_id = brandId
            }

            const { data: newUser, error: insertError } = await supabase
              .from('auth_users')
              .insert(insertData)
              .select('id')
              .single()

            if (insertError) {
              console.error('❌ Error creating auth user:', insertError)
              return false
            }

            // Create user_profiles entry with default role
            if (newUser) {
              const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                  id: newUser.id,
                  full_name: user.name || user.email!.split('@')[0],
                  role: 'عميل', // Default role for new users
                  avatar_url: user.image || null // Save Google profile image
                })

              if (profileError) {
                console.error('❌ Error creating user profile:', profileError)
                // Don't fail the whole sign-in if profile creation fails
              }

              // Also create a customer record with the Google profile image
              const { error: customerError } = await supabase
                .from('customers')
                .insert({
                  name: user.name || user.email!.split('@')[0],
                  email: user.email!,
                  user_id: newUser.id,
                  profile_image_url: user.image || null,
                  is_active: true
                })

              if (customerError) {
                console.error('❌ Error creating customer record:', customerError)
                // Don't fail if customer creation fails
              } else {
                console.log('✅ Created customer record with Google profile image')
              }
            }

            console.log('✅ Created new user via Google OAuth:', user.email)
          } else {
            // User exists - update their profile image and customer record if needed
            const existingUserId = existingUsers[0].id

            // Update auth_users image if it changed
            await supabase
              .from('auth_users')
              .update({ image: user.image })
              .eq('id', existingUserId)

            // Update user_profiles avatar_url
            await supabase
              .from('user_profiles')
              .update({ avatar_url: user.image })
              .eq('id', existingUserId)

            // Check if customer exists by email and update profile_image_url
            const { data: existingCustomer } = await supabase
              .from('customers')
              .select('id, user_id')
              .eq('email', user.email!)
              .limit(1)

            if (existingCustomer && existingCustomer.length > 0) {
              // Update existing customer with Google profile image and link user_id
              await supabase
                .from('customers')
                .update({
                  profile_image_url: user.image,
                  user_id: existingUserId
                })
                .eq('id', existingCustomer[0].id)

              console.log('✅ Updated customer profile image from Google:', user.email)
            } else {
              // Create new customer record
              await supabase
                .from('customers')
                .insert({
                  name: user.name || user.email!.split('@')[0],
                  email: user.email!,
                  user_id: existingUserId,
                  profile_image_url: user.image || null,
                  is_active: true
                })

              console.log('✅ Created new customer from Google OAuth:', user.email)
            }
          }

          return true
        } catch (error) {
          console.error('❌ Error handling Google sign-in:', error)
          console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          })
          return false
        }
      }

      return true
    },

    async jwt({ token, user, account }) {
      // Add custom fields to JWT
      if (user) {
        // Initial sign in - set userId and role
        // For Google users, fetch from database
        if (account?.provider === "google") {
          const brandId = getBrandIdFromHeaders()

          let authQuery = supabase
            .from('auth_users')
            .select('id, brand_id')
            .eq('email', user.email!)

          if (brandId) {
            authQuery = authQuery.eq('brand_id', brandId)
          }

          const { data: authUsers, error: authError } = await authQuery.limit(1)

          if (!authError && authUsers && authUsers.length > 0) {
            token.userId = authUsers[0].id
            token.brandId = (authUsers[0] as any).brand_id || brandId || null

            // Fetch role and permission_id from user_profiles
            const { data: profiles, error: profileError } = await supabase
              .from('user_profiles')
              .select('role, permission_id')
              .eq('id', authUsers[0].id)
              .limit(1)

            token.role = profiles && profiles.length > 0 ? profiles[0].role : 'عميل'
            const permissionId = profiles && profiles.length > 0 ? profiles[0].permission_id : null

            // Fetch page restrictions for employees
            if (token.role === 'موظف' && permissionId) {
              const { data: restrictions } = await supabase
                .from('permission_template_restrictions')
                .select('permission_code')
                .eq('template_id', permissionId)
                .like('permission_code', 'page_access.%')

              token.pageRestrictions = restrictions?.map(r => r.permission_code) || []
            } else {
              token.pageRestrictions = []
            }
          }
        } else {
          // Credentials sign-in
          token.userId = user.id
          token.role = user.role
          token.pageRestrictions = user.pageRestrictions || []
          token.brandId = (user as any).brandId || null
        }
      } else if (token.userId && !token.role) {
        // Subsequent requests - role is missing, fetch it again
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('role, permission_id')
          .eq('id', token.userId as string)
          .limit(1)

        if (!profileError && profiles && profiles.length > 0) {
          token.role = profiles[0].role
          const permissionId = profiles[0].permission_id

          // Fetch page restrictions for employees
          if (token.role === 'موظف' && permissionId) {
            const { data: restrictions } = await supabase
              .from('permission_template_restrictions')
              .select('permission_code')
              .eq('template_id', permissionId)
              .like('permission_code', 'page_access.%')

            token.pageRestrictions = restrictions?.map(r => r.permission_code) || []
          } else {
            token.pageRestrictions = []
          }
        } else {
          token.role = 'عميل' // Default fallback
          token.pageRestrictions = []
        }
      }

      return token
    },

    async session({ session, token }) {
      // Add custom fields to session
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
        session.user.pageRestrictions = token.pageRestrictions as string[] || []
        ;(session.user as any).brandId = token.brandId as string || null
      }
      return session
    }
  },

  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Use secure cookies on production
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  // Trust proxy for production (Vercel, etc.)
  trustHost: true,
})
