'use client';

import { usePathname } from 'next/navigation';
import { usePageProtection } from '@/app/lib/hooks/useRoleAccess';
import { usePermissionsContext } from '@/lib/contexts/PermissionsContext';
import { PAGE_ACCESS_MAP } from '@/types/permissions';
import UnauthorizedAccess from '@/app/components/auth/UnauthorizedAccess';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { userRole, hasAccess, isLoading } = usePageProtection();
  const { hasPermission, loading: permissionsLoading } = usePermissionsContext();

  // Show loading state while checking permissions
  if (isLoading || permissionsLoading) {
    return (
      <div className="h-screen bg-[#2B3544] flex items-center justify-center">
        <div className="text-white text-xl">جاري التحميل...</div>
      </div>
    );
  }

  // Check if user has admin access (أدمن رئيسي only)
  const hasAdminAccess = userRole === 'أدمن رئيسي';

  // Show unauthorized page if user is authenticated but doesn't have access
  if (userRole && !hasAdminAccess) {
    return (
      <UnauthorizedAccess
        userRole={userRole}
        message="هذه الصفحة للمشرفين فقط، غير مصرح لك بالدخول"
      />
    );
  }

  // Check page-specific access (page_access.* permissions)
  const pageAccessCode = PAGE_ACCESS_MAP[pathname];
  if (pageAccessCode && !hasPermission(pageAccessCode)) {
    return (
      <UnauthorizedAccess
        userRole={userRole}
        message="ليس لديك صلاحية الوصول لهذه الصفحة"
      />
    );
  }

  // Render children
  return <>{children}</>;
}