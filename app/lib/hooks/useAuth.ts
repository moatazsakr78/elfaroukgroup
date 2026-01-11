'use client'

import { useSession } from 'next-auth/react'
import { type UserRole } from '../auth/roleBasedAccess'

export function useAuth() {
  const { data: session, status } = useSession()

  const userRole = session?.user?.role as UserRole | null

  // Helper functions
  const isAdmin = userRole === 'أدمن رئيسي'
  const isCustomer = userRole === 'عميل'
  const isWholesale = userRole === 'جملة'

  // Combined checks (isAdmin replaces isAdminOrEmployee since موظف is not a valid role)
  const isAdminOrEmployee = isAdmin
  const isCustomerOrWholesale = isCustomer || isWholesale

  // Check if user has specific role
  const hasRole = (role: UserRole) => userRole === role

  // Check if user has any of the specified roles
  const hasAnyRole = (roles: UserRole[]) => {
    if (!userRole) return false
    return roles.includes(userRole)
  }

  return {
    session,
    user: session?.user,
    userRole,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',

    // Role checks
    isAdmin,
    isCustomer,
    isWholesale,
    isAdminOrEmployee,
    isCustomerOrWholesale,

    // Helper functions
    hasRole,
    hasAnyRole,
  }
}
