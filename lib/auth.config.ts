import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'elfaroukgroup' // Use elfaroukgroup schema for multi-tenant architecture
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
)

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
          // Use Supabase client to query auth_users table for authentication
          const { data: authUsers, error: authError } = await supabase
            .from('auth_users')
            .select('id, email, name, image, password_hash')
            .eq('email', credentials.email)
            .limit(1)

          if (authError) {
            console.error('❌ Supabase query error:', authError)
            return null
          }

          if (!authUsers || authUsers.length === 0) {
            console.log('❌ User not found:', credentials.email)
            return null
          }

          const authUser = authUsers[0]

          if (!authUser || !authUser.password_hash) {
            console.log('❌ User has no password hash')
            return null
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

          // Fetch role from user_profiles table
          const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', authUser.id)
            .limit(1)

          const userRole = profiles && profiles.length > 0 ? profiles[0].role : 'عميل'

          console.log('✅ Login successful for:', credentials.email, 'with role:', userRole)

          // Return user object
          return {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            image: authUser.image,
            role: userRole
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
          // Check if user exists using Supabase
          const { data: existingUsers, error: queryError } = await supabase
            .from('auth_users')
            .select('id')
            .eq('email', user.email!)
            .limit(1)

          if (queryError) {
            console.error('❌ Error checking existing user:', queryError)
            return false
          }

          // If user doesn't exist, create one
          if (!existingUsers || existingUsers.length === 0) {
            // Create auth_users entry
            const { data: newUser, error: insertError } = await supabase
              .from('auth_users')
              .insert({
                email: user.email!,
                name: user.name || user.email!.split('@')[0],
                image: user.image || null,
                password_hash: '' // No password for OAuth users
              })
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
                  role: 'عميل' // Default role for new users
                })

              if (profileError) {
                console.error('❌ Error creating user profile:', profileError)
                // Don't fail the whole sign-in if profile creation fails
              }
            }

            console.log('✅ Created new user via Google OAuth:', user.email)
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
          const { data: authUsers, error: authError } = await supabase
            .from('auth_users')
            .select('id')
            .eq('email', user.email!)
            .limit(1)

          if (!authError && authUsers && authUsers.length > 0) {
            token.userId = authUsers[0].id

            // Fetch role from user_profiles
            const { data: profiles, error: profileError } = await supabase
              .from('user_profiles')
              .select('role')
              .eq('id', authUsers[0].id)
              .limit(1)

            token.role = profiles && profiles.length > 0 ? profiles[0].role : 'عميل'
          }
        } else {
          // Credentials sign-in
          token.userId = user.id
          token.role = user.role
        }
      } else if (token.userId && !token.role) {
        // Subsequent requests - role is missing, fetch it again
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', token.userId as string)
          .limit(1)

        if (!profileError && profiles && profiles.length > 0) {
          token.role = profiles[0].role
        } else {
          token.role = 'عميل' // Default fallback
        }
      }

      return token
    },

    async session({ session, token }) {
      // Add custom fields to session
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
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
