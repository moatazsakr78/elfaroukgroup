'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissionsContext } from '@/lib/contexts/PermissionsContext';

/**
 * Hook لحماية الصفحات من الدخول المباشر بالـ URL
 * يتحقق من صلاحية الصفحة ويعيد التوجيه إذا لم تكن متاحة
 *
 * @param pageNameEn - اسم الصفحة بالإنجليزية (مثل: 'pos', 'products', 'customers')
 * @param redirectTo - المسار للتوجيه إليه إذا لم تكن الصفحة متاحة (افتراضي: '/dashboard')
 * @returns { loading, hasAccess } - حالة التحميل وصلاحية الوصول
 *
 * @example
 * // في صفحة POS
 * const { loading, hasAccess } = usePageAccessGuard('pos');
 *
 * if (loading) return <LoadingSpinner />;
 * if (!hasAccess) return null; // سيتم التوجيه تلقائياً
 *
 * return <POSContent />;
 */
export function usePageAccessGuard(
  pageNameEn: string,
  redirectTo: string = '/dashboard'
) {
  const router = useRouter();
  const { hasPermission, loading } = usePermissionsContext();

  const pageCode = `page_access.${pageNameEn}`;
  const hasAccess = hasPermission(pageCode);

  useEffect(() => {
    // لا نفعل شيء أثناء التحميل
    if (loading) return;

    // إذا لم يكن لديه صلاحية، نوجهه للصفحة الرئيسية
    if (!hasAccess) {
      router.replace(redirectTo);
    }
  }, [loading, hasAccess, router, redirectTo]);

  return { loading, hasAccess };
}

/**
 * Hook للتحقق من صلاحية الصفحة بدون توجيه
 * مفيد للحالات التي تريد فيها التحقق فقط بدون توجيه تلقائي
 *
 * @param pageNameEn - اسم الصفحة بالإنجليزية
 * @returns { loading, hasAccess } - حالة التحميل وصلاحية الوصول
 */
export function usePageAccessCheck(pageNameEn: string) {
  const { hasPermission, loading } = usePermissionsContext();

  const pageCode = `page_access.${pageNameEn}`;
  const hasAccess = hasPermission(pageCode);

  return { loading, hasAccess };
}
