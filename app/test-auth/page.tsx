'use client'

import { useAuth } from '@/app/lib/hooks/useAuth'
import { ProtectedSection } from '@/app/lib/auth/withAuth'

export default function TestAuthPage() {
  const {
    session,
    userRole,
    isLoading,
    isAuthenticated,
    isAdmin,
    isCustomer,
    isWholesale,
    isAdminOrEmployee
  } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">جاري التحميل...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-2xl">يجب تسجيل الدخول أولاً</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* معلومات المستخدم */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-3xl font-bold mb-4">🧪 صفحة اختبار الصلاحيات</h1>
          <div className="space-y-2">
            <p><strong>الاسم:</strong> {session?.user?.name || session?.user?.email}</p>
            <p className="text-2xl"><strong>الصلاحية:</strong>
              <span className="text-yellow-400"> {userRole || 'غير محدد'}</span>
            </p>
          </div>
        </div>

        {/* اختبار الصلاحيات */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-bold mb-4">الصلاحيات الحالية:</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded ${isAdmin ? 'bg-green-900' : 'bg-red-900'}`}>
              <p>أدمن رئيسي: {isAdmin ? '✅ نعم' : '❌ لا'}</p>
            </div>

            <div className={`p-4 rounded ${isWholesale ? 'bg-green-900' : 'bg-red-900'}`}>
              <p>جملة: {isWholesale ? '✅ نعم' : '❌ لا'}</p>
            </div>

            <div className={`p-4 rounded ${isCustomer ? 'bg-green-900' : 'bg-red-900'}`}>
              <p>عميل: {isCustomer ? '✅ نعم' : '❌ لا'}</p>
            </div>

            <div className={`p-4 rounded ${isAdminOrEmployee ? 'bg-green-900' : 'bg-red-900'}`}>
              <p>أدمن أو موظف: {isAdminOrEmployee ? '✅ نعم' : '❌ لا'}</p>
            </div>
          </div>
        </div>

        {/* محتوى للأدمن فقط */}
        <ProtectedSection
          allowedRoles={['أدمن رئيسي']}
          fallback={
            <div className="bg-red-900 rounded-lg p-6">
              <p className="text-xl">❌ هذا المحتوى للمشرفين فقط</p>
            </div>
          }
        >
          <div className="bg-green-900 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">✅ محتوى المشرفين</h3>
            <p>أنت تشاهد هذا لأنك أدمن رئيسي</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>يمكنك الوصول لنقطة البيع</li>
              <li>يمكنك إدارة المخزون</li>
              <li>يمكنك عرض التقارير</li>
            </ul>
          </div>
        </ProtectedSection>

        {/* محتوى للأدمن الرئيسي فقط */}
        <ProtectedSection
          allowedRoles={['أدمن رئيسي']}
          fallback={
            <div className="bg-orange-900 rounded-lg p-6">
              <p className="text-xl">⚠️ هذا المحتوى للأدمن الرئيسي فقط</p>
            </div>
          }
        >
          <div className="bg-blue-900 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">👑 محتوى الأدمن الرئيسي</h3>
            <p>أنت الأدمن الرئيسي - لديك كل الصلاحيات!</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>إدارة الصلاحيات</li>
              <li>الوصول لكل التقارير</li>
              <li>إدارة المستخدمين</li>
            </ul>
          </div>
        </ProtectedSection>

        {/* محتوى للعملاء فقط */}
        <ProtectedSection
          allowedRoles={['عميل', 'جملة']}
          fallback={
            <div className="bg-gray-700 rounded-lg p-6">
              <p className="text-xl">ℹ️ هذا المحتوى للعملاء فقط</p>
            </div>
          }
        >
          <div className="bg-purple-900 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-2">🛒 محتوى العملاء</h3>
            <p>أنت عميل - يمكنك:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>تصفح المنتجات</li>
              <li>عرض طلباتك</li>
              <li>تعديل الملف الشخصي</li>
            </ul>
          </div>
        </ProtectedSection>

        {/* Full Session Data */}
        <details className="bg-gray-800 rounded-lg p-6">
          <summary className="cursor-pointer text-blue-400 text-lg font-bold">
            عرض بيانات الـ Session الكاملة
          </summary>
          <pre className="mt-4 bg-gray-900 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(session, null, 2)}
          </pre>
        </details>

      </div>
    </div>
  )
}
