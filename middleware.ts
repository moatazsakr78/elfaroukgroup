import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasPageAccess, rolePermissions, type UserRole } from '@/app/lib/auth/roleBasedAccess'
import { auth } from '@/lib/auth.config'
import { PAGE_ACCESS_MAP } from '@/types/permissions'

// Cookie name for storing last valid page
const LAST_PAGE_COOKIE = 'last_valid_page'

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

  // Allow always-public paths (login, register, etc.)
  const isAuthPath = alwaysPublicPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
  if (isAuthPath) {
    return NextResponse.next()
  }

  // Get session from NextAuth
  const session = req.auth
  const userRole = session?.user?.role as UserRole | null

  // Check admin paths
  const isAdminPath = adminOnlyPaths.some(path =>
    pathname === path || pathname.startsWith(path + '/')
  )

  if (isAdminPath) {
    // If no session, redirect to login
    if (!session) {
      const loginUrl = new URL('/auth/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check if user has access based on role
    const hasAccess = hasPageAccess(userRole, pathname)

    if (!hasAccess) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Check granular page permissions for employees (from session - NO database query!)
    if (userRole === 'موظف' && session.user?.id) {
      const pageCode = getPageAccessCode(pathname)

      if (pageCode) {
        const pageRestrictions = session.user.pageRestrictions || []

        if (pageRestrictions.includes(pageCode)) {
          // Employee is restricted from this page - redirect to last valid page
          const lastPage = req.cookies.get(LAST_PAGE_COOKIE)?.value || '/dashboard'
          return NextResponse.redirect(new URL(lastPage, req.url))
        }
      }
    }

    // Access granted - update last valid page cookie
    const response = NextResponse.next()
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
  const isCustomerPath = customerOnlyPaths.some(path =>
    pathname === path || pathname.startsWith(path + '/')
  )
  if (isCustomerPath && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
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
