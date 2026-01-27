'use client'

import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  PencilIcon,
  TrashIcon,
  CreditCardIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  CloudIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase/client'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import SafeDetailsModal from '../../components/SafeDetailsModal'
import AddSafeModal from '../../components/AddSafeModal'
import EditSafeModal from '../../components/EditSafeModal'
import AddPaymentMethodModal from '../../components/AddPaymentMethodModal'
import EditPaymentMethodModal from '../../components/EditPaymentMethodModal'
import SimpleDateFilterModal, { DateFilter } from '../../components/SimpleDateFilterModal'
import ContextMenu, { createEditContextMenuItems } from '../../components/ContextMenu'
import EditInvoiceModal from '../../components/EditInvoiceModal'
import { useFormatPrice } from '@/lib/hooks/useCurrency'
import { useOfflineStatus } from '../../lib/hooks/useOfflineStatus'
import { useOfflineData } from '../../lib/hooks/useOfflineData'
import { useInfiniteTransactions, CashDrawerTransaction } from '../../lib/hooks/useInfiniteTransactions'
import { useScrollDetection } from '../../lib/hooks/useScrollDetection'
import { getDateRangeFromFilter, getDateFilterLabel } from '../../lib/utils/dateFilters'
import { getAllPendingSales } from '../../lib/offline/db'
import type { PendingSale } from '../../lib/offline/types'

// Types
interface Safe {
  id: string
  name: string
  is_primary: boolean | null
  is_active: boolean | null
  branch_id: string | null
  created_at: string | null
  updated_at: string | null
}

// CashDrawerTransaction is now imported from useInfiniteTransactions hook

interface PaymentMethod {
  id: string
  name: string
  is_default: boolean | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type TabType = 'safes' | 'records' | 'payment_methods'
type TransactionType = 'all' | 'sale' | 'return' | 'withdrawal' | 'deposit' | 'adjustment' | 'transfer'

export default function SafesPage() {
  const formatPrice = useFormatPrice()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Offline support
  const { isOnline, isOfflineReady, pendingSalesCount } = useOfflineStatus()
  const { data: offlineData } = useOfflineData()
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([])
  const [isUsingOfflineData, setIsUsingOfflineData] = useState(false)

  // Tab Management
  const [activeTab, setActiveTab] = useState<TabType>('safes')

  // Safes Tab State
  const [isSafeDetailsModalOpen, setIsSafeDetailsModalOpen] = useState(false)
  const [isAddSafeModalOpen, setIsAddSafeModalOpen] = useState(false)
  const [isEditSafeModalOpen, setIsEditSafeModalOpen] = useState(false)
  const [selectedSafe, setSelectedSafe] = useState<Safe | null>(null)
  const [safeToEdit, setSafeToEdit] = useState<Safe | null>(null)
  const [safes, setSafes] = useState<Safe[]>([])
  const [activeSafesCount, setActiveSafesCount] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [safesSearchTerm, setSafesSearchTerm] = useState('')

  // Records Tab State - Filter configurations
  const [transactionFilters, setTransactionFilters] = useState<{
    safeId: string
    transactionType: TransactionType
    dateFilter: DateFilter
  }>({
    safeId: 'all',
    transactionType: 'all',
    dateFilter: { type: 'all' }
  })
  const [showDateFilterModal, setShowDateFilterModal] = useState(false)
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('')

  // Use infinite scroll hook for transactions
  const {
    transactions,
    isLoading: isLoadingTransactions,
    isLoadingMore: isLoadingMoreTransactions,
    hasMore: hasMoreTransactions,
    loadMore: loadMoreTransactions,
    refresh: refreshTransactions
  } = useInfiniteTransactions({
    recordId: transactionFilters.safeId,
    transactionType: transactionFilters.transactionType,
    dateFilter: transactionFilters.dateFilter,
    enabled: activeTab === 'records',
    pageSize: 200,
    safes: safes
  })

  // Scroll detection for infinite scroll
  const { sentinelRef: transactionSentinelRef } = useScrollDetection({
    onLoadMore: loadMoreTransactions,
    enabled: hasMoreTransactions && !isLoadingMoreTransactions && activeTab === 'records',
    isLoading: isLoadingMoreTransactions
  })

  // Offline transactions state (used when in offline mode)
  const [offlineTransactions, setOfflineTransactions] = useState<CashDrawerTransaction[]>([])

  // Payment Methods Tab State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isAddPaymentMethodModalOpen, setIsAddPaymentMethodModalOpen] = useState(false)
  const [isEditPaymentMethodModalOpen, setIsEditPaymentMethodModalOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethodSearchTerm, setPaymentMethodSearchTerm] = useState('')

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    x: number
    y: number
    transaction: CashDrawerTransaction | null
  }>({ isOpen: false, x: 0, y: 0, transaction: null })

