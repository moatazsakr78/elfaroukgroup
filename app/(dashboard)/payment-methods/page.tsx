'use client'

import { 
  PlusIcon,
  MagnifyingGlassIcon,
  CreditCardIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import AddPaymentMethodModal from '../../components/AddPaymentMethodModal'
import EditPaymentMethodModal from '../../components/EditPaymentMethodModal'

interface PaymentMethod {
  id: string
  name: string
  is_default: boolean | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export default function PaymentMethodsPage() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const openAddModal = () => {
    setIsAddModalOpen(true)
  }

  const closeAddModal = () => {
    setIsAddModalOpen(false)
  }

  const openEditModal = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod)
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedPaymentMethod(null)
  }

  const handleDeletePaymentMethod = async (paymentMethod: PaymentMethod) => {
    // Prevent deletion of Cash payment method
    if (paymentMethod.name.toLowerCase() === 'cash') {
      alert('لا يمكن حذف طريقة الدفع الأساسية "Cash"')
      return
    }

    if (window.confirm(`هل أنت متأكد من حذف طريقة الدفع "${paymentMethod.name}"؟`)) {
      try {
        const { error } = await supabase
          .from('payment_methods')
          .delete()
          .eq('id', paymentMethod.id)

        if (error) {
          console.error('Error deleting payment method:', error)
          alert('حدث خطأ أثناء حذف طريقة الدفع')
          return
        }

        fetchPaymentMethods()
      } catch (error) {
        console.error('Error deleting payment method:', error)
        alert('حدث خطأ أثناء حذف طريقة الدفع')
      }
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching payment methods:', error)
        return
      }

      setPaymentMethods(data || [])
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    }
  }

  const handlePaymentMethodAdded = () => {
    fetchPaymentMethods()
  }

  const handlePaymentMethodUpdated = () => {
    fetchPaymentMethods()
  }

  useEffect(() => {
    fetchPaymentMethods()

    // Set up real-time subscription
    const channel = supabase
      .channel('payment_methods_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'elfaroukgroup', table: 'payment_methods' },
        (payload: any) => {
          console.log('Real-time update:', payload)
          fetchPaymentMethods()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // دالة البحث بكلمات متعددة - تُرجع true إذا كل الكلمات موجودة في أي من الحقول
  const matchesMultiWordSearch = (query: string, ...fields: (string | null | undefined)[]): boolean => {
    if (!query) return true;
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return true;
    const combinedText = fields.filter(Boolean).map(f => f!.toLowerCase()).join(' ');
    return words.every(word => combinedText.includes(word));
  };

  const filteredPaymentMethods = paymentMethods.filter(method =>
    matchesMultiWordSearch(searchTerm, method.name)
  )

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-y-auto scrollbar-hide bg-pos-dark text-white" dir="rtl">
        {/* Header */}
        <div className="bg-pos-darker p-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/safes')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-purple-700 transition-colors"
            >
              <CreditCardIcon className="h-4 w-4" />
              الخزن
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium text-gray-300">
              إدارة وعرض جميع طرق الدفع المتاحة
            </h1>
            <h1 className="text-xl font-bold">طرق الدفع</h1>
            <CreditCardIcon className="h-6 w-6 text-purple-600" />
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Payment Methods */}
          <div className="bg-pos-darker rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">إجمالي طرق الدفع</p>
                <p className="text-2xl font-bold text-white mt-1">{paymentMethods.length}</p>
              </div>
              <div className="text-blue-500 text-3xl">💳</div>
            </div>
          </div>

          {/* Active Payment Methods */}
          <div className="bg-pos-darker rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">طرق الدفع النشطة</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {paymentMethods.filter(method => method.is_active === true).length}
                </p>
              </div>
              <div className="text-green-500 text-2xl">✅</div>
            </div>
          </div>

          {/* Default Payment Method */}
          <div className="bg-pos-darker rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">الطريقة الافتراضية</p>
                <p className="text-lg font-bold text-white mt-1">
                  {paymentMethods.find(method => method.is_default === true)?.name || 'غير محدد'}
                </p>
              </div>
              <div className="text-purple-500 text-2xl">⭐</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={openAddModal}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                إضافة طريقة دفع جديدة
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="البحث في طرق الدفع..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-700 text-white placeholder-gray-400 pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
              />
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Payment Methods Table */}
        <div className="mx-6 bg-pos-darker rounded-lg overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-700 text-gray-300">
              <tr>
                <th className="p-3 text-right font-medium">#</th>
                <th className="p-3 text-right font-medium">اسم طريقة الدفع</th>
                <th className="p-3 text-right font-medium">الحالة</th>
                <th className="p-3 text-right font-medium">افتراضية</th>
                <th className="p-3 text-right font-medium">تاريخ الإنشاء</th>
                <th className="p-3 text-right font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-pos-darker divide-y divide-gray-700">
              {filteredPaymentMethods.length > 0 ? (
                filteredPaymentMethods.map((method, index) => (
                  <tr 
                    key={method.id}
                    className="hover:bg-gray-700 transition-colors"
                  >
                    <td className="p-3 text-white font-medium">{index + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-sm">
                          💳
                        </div>
                        <span className="text-white font-medium">{method.name}</span>
                        {method.is_default === true && (
                          <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded-full text-xs mr-2">
                            افتراضية
                          </span>
                        )}
                        {method.name.toLowerCase() === 'cash' && (
                          <span className="px-2 py-1 bg-orange-900 text-orange-300 rounded-full text-xs mr-2">
                            أساسية
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        method.is_active === true 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {method.is_active === true ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        method.is_default === true 
                          ? 'bg-purple-900 text-purple-300' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {method.is_default === true ? 'نعم' : 'لا'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400">{formatDate(method.created_at)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openEditModal(method)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                          <PencilIcon className="h-3 w-3" />
                          تعديل
                        </button>
                        {method.name.toLowerCase() !== 'cash' && (
                          <button 
                            onClick={() => handleDeletePaymentMethod(method)}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                          >
                            <TrashIcon className="h-3 w-3" />
                            حذف
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    لا توجد طرق دفع متاحة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6"></div>
      </div>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal 
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onPaymentMethodAdded={handlePaymentMethodAdded}
      />

      {/* Edit Payment Method Modal */}
      <EditPaymentMethodModal 
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onPaymentMethodUpdated={handlePaymentMethodUpdated}
        paymentMethod={selectedPaymentMethod}
      />
    </div>
  )
}