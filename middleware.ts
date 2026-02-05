import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasPageAccess, rolePermissions, type UserRole } from '@/app/lib/auth/roleBasedAccess'
import { auth } from '@/lib/auth.config'
import { PAGE_ACCESS_MAP } from '@/types/permissions'
import { resolveBrandFromHostname } from '@/lib/brand/brand-resolver'

// Cookie name for storing last valid page
const LAST_PAGE_COOKIE = 'last_valid_page'

// ✅ تحسين: استخدام الـ session المخزن بدلاً من استعلام الـ database كل مرة
// الـ pageRestrictions مخزنة في الـ JWT token عند تسجيل الدخول
// هذا يوفر ~30K function invocation/شهر!

// Helper function to get page access code from pathname
function getPageAccessCode(pathname: string): string | null {
  // Direct match
  if (PAGE_ACCESS_MAP[pathname]) {
    return PAGE_ACCESS_MAP[pathname]
  }

  // Check for sub-paths (e.g., /products/123 -> /products)
  for (const [path, code] of Object.entries(PAGE_ACCESS_MAP)) {
    if (pathname.startsWith(path + '/')) {
      return code
    }
  }

  return null
}

// Paths that don't need any authentication or authorization
const alwaysPublicPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/error',
  '/auth/logout',
  '/api/auth', // NextAuth API routes
]

// Paths that require authentication and specific roles
const adminOnlyPaths = [
  '/dashboard',
  '/pos',
  '/inventory',
  '/customers',
  '/suppliers',
  '/safes',
  '/reports',
  '/permissions',
  '/admin',
  '/customer-orders',
  '/shipping',
  '/products', // النظام (مش المتجر)
  '/settings',
]

// Paths for customers only (admins should use customer-orders instead)
const customerOnlyPaths = [
  '/my-orders',
  '/cart',
  '/checkout',
]

export default auth(async (req) => {
  const { pathname } = req.nextUrl

  // Skip NextAuth internal routes, static files, and WhatsApp webhook
  if (pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/whatsapp') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/images') ||
      pathname.startsWith('/fonts')) {
    return NextResponse.next()
  }

  // --- Brand Resolution ---
  // Resolve brand from hostname and inject into request headers
  const hostname = req.headers.get('host') || 'localhost'
  let brand: Awaited<ReturnType<typeof resolveBrandFromHostname>> | null = null
  try {
    brand = await resolveBrandFromHostname(hostname)
  } catch (e) {
    console.error('Brand resolution error:', e)
  }

  // Helper to add brand headers to any response
  const addBrandHeaders = (response: NextResponse) => {
    if (brand) {
      response.headers.set('x-brand-id', brand.id)
      response.headers.set('x-brand-slug', brand.slug)
    }
    return response
  }

  // For store pages (non-admin, non-auth), rewrite to brand-specific routes
  const isAdminPath = adminOnlyPaths.some(path =>
    pathname === path || pathname.startsWith(path + '/')
  )
  const isCustomerPath = customerOnlyPaths.some(path =>
    pathname === path || pathname.startsWith(path + '/')
  )
  const isAuthPath = alwaysPublicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
  const isApiPath = pathname.startsWith('/api/')
  const isStoreBrandRoute = pathname.startsWith('/store/')

  // Rewrite homepage and store pages to brand-specific routes
  // Only if not already a /store/ route, not admin, not auth, not API, not customer-only
  if (brand && !isAdminPath && !isCustomerPath && !isAuthPath && !isApiPath && !isStoreBrandRoute) {
    // Rewrite store-facing pages to /store/[brandSlug] routes
    if (pathname === '/') {
      const url = req.nextUrl.clone()
      url.pathname = `/store/${brand.slug}`
      const response = NextResponse.rewrite(url)
      return addBrandHeaders(response)
    }
    if (pathname === '/catalog') {
      const url = req.nextUrl.clone()
      url.pathname = `/store/${brand.slug}/catalog`
      const response = NextResponse.rewrite(url)
      return addBrandHeaders(response)
    }
  }

  // Allow always-public paths (login, register, etc.)
  if (isAuthPath) {
    return addBrandHeaders(NextResponse.next())
  }

  // Get session from NextAuth
  const session = req.auth
  const userRole = session?.user?.role as UserRole | null

  // Block admin paths for non-authenticated users
  if (isAdminPath) {
    // Debug logging
    console.log('🔒 Middleware - Admin path access check:', {
      pathname,
      hasSession: !!session,
      userRole,
      userAgent: req.headers.get('user-agent')?.substring(0, 100)
    });

    // If no session, redirect to login
    if (!session) {
      console.log('❌ No session - redirecting to login');
      const loginUrl = new URL('/auth/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check if user has access based on role
    const hasAccess = hasPageAccess(userRole, pathname)

    console.log('🔍 Access check result:', {
      userRole,
      pathname,
      hasAccess
    });

    if (!hasAccess) {
      console.log('❌ Access denied - redirecting to home');
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Check granular page permissions for employees (from session - NO database query!)
    // ✅ تحسين: الـ pageRestrictions مخزنة في الـ JWT session عند تسجيل الدخول
    if (userRole === 'موظف' && session.user?.id) {
      const pageCode = getPageAccessCode(pathname)

      if (pageCode) {
        // ✅ استخدام الـ pageRestrictions من الـ session (مخزنة في JWT)
        // بدلاً من استعلام الـ database كل مرة
        const pageRestrictions = session.user.pageRestrictions || []

        console.log('🔍 Employee permission check (from session):', {
          userId: session.user.id,
          pathname,
          pageCode,
          restrictionsCount: pageRestrictions.length,
          isRestricted: pageRestrictions.includes(pageCode)
        });

        if (pageRestrictions.includes(pageCode)) {
          // Employee is restricted from this page - redirect to last valid page
          const lastPage = req.cookies.get(LAST_PAGE_COOKIE)?.value || '/dashboard'
          console.log('🚫 Employee restricted from page, redirecting to:', lastPage);
          return NextResponse.redirect(new URL(lastPage, req.url))
        }
      }
    }

    // Access granted - update last valid page cookie
    console.log('✅ Access granted');
    const response = NextResponse.next()
    addBrandHeaders(response)
    response.cookies.set(LAST_PAGE_COOKIE, pathname, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    return response
  }

  // Customer paths - just check for session
  if (isCustomerPath && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return addBrandHeaders(NextResponse.next())
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