  // Edit Invoice Modal State
  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false)
  const [transactionToEdit, setTransactionToEdit] = useState<CashDrawerTransaction | null>(null)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // ==================== Safes Tab Functions ====================
  const openSafeDetails = (safe: Safe) => {
    setSelectedSafe(safe)
    setIsSafeDetailsModalOpen(true)
  }

  const closeSafeDetails = () => {
    setIsSafeDetailsModalOpen(false)
    setSelectedSafe(null)
  }

  const openAddSafeModal = () => {
    setIsAddSafeModalOpen(true)
  }

  const closeAddSafeModal = () => {
    setIsAddSafeModalOpen(false)
  }

  const openEditSafeModal = (safe: Safe) => {
    setSafeToEdit(safe)
    setIsEditSafeModalOpen(true)
  }

  const closeEditSafeModal = () => {
    setIsEditSafeModalOpen(false)
    setSafeToEdit(null)
  }

  const handleDeleteSafe = async (safe: Safe) => {
    if (safe.is_primary) {
      alert('لا يمكن حذف الخزنة الرئيسية')
      return
    }

    try {
      const { data: drawer, error: drawerError } = await supabase
        .from('cash_drawers')
        .select('current_balance')
        .eq('record_id', safe.id)
        .single()

      if (drawerError && drawerError.code !== 'PGRST116') {
        console.error('Error checking safe balance:', drawerError)
        alert('حدث خطأ أثناء التحقق من رصيد الخزنة')
        return
      }

      const balance = drawer?.current_balance || 0
      if (balance !== 0) {
        alert(`لا يمكن حذف الخزنة "${safe.name}" لأنها تحتوي على رصيد (${formatPrice(balance)})\n\nيجب تفريغ الخزنة أولاً قبل حذفها`)
        return
      }

      if (window.confirm(`هل أنت متأكد من حذف الخزنة "${safe.name}"؟`)) {
        const { error } = await supabase
          .from('records')
          .delete()
          .eq('id', safe.id)

        if (error) {
          console.error('Error deleting safe:', error)
          alert('حدث خطأ أثناء حذف الخزنة')
          return
        }
      }
    } catch (error) {
      console.error('Error deleting safe:', error)
      alert('حدث خطأ أثناء حذف الخزنة')
    }
  }

  const fetchSafes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching safes:', error)
        return
      }

      setSafes(data || [])
      setActiveSafesCount(data?.filter((safe: Safe) => safe.is_active).length || 0)

      // Fetch total balance from cash_drawers
      const { data: drawers, error: drawersError } = await supabase
        .from('cash_drawers')
        .select('current_balance')

      if (!drawersError && drawers) {
        const total = drawers.reduce((sum, d) => sum + (d.current_balance || 0), 0)
        setTotalBalance(total)
      }
    } catch (error) {
      console.error('Error fetching safes:', error)
    }
  }, [])

  const handleSafeAdded = () => {
    fetchSafes()
  }

  const handleSafeUpdated = () => {
    fetchSafes()
  }

  // ==================== Records Tab Functions ====================
  // getDateRangeFromFilter and getDateFilterLabel are now imported from @/lib/utils/dateFilters
  // fetchTransactions is now replaced by useInfiniteTransactions hook

  const getTransactionTypeBadge = (type: string | null) => {
    const styles: Record<string, { bg: string, text: string, label: string }> = {
      'sale': { bg: 'bg-green-900', text: 'text-green-300', label: 'بيع' },
      'return': { bg: 'bg-orange-900', text: 'text-orange-300', label: 'مرتجع' },
      'withdrawal': { bg: 'bg-red-900', text: 'text-red-300', label: 'سحب' },
      'deposit': { bg: 'bg-blue-900', text: 'text-blue-300', label: 'إيداع' },
      'adjustment': { bg: 'bg-purple-900', text: 'text-purple-300', label: 'تسوية' },
      'transfer_in': { bg: 'bg-cyan-900', text: 'text-cyan-300', label: 'تحويل' },
      'transfer_out': { bg: 'bg-cyan-900', text: 'text-cyan-300', label: 'تحويل' }
    }

    const style = styles[type || ''] || { bg: 'bg-gray-700', text: 'text-gray-300', label: type || '-' }

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    )
  }

  const formatAmount = (amount: number | null) => {
    if (amount === null) return '-'
    const isPositive = amount >= 0
    return (
      <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
        {isPositive ? '+' : ''}{formatPrice(amount)}
      </span>
    )
  }

  // ==================== Payment Methods Tab Functions ====================
  const fetchPaymentMethods = useCallback(async () => {
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
  }, [])

  const openAddPaymentMethodModal = () => {
    setIsAddPaymentMethodModalOpen(true)
  }

  const closeAddPaymentMethodModal = () => {
    setIsAddPaymentMethodModalOpen(false)
  }

  const openEditPaymentMethodModal = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod)
    setIsEditPaymentMethodModalOpen(true)
  }

  const closeEditPaymentMethodModal = () => {
    setIsEditPaymentMethodModalOpen(false)
    setSelectedPaymentMethod(null)
  }

  const handleDeletePaymentMethod = async (paymentMethod: PaymentMethod) => {
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

  const handlePaymentMethodAdded = () => {
    fetchPaymentMethods()
  }

  const handlePaymentMethodUpdated = () => {
    fetchPaymentMethods()
  }

  // ==================== Context Menu Functions ====================
  const handleContextMenu = (e: React.MouseEvent, tx: CashDrawerTransaction) => {
    e.preventDefault()
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      transaction: tx
    })
  }

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, transaction: null })
  }

  const handleEditTransaction = () => {
    if (contextMenu.transaction) {
      setTransactionToEdit(contextMenu.transaction)
      setIsEditInvoiceModalOpen(true)
    }
    closeContextMenu()
  }

  const handleInvoiceUpdated = () => {
    // إعادة تحميل السجلات بعد التعديل
    refreshTransactions()
    fetchSafes() // لتحديث الأرصدة
  }

  // ==================== Date/Time Formatting ====================
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ==================== Filtered Data ====================
  const filteredSafes = safes.filter(safe =>
    safe.name.toLowerCase().includes(safesSearchTerm.toLowerCase())
  )

  // Convert pending sales to transaction format for display
  // MOVED HERE - must be defined before filteredTransactions
  const pendingSalesAsTransactions: CashDrawerTransaction[] = pendingSales.map(sale => ({
    id: `pending_${sale.local_id}`,
    drawer_id: null,
    record_id: sale.record_id,
    transaction_type: sale.invoice_type === 'Sale Return' ? 'return' : 'sale',
    amount: sale.invoice_type === 'Sale Return' ? -sale.total_amount : sale.total_amount,
    balance_after: null,
    sale_id: null,
    notes: `فاتورة معلقة: ${sale.temp_invoice_number}`,
    performed_by: sale.user_name,
    created_at: sale.created_at,
    safe_name: sale.record_name || 'لا يوجد',
    customer_name: sale.customer_name
  }))

  // Use hook transactions when online, offline transactions when offline
  // MOVED HERE - must be defined before filteredTransactions
  const activeTransactions = isUsingOfflineData ? offlineTransactions : transactions
  const allTransactions = [...pendingSalesAsTransactions, ...activeTransactions]

  // Use allTransactions for filtering (includes pending sales when offline)
  const filteredTransactions = allTransactions.filter(tx =>
    (tx.notes?.toLowerCase().includes(transactionSearchTerm.toLowerCase()) || false) ||
    (tx.performed_by?.toLowerCase().includes(transactionSearchTerm.toLowerCase()) || false) ||
    (tx.safe_name?.toLowerCase().includes(transactionSearchTerm.toLowerCase()) || false) ||
    (tx.customer_name?.toLowerCase().includes(transactionSearchTerm.toLowerCase()) || false)
  )

  const filteredPaymentMethods = paymentMethods.filter(method =>
    method.name.toLowerCase().includes(paymentMethodSearchTerm.toLowerCase())
  )

  // ==================== Effects ====================
  // Initial data fetch
  useEffect(() => {
    fetchSafes()
    fetchPaymentMethods()
  }, [fetchSafes, fetchPaymentMethods])

  // Real-time subscriptions
  useEffect(() => {
    const safesChannel = supabase
      .channel('safes_changes')
      .on('postgres_changes',
        { event: '*', schema: 'elfaroukgroup', table: 'records' },
        () => {
          fetchSafes()
        }
      )
      .subscribe()

    const paymentMethodsChannel = supabase
      .channel('payment_methods_changes')
      .on('postgres_changes',
        { event: '*', schema: 'elfaroukgroup', table: 'payment_methods' },
        () => {
          fetchPaymentMethods()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(safesChannel)
      supabase.removeChannel(paymentMethodsChannel)
    }
  }, [fetchSafes, fetchPaymentMethods])

  // Transaction fetching and filter handling is now managed by useInfiniteTransactions hook
  // The hook automatically:
  // - Fetches when tab becomes active (enabled: activeTab === 'records')
  // - Re-fetches when filters change (reactively based on transactionFilters)

  // ==================== Offline Support Effects ====================
  // Load pending sales from IndexedDB
  useEffect(() => {
    const loadPendingSales = async () => {
      try {
        const sales = await getAllPendingSales()
        setPendingSales(sales.filter(s => s.sync_status === 'pending' || s.sync_status === 'failed'))
      } catch (error) {
        console.error('Failed to load pending sales:', error)
      }
    }
    loadPendingSales()

    // Refresh periodically
    const interval = setInterval(loadPendingSales, 5000)
    return () => clearInterval(interval)
  }, [])

  // Handle offline mode - use cached data when offline
  useEffect(() => {
    if (!isOnline && isOfflineReady) {
      setIsUsingOfflineData(true)
      // Use offline data for safes
      if (offlineData.records.length > 0) {
        const offlineSafes: Safe[] = offlineData.records.map(r => ({
          id: r.id,
          name: r.name,
          is_primary: false,
          is_active: true,
          branch_id: r.branch_id,
          created_at: null,
          updated_at: null
        }))
        setSafes(offlineSafes)
        setActiveSafesCount(offlineSafes.length)
      }
      // Use offline data for payment methods
      if (offlineData.paymentMethods.length > 0) {
        const offlineMethods: PaymentMethod[] = offlineData.paymentMethods.map(m => ({
          id: m.id,
          name: m.name,
          is_default: null,
          is_active: m.is_active,
          created_at: null,
          updated_at: null
        }))
        setPaymentMethods(offlineMethods)
      }
      // Use offline data for transactions
      if (offlineData.cashDrawerTransactions.length > 0) {
        const mappedOfflineTransactions: CashDrawerTransaction[] = offlineData.cashDrawerTransactions.map(t => ({
          id: t.id,
          drawer_id: t.drawer_id,
          record_id: t.record_id,
          transaction_type: t.transaction_type,
          amount: t.amount,
          balance_after: t.balance_after,
          sale_id: t.sale_id,
          notes: t.notes,
          performed_by: t.performed_by,
          created_at: t.created_at,
          safe_name: t.record_name,
          customer_name: t.customer_name
        }))
        setOfflineTransactions(mappedOfflineTransactions)
      }
    } else if (isOnline) {
      setIsUsingOfflineData(false)
    }
  }, [isOnline, isOfflineReady, offlineData])

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
            <BanknotesIcon className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-bold">الخزن والمالية</h1>
            <h1 className="text-xl font-medium text-gray-300">
              إدارة الخزن والسجلات وطرق الدفع
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Offline Indicator */}
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/50 border border-orange-600 rounded-lg">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-400" />
                <span className="text-orange-300 text-sm font-medium">وضع عدم الاتصال</span>
              </div>
            )}
            {/* Pending Sales Badge */}
            {pendingSalesCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/50 border border-yellow-600 rounded-lg">
                <CloudIcon className="h-4 w-4 text-yellow-400" />
                <span className="text-yellow-300 text-sm font-medium">{pendingSalesCount} فاتورة معلقة</span>
              </div>
            )}
          </div>
        </div>

        {/* Unified Control Bar - Tabs, Filters, Count & Search in ONE row */}
        <div className="px-3 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Right Section: Tabs + Filters (for records tab) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Tabs */}
            <div className="flex bg-[#2B3544] rounded-md overflow-hidden w-fit border border-gray-700">
              <button
                onClick={() => setActiveTab('safes')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'safes'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
              >
                <BanknotesIcon className="h-4 w-4" />
                الخزن
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'records'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
              >
                <DocumentTextIcon className="h-4 w-4" />
                السجلات
              </button>
              <button
                onClick={() => setActiveTab('payment_methods')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'payment_methods'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
              >
                <CreditCardIcon className="h-4 w-4" />
                طرق الدفع
              </button>
            </div>

            {/* Records Tab Filters */}
            {activeTab === 'records' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={transactionFilters.safeId}
                  onChange={(e) => setTransactionFilters(prev => ({ ...prev, safeId: e.target.value }))}
                  className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">جميع الخزن</option>
                  <option value="no_safe">لا يوجد</option>
                  {safes.map(safe => (
                    <option key={safe.id} value={safe.id}>{safe.name}</option>
                  ))}
                </select>
                <select
                  value={transactionFilters.transactionType}
                  onChange={(e) => setTransactionFilters(prev => ({ ...prev, transactionType: e.target.value as TransactionType }))}
                  className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">جميع العمليات</option>
                  <option value="sale">بيع</option>
                  <option value="return">مرتجع</option>
                  <option value="withdrawal">سحب</option>
                  <option value="deposit">إيداع</option>
                  <option value="adjustment">تسوية</option>
                  <option value="transfer">تحويل</option>
                </select>
                <button
                  onClick={() => setShowDateFilterModal(true)}
                  className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-600 border border-gray-600 transition-colors text-sm"
                >
                  <CalendarDaysIcon className="h-4 w-4" />
                  {getDateFilterLabel(transactionFilters.dateFilter)}
                </button>
              </div>
            )}
          </div>

          {/* Middle: Count (for records tab) */}
          {activeTab === 'records' && (
            <span className="text-sm text-gray-400">
              {filteredTransactions.length} سجل
            </span>
          )}

          {/* Left Section: Search (for records tab) */}
          {activeTab === 'records' && (
            <div className="relative w-full sm:w-auto">
              <input
                type="text"
                placeholder="البحث في السجلات..."
                value={transactionSearchTerm}
                onChange={(e) => setTransactionSearchTerm(e.target.value)}
                className="bg-gray-700 text-white placeholder-gray-400 pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56 text-sm"
              />
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          )}
        </div>

        {/* ==================== Safes Tab Content ==================== */}
        {activeTab === 'safes' && (
          <>
            {/* Statistics Cards */}
            <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Total Balance */}
              <div className="bg-pos-darker rounded-lg p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">الرصيد الإجمالي</p>
                    <p className="text-2xl font-bold text-white mt-1">{formatPrice(totalBalance)}</p>
                  </div>
                  <div className="bg-blue-600/20 p-3 rounded-lg">
                    <span className="text-blue-400 text-2xl">$</span>
                  </div>
                </div>
              </div>

              {/* Active Safes */}
              <div className="bg-pos-darker rounded-lg p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">الخزن النشطة</p>
                    <p className="text-2xl font-bold text-white mt-1">{activeSafesCount}</p>
                  </div>
                  <div className="bg-green-600/20 p-3 rounded-lg">
                    <span className="text-green-400 text-2xl">✓</span>
                  </div>
                </div>
              </div>

              {/* Total Safes */}
              <div className="bg-pos-darker rounded-lg p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">إجمالي الخزن</p>
                    <p className="text-2xl font-bold text-white mt-1">{safes.length}</p>
                  </div>
                  <div className="bg-purple-600/20 p-3 rounded-lg">
                    <BanknotesIcon className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="px-3 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={openAddSafeModal}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    إضافة خزنة جديدة
                  </button>
                </div>

                <div className="relative w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="البحث في الخزن..."
                    value={safesSearchTerm}
                    onChange={(e) => setSafesSearchTerm(e.target.value)}
                    className="bg-gray-700 text-white placeholder-gray-400 pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 md:w-80"
                  />
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Safes Table */}
            <div className="mx-3 sm:mx-6 bg-pos-darker rounded-lg overflow-hidden border border-gray-700">
              <div className="overflow-x-auto">
              <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="bg-gray-700 text-gray-300">
                  <tr>
                    <th className="p-3 text-right font-medium">#</th>
                    <th className="p-3 text-right font-medium">اسم الخزنة</th>
                    <th className="p-3 text-right font-medium">الحالة</th>
                    <th className="p-3 text-right font-medium">تاريخ الإنشاء</th>
                    <th className="p-3 text-right font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-pos-darker divide-y divide-gray-700">
                  {filteredSafes.length > 0 ? (
                    filteredSafes.map((safe, index) => (
                      <tr
                        key={safe.id}
                        className="hover:bg-gray-700 transition-colors cursor-pointer"
                        onDoubleClick={() => openSafeDetails(safe)}
                      >
                        <td className="p-3 text-white font-medium">{index + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 ${
                              safe.is_primary
                                ? 'bg-purple-600'
                                : 'bg-blue-600'
                            } rounded flex items-center justify-center`}>
                              <BanknotesIcon className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-white font-medium">{safe.name}</span>
                            {safe.is_primary && (
                              <span className="px-2 py-1 rounded-full text-xs mr-2 bg-purple-900 text-purple-300">
                                رئيسية
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            safe.is_active
                              ? 'bg-green-900 text-green-300'
                              : 'bg-red-900 text-red-300'
                          }`}>
                            {safe.is_active ? 'نشطة' : 'غير نشطة'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">{formatDate(safe.created_at)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditSafeModal(safe)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                              <PencilIcon className="h-3 w-3" />
                              تعديل
                            </button>
                            {!safe.is_primary && (
                              <button
                                onClick={() => handleDeleteSafe(safe)}
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
                      <td colSpan={5} className="p-8 text-center text-gray-400">
                        لا توجد خزن متاحة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}

        {/* ==================== Records Tab Content ==================== */}
        {activeTab === 'records' && (
          <div className="p-3 sm:p-6 pt-4">
            {/* Transactions Table */}
            {/* Offline Mode Notice */}
            {isUsingOfflineData && (
              <div className="mb-4 p-3 bg-orange-900/30 border border-orange-600 rounded-lg flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-400" />
                <span className="text-orange-300 text-sm">
                  أنت في وضع عدم الاتصال. يتم عرض البيانات المحفوظة من آخر مزامنة.
                </span>
              </div>
            )}

            <div className="bg-pos-darker rounded-lg border border-gray-700 max-h-[calc(100vh-280px)] overflow-auto">
              {isLoadingTransactions && !isUsingOfflineData ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    جاري تحميل السجلات...
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right min-w-[800px]">
                      <thead className="bg-gray-700 text-gray-300 sticky top-0 z-10">
                        <tr>
                          <th className="p-3 text-right font-medium">#</th>
                          <th className="p-3 text-right font-medium">نوع العملية</th>
                          <th className="p-3 text-right font-medium">الخزنة</th>
                          <th className="p-3 text-right font-medium">المبلغ</th>
                          <th className="p-3 text-right font-medium">الرصيد بعد</th>
                          <th className="p-3 text-right font-medium">ملاحظات</th>
                          <th className="p-3 text-right font-medium">اسم العميل</th>
                          <th className="p-3 text-right font-medium">بواسطة</th>
                          <th className="p-3 text-right font-medium">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-pos-darker divide-y divide-gray-700">
                        {filteredTransactions.length > 0 ? (
                          filteredTransactions.map((tx, index) => {
                            const isPending = tx.id.startsWith('pending_')
                            return (
                              <tr
                                key={tx.id}
                                className={`hover:bg-gray-700 transition-colors cursor-pointer ${isPending ? 'bg-yellow-900/20' : ''}`}
                                onContextMenu={(e) => !isPending && handleContextMenu(e, tx)}
                              >
                                <td className="p-3 text-white font-medium">{index + 1}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {getTransactionTypeBadge(tx.transaction_type)}
                                    {isPending && (
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-900 text-yellow-300 border border-yellow-600">
                                        معلق
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-white">{tx.safe_name}</td>
                                <td className="p-3">{formatAmount(tx.amount)}</td>
                                <td className="p-3 text-gray-300">
                                  {isPending ? <span className="text-yellow-400">-</span> : formatPrice(tx.balance_after || 0)}
                                </td>
                                <td className="p-3 text-gray-400 max-w-[200px] truncate" title={tx.notes || ''}>
                                  {tx.notes || '-'}
                                </td>
                                <td className="p-3 text-gray-400">{tx.customer_name || '-'}</td>
                                <td className="p-3 text-gray-400">{tx.performed_by || '-'}</td>
                                <td className="p-3 text-gray-400">{formatDateTime(tx.created_at)}</td>
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-gray-400">
                              {isUsingOfflineData ? 'لا توجد سجلات محفوظة للعرض في وضع عدم الاتصال' : 'لا توجد سجلات متاحة'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Sentinel element for infinite scroll */}
                  <div ref={transactionSentinelRef} className="h-4" />
                  {/* Loading more indicator */}
                  {isLoadingMoreTransactions && (
                    <div className="flex items-center justify-center py-4 border-t border-gray-700">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
                      <span className="text-gray-400 text-sm">جاري تحميل المزيد...</span>
                    </div>
                  )}
                  {/* No more data indicator */}
                  {!hasMoreTransactions && filteredTransactions.length > 0 && (
                    <div className="text-center py-3 text-gray-500 text-sm border-t border-gray-700">
                      تم عرض جميع السجلات ({filteredTransactions.length} سجل)
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ==================== Payment Methods Tab Content ==================== */}
        {activeTab === 'payment_methods' && (
          <>
            {/* Statistics Cards */}
            <div className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Total Payment Methods */}
              <div className="bg-pos-darker rounded-lg p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">إجمالي طرق الدفع</p>
                    <p className="text-2xl font-bold text-white mt-1">{paymentMethods.length}</p>
                  </div>
                  <div className="bg-blue-600/20 p-3 rounded-lg">
                    <CreditCardIcon className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </div>

              {/* Active Payment Methods */}
              <div className="bg-pos-darker rounded-lg p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">طرق الدفع النشطة</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {paymentMethods.filter(method => method.is_active === true).length}
                    </p>
                  </div>
                  <div className="bg-green-600/20 p-3 rounded-lg">
                    <span className="text-green-400 text-2xl">✓</span>
                  </div>
                </div>
              </div>

              {/* Default Payment Method */}
              <div className="bg-pos-darker rounded-lg p-4 sm:p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">الطريقة الافتراضية</p>
                    <p className="text-lg font-bold text-white mt-1">
                      {paymentMethods.find(method => method.is_default === true)?.name || 'غير محدد'}
                    </p>
                  </div>
                  <div className="bg-purple-600/20 p-3 rounded-lg">
                    <span className="text-purple-400 text-2xl">★</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="px-3 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={openAddPaymentMethodModal}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    إضافة طريقة دفع جديدة
                  </button>
                </div>

                <div className="relative w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="البحث في طرق الدفع..."
                    value={paymentMethodSearchTerm}
                    onChange={(e) => setPaymentMethodSearchTerm(e.target.value)}
                    className="bg-gray-700 text-white placeholder-gray-400 pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 md:w-80"
                  />
                  <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Payment Methods Table */}
            <div className="mx-3 sm:mx-6 bg-pos-darker rounded-lg overflow-hidden border border-gray-700">
              <div className="overflow-x-auto">
              <table className="w-full text-sm text-right min-w-[600px]">
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
                            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                              <CreditCardIcon className="h-5 w-5 text-white" />
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
                              onClick={() => openEditPaymentMethodModal(method)}
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
            </div>
          </>
        )}

        <div className="p-3 sm:p-6"></div>
      </div>

      {/* ==================== Modals ==================== */}

      {/* Safe Details Modal */}
      <SafeDetailsModal
        isOpen={isSafeDetailsModalOpen}
        onClose={closeSafeDetails}
        safe={selectedSafe}
      />

      {/* Add Safe Modal */}
      <AddSafeModal
        isOpen={isAddSafeModalOpen}
        onClose={closeAddSafeModal}
        onSafeAdded={handleSafeAdded}
      />

      {/* Edit Safe Modal */}
      <EditSafeModal
        isOpen={isEditSafeModalOpen}
        onClose={closeEditSafeModal}
        onSafeUpdated={handleSafeUpdated}
        safe={safeToEdit}
      />

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        isOpen={isAddPaymentMethodModalOpen}
        onClose={closeAddPaymentMethodModal}
        onPaymentMethodAdded={handlePaymentMethodAdded}
      />

      {/* Edit Payment Method Modal */}
      <EditPaymentMethodModal
        isOpen={isEditPaymentMethodModalOpen}
        onClose={closeEditPaymentMethodModal}
        onPaymentMethodUpdated={handlePaymentMethodUpdated}
        paymentMethod={selectedPaymentMethod}
      />

      {/* Date Filter Modal */}
      <SimpleDateFilterModal
        isOpen={showDateFilterModal}
        onClose={() => setShowDateFilterModal(false)}
        onDateFilterChange={(filter) => setTransactionFilters(prev => ({ ...prev, dateFilter: filter }))}
        currentFilter={transactionFilters.dateFilter}
      />

      {/* Context Menu for Records */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        onClose={closeContextMenu}
        items={createEditContextMenuItems(handleEditTransaction)}
      />

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        isOpen={isEditInvoiceModalOpen}
        onClose={() => {
          setIsEditInvoiceModalOpen(false)
          setTransactionToEdit(null)
        }}
        onInvoiceUpdated={handleInvoiceUpdated}
        saleId={transactionToEdit?.sale_id || null}
        initialRecordId={transactionToEdit?.record_id}
      />
    </div>
  )
}
