'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, BanknotesIcon, UserIcon, BuildingOfficeIcon, CheckIcon, CreditCardIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'
import { updateSalesInvoice, getSaleDetails } from '../lib/invoices/updateSalesInvoice'
import { useAuth } from '@/lib/useAuth'

interface EditInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  onInvoiceUpdated: () => void
  saleId: string | null
  initialRecordId?: string | null  // الخزنة الحالية من السجل (للتعامل مع عدم تطابق البيانات)
}

interface Safe {
  id: string
  name: string
  is_active: boolean | null
}

interface Customer {
  id: string
  name: string
  phone: string | null
}

interface Branch {
  id: string
  name: string
}

interface PaymentMethod {
  id: string
  name: string
  is_active: boolean | null
}

export default function EditInvoiceModal({
  isOpen,
  onClose,
  onInvoiceUpdated,
  saleId,
  initialRecordId
}: EditInvoiceModalProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // بيانات الفاتورة الحالية
  const [currentSale, setCurrentSale] = useState<any>(null)

  // القيم المحددة
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)

  // القوائم
  const [safes, setSafes] = useState<Safe[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  // البحث
  const [safeSearch, setSafeSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [branchSearch, setBranchSearch] = useState('')
  const [paymentMethodSearch, setPaymentMethodSearch] = useState('')

  // القوائم المنسدلة المفتوحة
  const [openDropdown, setOpenDropdown] = useState<'safe' | 'customer' | 'branch' | 'paymentMethod' | null>(null)

  // Refs للقوائم المنسدلة
  const safeDropdownRef = useRef<HTMLDivElement>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const paymentMethodDropdownRef = useRef<HTMLDivElement>(null)

  // جلب بيانات الفاتورة
  const fetchSaleDetails = useCallback(async () => {
    if (!saleId) return

    setIsLoading(true)
    setError(null)

    try {
      const sale = await getSaleDetails(saleId)
      if (sale) {
        // استخدام initialRecordId من الـ transaction إذا كان موجوداً (أكثر دقة)
        // لأن جدول cash_drawer_transactions هو مصدر الحقيقة للخزنة المعروضة في السجلات
        const effectiveRecordId = initialRecordId !== undefined ? initialRecordId : sale.record_id

        // تحديث record_id قبل setCurrentSale للمقارنة الصحيحة عند الحفظ
        if (initialRecordId !== undefined && initialRecordId !== sale.record_id) {
          console.log('⚠️ تم اكتشاف عدم تطابق: sales.record_id =', sale.record_id, ', transaction.record_id =', initialRecordId)
          // استخدام الـ record_id من الـ transaction كأساس للمقارنة
          sale.record_id = initialRecordId
        }

        // الآن نحفظ currentSale بالقيم المصححة
        setCurrentSale(sale)
        setSelectedRecordId(effectiveRecordId)
        setSelectedCustomerId(sale.customer_id)
        setSelectedBranchId(sale.branch_id)
        setSelectedPaymentMethod(sale.payment_method || null)
      } else {
        setError('لم يتم العثور على الفاتورة')
      }
    } catch (err) {
      console.error('Error fetching sale:', err)
      setError('حدث خطأ أثناء جلب بيانات الفاتورة')
    } finally {
      setIsLoading(false)
    }
  }, [saleId, initialRecordId])

  // جلب الخزن
  const fetchSafes = useCallback(async () => {
    const { data, error } = await supabase
      .from('records')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name')

    if (!error && data) {
      setSafes(data)
    }
  }, [])

  // جلب العملاء
  const fetchCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone')
      .order('name')
      .limit(100)

    if (!error && data) {
      setCustomers(data)
    }
  }, [])

  // جلب الفروع
  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .order('name')

    if (!error && data) {
      setBranches(data)
    }
  }, [])

  // جلب طرق الدفع
  const fetchPaymentMethods = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setPaymentMethods(data)
    }
  }, [])

  // البحث في العملاء
  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchCustomers()
      return
    }

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('name')
      .limit(50)

    if (!error && data) {
      setCustomers(data)
    }
  }, [fetchCustomers])

  // تحميل البيانات عند فتح المودال
  useEffect(() => {
    if (isOpen && saleId) {
      fetchSaleDetails()
      fetchSafes()
      fetchCustomers()
      fetchBranches()
      fetchPaymentMethods()
    }
  }, [isOpen, saleId, fetchSaleDetails, fetchSafes, fetchCustomers, fetchBranches, fetchPaymentMethods])

  // إغلاق القوائم المنسدلة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown === 'safe' && safeDropdownRef.current && !safeDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
      if (openDropdown === 'customer' && customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
      if (openDropdown === 'branch' && branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
      if (openDropdown === 'paymentMethod' && paymentMethodDropdownRef.current && !paymentMethodDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

  // البحث المباشر في العملاء
  useEffect(() => {
    const timer = setTimeout(() => {
      if (openDropdown === 'customer') {
        searchCustomers(customerSearch)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [customerSearch, openDropdown, searchCustomers])

  // حفظ التغييرات
  const handleSave = async () => {
    if (!saleId || !currentSale) return

    setIsSaving(true)
    setError(null)

    try {
      // تحديد ما تغير
      const hasRecordChanged = selectedRecordId !== currentSale.record_id
      const hasCustomerChanged = selectedCustomerId !== currentSale.customer_id
      const hasBranchChanged = selectedBranchId !== currentSale.branch_id
      const hasPaymentMethodChanged = selectedPaymentMethod !== (currentSale.payment_method || null)

      if (!hasRecordChanged && !hasCustomerChanged && !hasBranchChanged && !hasPaymentMethodChanged) {
        onClose()
        return
      }

      const result = await updateSalesInvoice({
        saleId,
        newRecordId: hasRecordChanged ? selectedRecordId : undefined,
        newCustomerId: hasCustomerChanged ? selectedCustomerId : undefined,
        newBranchId: hasBranchChanged ? selectedBranchId : undefined,
        newPaymentMethod: hasPaymentMethodChanged ? (selectedPaymentMethod || undefined) : undefined,
        userId: user?.id || null,
        userName: user?.name || null
      })

      if (result.success) {
        onInvoiceUpdated()
        onClose()
      } else {
        setError(result.message)
      }
    } catch (err: any) {
      console.error('Error saving:', err)
      setError(err.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  // الفلترة المحلية
  const filteredSafes = safes.filter(safe =>
    safe.name.toLowerCase().includes(safeSearch.toLowerCase())
  )

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearch.toLowerCase())
  )

  const filteredPaymentMethods = paymentMethods.filter(method =>
    method.name.toLowerCase().includes(paymentMethodSearch.toLowerCase())
  )

  // الحصول على الاسم المعروض
  const getSelectedSafeName = () => {
    if (selectedRecordId === null) return 'لا يوجد'
    return safes.find(s => s.id === selectedRecordId)?.name || currentSale?.record?.name || 'غير محدد'
  }

  const getSelectedCustomerName = () => {
    const customer = customers.find(c => c.id === selectedCustomerId) || currentSale?.customer
    return customer?.name || 'غير محدد'
  }

  const getSelectedBranchName = () => {
    return branches.find(b => b.id === selectedBranchId)?.name || currentSale?.branch?.name || 'غير محدد'
  }

  const getSelectedPaymentMethodName = () => {
    if (!selectedPaymentMethod) return 'غير محدد'
    return paymentMethods.find(m => m.name === selectedPaymentMethod)?.name || selectedPaymentMethod
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" dir="rtl">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">تعديل الفاتورة</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">جاري تحميل البيانات...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">{error}</div>
          ) : (
            <>
              {/* معلومات الفاتورة */}
              {currentSale && (
                <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-400">رقم الفاتورة: <span className="text-white">{currentSale.invoice_number}</span></p>
                </div>
              )}

              {/* طريقة الدفع والخزنة - على نفس الصف */}
              <div className="grid grid-cols-2 gap-3">
                {/* اختيار طريقة الدفع */}
                <div ref={paymentMethodDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <CreditCardIcon className="w-4 h-4 inline ml-1" />
                    طريقة الدفع
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'paymentMethod' ? null : 'paymentMethod')}
                    className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-right flex items-center justify-between hover:border-gray-500 transition-colors text-sm"
                  >
                    <span className="truncate">{getSelectedPaymentMethodName()}</span>
                    <span className="text-gray-400 mr-1">▼</span>
                  </button>

                  {openDropdown === 'paymentMethod' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-600">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="بحث..."
                            value={paymentMethodSearch}
                            onChange={(e) => setPaymentMethodSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 text-sm pr-8"
                          />
                          <MagnifyingGlassIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>

                      <div className="overflow-y-auto max-h-48">
                        {filteredPaymentMethods.map(method => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod(method.name)
                              setOpenDropdown(null)
                              setPaymentMethodSearch('')
                            }}
                            className={`w-full px-4 py-2 text-right flex items-center justify-between hover:bg-gray-600 transition-colors ${
                              selectedPaymentMethod === method.name ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
                            }`}
                          >
                            <span>{method.name}</span>
                            {selectedPaymentMethod === method.name && <CheckIcon className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* اختيار الخزنة */}
                <div ref={safeDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <BanknotesIcon className="w-4 h-4 inline ml-1" />
                    الخزنة
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'safe' ? null : 'safe')}
                    className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-right flex items-center justify-between hover:border-gray-500 transition-colors text-sm"
                  >
                    <span className="truncate">{getSelectedSafeName()}</span>
                    <span className="text-gray-400 mr-1">▼</span>
                  </button>

                  {openDropdown === 'safe' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-600">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="بحث..."
                            value={safeSearch}
                            onChange={(e) => setSafeSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 text-sm pr-8"
                          />
                          <MagnifyingGlassIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>

                      <div className="overflow-y-auto max-h-48">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecordId(null)
                            setOpenDropdown(null)
                            setSafeSearch('')
                          }}
                          className={`w-full px-4 py-2 text-right flex items-center justify-between hover:bg-gray-600 transition-colors ${
                            selectedRecordId === null ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
                          }`}
                        >
                          <span>لا يوجد</span>
                          {selectedRecordId === null && <CheckIcon className="w-4 h-4" />}
                        </button>

                        {filteredSafes.map(safe => (
                          <button
                            key={safe.id}
                            type="button"
                            onClick={() => {
                              setSelectedRecordId(safe.id)
                              setOpenDropdown(null)
                              setSafeSearch('')
                            }}
                            className={`w-full px-4 py-2 text-right flex items-center justify-between hover:bg-gray-600 transition-colors ${
                              selectedRecordId === safe.id ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
                            }`}
                          >
                            <span>{safe.name}</span>
                            {selectedRecordId === safe.id && <CheckIcon className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* اختيار العميل */}
              <div ref={customerDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <UserIcon className="w-4 h-4 inline ml-1" />
                  العميل
                </label>
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'customer' ? null : 'customer')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-right flex items-center justify-between hover:border-gray-500 transition-colors"
                >
                  <span>{getSelectedCustomerName()}</span>
                  <span className="text-gray-400">▼</span>
                </button>

                {openDropdown === 'customer' && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                    {/* حقل البحث */}
                    <div className="p-2 border-b border-gray-600">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="بحث بالاسم أو الهاتف..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 text-sm pr-8"
                        />
                        <MagnifyingGlassIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>

                    {/* القائمة */}
                    <div className="overflow-y-auto max-h-48">
                      {customers.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(customer.id)
                            setOpenDropdown(null)
                            setCustomerSearch('')
                          }}
                          className={`w-full px-4 py-2 text-right flex items-center justify-between hover:bg-gray-600 transition-colors ${
                            selectedCustomerId === customer.id ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
                          }`}
                        >
                          <div>
                            <div>{customer.name}</div>
                            {customer.phone && (
                              <div className="text-xs text-gray-400">{customer.phone}</div>
                            )}
                          </div>
                          {selectedCustomerId === customer.id && <CheckIcon className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* اختيار الفرع */}
              <div ref={branchDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <BuildingOfficeIcon className="w-4 h-4 inline ml-1" />
                  الفرع
                </label>
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'branch' ? null : 'branch')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-right flex items-center justify-between hover:border-gray-500 transition-colors"
                >
                  <span>{getSelectedBranchName()}</span>
                  <span className="text-gray-400">▼</span>
                </button>

                {openDropdown === 'branch' && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 max-h-64 overflow-hidden">
                    {/* حقل البحث */}
                    <div className="p-2 border-b border-gray-600">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="بحث..."
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 text-sm pr-8"
                        />
                        <MagnifyingGlassIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>

                    {/* القائمة */}
                    <div className="overflow-y-auto max-h-48">
                      {filteredBranches.map(branch => (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setSelectedBranchId(branch.id)
                            setOpenDropdown(null)
                            setBranchSearch('')
                          }}
                          className={`w-full px-4 py-2 text-right flex items-center justify-between hover:bg-gray-600 transition-colors ${
                            selectedBranchId === branch.id ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'
                          }`}
                        >
                          <span>{branch.name}</span>
                          {selectedBranchId === branch.id && <CheckIcon className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  )
}
