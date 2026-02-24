// Role-based access control utility
// الأدوار الأساسية الأربعة
export type UserRole = 'عميل' | 'جملة' | 'موظف' | 'أدمن رئيسي';

// Define allowed pages for each role
export const rolePermissions: Record<UserRole, string[]> = {
  'عميل': [
    // صفحات المتجر فقط - للعملاء
    '/', // الصفحة الرئيسية للمتجر
    '/store', // المتجر
    '/product', // تفاصيل المنتج (dynamic route)
    '/cart', // السلة
    '/my-orders', // طلباتي
    '/profile', // الملف الشخصي
    '/favorites', // المفضلة
    '/checkout', // إتمام الطلب
    '/social-media', // السوشيال ميديا
  ],
  'جملة': [
    // نفس صلاحيات العميل + أسعار الجملة
    '/',
    '/store',
    '/product',
    '/cart',
    '/my-orders',
    '/profile',
    '/favorites',
    '/checkout',
    '/social-media', // السوشيال ميديا
  ],
  'موظف': [
    // نفس صلاحيات أدمن رئيسي - صلاحيات كاملة
    // صفحات المتجر
    '/',
    '/store',
    '/product',
    '/social-media',

    // صفحات الإدارة
    '/customer-orders',
    '/admin/products',
    '/shipping',

    // صفحات النظام
    '/dashboard',
    '/pos',
    '/products',
    '/inventory',
    '/customers',
    '/suppliers',
    '/whatsapp',
    '/safes',
    '/reports',
    '/activity-logs',
    '/permissions',
    '/settings',
  ],
  'أدمن رئيسي': [
    // كل الصفحات - صلاحيات كاملة
    // صفحات المتجر
    '/',
    '/store',
    '/product',
    '/social-media', // السوشيال ميديا

    // صفحات الإدارة (مش my-orders - العميل فقط)
    '/customer-orders', // طلبات العملاء
    '/admin/products', // إدارة المتجر (يشمل /admin/products/social-media)
    '/shipping', // الشحن

    // صفحات النظام
    '/dashboard',
    '/pos',
    '/products', // إدارة المنتجات
    '/inventory',
    '/customers',
    '/suppliers',
    '/whatsapp', // محادثات واتساب
    '/safes',
    '/reports',
    '/activity-logs',
    '/permissions', // الصلاحيات (للأدمن الرئيسي فقط)
    '/settings',
  ]
};

// Check if user has access to a specific page
export const hasPageAccess = (userRole: UserRole | null, pagePath: string): boolean => {
  // No logging - keep console clean for production

  if (!userRole) {
    return false;
  }

  const allowedPages = rolePermissions[userRole];
  if (!allowedPages) {
    return false;
  }

  // Check exact match first
  if (allowedPages.includes(pagePath)) {
    return true;
  }

  // Check if it's a dynamic route or sub-path
  const hasSubPathAccess = allowedPages.some(allowedPath => {
    // Handle dynamic routes like /admin/products/[id]
    if (pagePath.startsWith(allowedPath + '/')) {
      return true;
    }

    return false;
  });

  return hasSubPathAccess;
};

// Get user role based on is_admin flag (for backwards compatibility)
export const getUserRoleFromProfile = (role: string | null, isAdmin: boolean): UserRole => {
  // If role is already set to one of our 4 main roles, use it
  if (role && ['عميل', 'جملة', 'موظف', 'أدمن رئيسي'].includes(role)) {
    return role as UserRole;
  }

  // Otherwise, determine from is_admin flag
  return isAdmin ? 'أدمن رئيسي' : 'عميل';
};

// Check if user is admin (أدمن رئيسي or موظف)
export const isAdminRole = (userRole: UserRole | null): boolean => {
  return userRole === 'أدمن رئيسي' || userRole === 'موظف';
};

// Check if user is customer (client or wholesale)
export const isCustomerRole = (userRole: UserRole | null): boolean => {
  return userRole === 'عميل' || userRole === 'جملة';
};

// Get redirect path for unauthorized users
export const getUnauthorizedRedirect = (userRole: UserRole | null): string => {
  if (isCustomerRole(userRole)) {
    return '/'; // Redirect customers to store homepage
  }
  return '/dashboard'; // Redirect admins to dashboard
};

// Error message for unauthorized access
export const getUnauthorizedMessage = (userRole: UserRole | null): string => {
  if (isCustomerRole(userRole)) {
    return 'هذه الصفحة للمشرفين فقط، غير مصرح لك بالدخول';
  }
  return 'ليس لديك صلاحية للوصول إلى هذه الصفحة';
};