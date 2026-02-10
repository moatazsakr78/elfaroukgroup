'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { DateFilter } from '../../components/SimpleDateFilterModal'
import { getDateRangeFromFilter } from '../utils/dateFilters'
import { calculateSupplierBalanceWithLinked } from '@/app/lib/services/partyLinkingService'

// Statement item type
export interface SupplierStatementItem {
  id: string
  purchaseId?: string | null
  paymentId?: string | null
  invoiceId?: string | null  // Alias for purchaseId (for backwards compatibility)
  saleId?: string | null  // For linked customer sales
  customerPaymentId?: string | null  // For linked customer payments
  date: Date
  description: string
  type: string
  amount: number
  invoiceValue: number
  paidAmount: number
  balance: number
  isNegative: boolean
  safe_name?: string | null
  employee_name?: string | null
  payment_method?: string | null
  userNotes?: string | null
  notes?: string | null  // Alias for userNotes (for backwards compatibility)
  index?: number
}

// Cursor for pagination
interface Cursor {
  created_at: string
  id: string
}

// Options for the hook
export interface UseInfiniteSupplierStatementOptions {
  supplierId?: string | null
  dateFilter?: DateFilter
  enabled?: boolean
  pageSize?: number
}

// Return type for the hook
export interface UseInfiniteSupplierStatementReturn {
  statements: SupplierStatementItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  error: Error | null
  totalLoaded: number
  currentBalance: number
}

export function useInfiniteSupplierStatement(
  options: UseInfiniteSupplierStatementOptions
): UseInfiniteSupplierStatementReturn {
  const {
    supplierId,
    dateFilter = { type: 'all' },
    enabled = true,
    pageSize = 200
  } = options

  const [statements, setStatements] = useState<SupplierStatementItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [currentBalance, setCurrentBalance] = useState<number>(0)
  const [runningBalance, setRunningBalance] = useState<number>(0)

  const initialLoadDone = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Fetch safe names
  const fetchSafeNames = useCallback(async (safeIds: string[]): Promise<Map<string, string>> => {
    const safesMap = new Map<string, string>()
    if (safeIds.length === 0) return safesMap

    const { data } = await supabase
      .from('records')
      .select('id, name')
      .in('id', safeIds)

    if (data) {
      data.forEach(safe => safesMap.set(safe.id, safe.name))
    }

    return safesMap
  }, [])

  // Fetch a page of statement data
  const fetchPage = useCallback(async (cursorData: Cursor | null, currentRunningBalance: number) => {
    const currentSupplierId = optionsRef.current.supplierId
    const currentDateFilter = optionsRef.current.dateFilter || { type: 'all' }

    if (!currentSupplierId) return { statements: [], hasMore: false, newBalance: currentRunningBalance }

    const { startDate, endDate } = getDateRangeFromFilter(currentDateFilter)

    // Get supplier's linked customer
    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('linked_customer_id')
      .eq('id', currentSupplierId)
      .single()
    const linkedCustomerId = supplierData?.linked_customer_id

    // Fetch purchase invoices (newest first)
    let purchasesQuery = supabase
      .from('purchase_invoices')
      .select(`
        id, invoice_number, total_amount, invoice_type, created_at,
        record:records(name),
        creator:user_profiles(full_name)
      `)
      .eq('supplier_id', currentSupplierId)

    if (startDate) {
      purchasesQuery = purchasesQuery.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      purchasesQuery = purchasesQuery.lte('created_at', endDate.toISOString())
    }
    if (cursorData) {
      purchasesQuery = purchasesQuery.or(`created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`)
    }

    purchasesQuery = purchasesQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    const { data: purchasesData, error: purchasesError } = await purchasesQuery

    if (purchasesError) throw purchasesError

    // Get purchase IDs and fetch linked payments
    const purchaseIds = purchasesData?.map(p => p.id) || []
    let paidAmountsMap = new Map<string, number>()
    const purchasePaymentMethodMap = new Map<string, string>()

    if (purchaseIds.length > 0) {
      // Fetch payments linked to purchase invoices
      const { data: linkedPayments } = await supabase
        .from('supplier_payments')
        .select('purchase_invoice_id, amount, payment_method')
        .in('purchase_invoice_id', purchaseIds)

      if (linkedPayments) {
        linkedPayments.forEach(payment => {
          if (payment.purchase_invoice_id) {
            const existing = paidAmountsMap.get(payment.purchase_invoice_id) || 0
            paidAmountsMap.set(payment.purchase_invoice_id, existing + Number(payment.amount || 0))
            if (payment.payment_method) {
              purchasePaymentMethodMap.set(payment.purchase_invoice_id, payment.payment_method)
            }
          }
        })
      }
    }

    // Fetch standalone payments (not linked to invoices) - newest first
    let paymentsQuery = supabase
      .from('supplier_payments')
      .select(`
        id, amount, payment_method, notes, created_at, payment_date, safe_id,
        creator:user_profiles(full_name)
      `)
      .eq('supplier_id', currentSupplierId)
      .is('purchase_invoice_id', null)  // Only standalone payments

    if (startDate) {
      paymentsQuery = paymentsQuery.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      paymentsQuery = paymentsQuery.lte('created_at', endDate.toISOString())
    }
    if (cursorData) {
      paymentsQuery = paymentsQuery.or(`created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`)
    }

    paymentsQuery = paymentsQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    const { data: paymentsData, error: paymentsError } = await paymentsQuery

    if (paymentsError) throw paymentsError

    // Fetch sales from linked customer (if any)
    let salesData: any[] = []
    if (linkedCustomerId) {
      let salesQuery = supabase
        .from('sales')
        .select(`
          id, invoice_number, total_amount, payment_method, invoice_type, created_at, time,
          record:records(name),
          cashier:user_profiles(full_name)
        `)
        .eq('customer_id', linkedCustomerId)

      if (startDate) {
        salesQuery = salesQuery.gte('created_at', startDate.toISOString())
      }
      if (endDate) {
        salesQuery = salesQuery.lte('created_at', endDate.toISOString())
      }
      if (cursorData) {
        salesQuery = salesQuery.or(`created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`)
      }

      salesQuery = salesQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      const { data, error: salesError } = await salesQuery
      if (salesError) throw salesError
      salesData = data || []
    }

    // Fetch customer payments from linked customer (if any)
    let customerPaymentsData: any[] = []
    if (linkedCustomerId) {
      let customerPaymentsQuery = supabase
        .from('customer_payments')
        .select(`
          id, amount, payment_method, notes, created_at, payment_date, safe_id,
          creator:user_profiles(full_name)
        `)
        .eq('customer_id', linkedCustomerId)
        .is('sale_id', null)  // Standalone payments only

      if (startDate) {
        customerPaymentsQuery = customerPaymentsQuery.gte('created_at', startDate.toISOString())
      }
      if (endDate) {
        customerPaymentsQuery = customerPaymentsQuery.lte('created_at', endDate.toISOString())
      }
      if (cursorData) {
        customerPaymentsQuery = customerPaymentsQuery.or(`created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`)
      }

      customerPaymentsQuery = customerPaymentsQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      const { data, error: customerPaymentsError } = await customerPaymentsQuery
      if (customerPaymentsError) throw customerPaymentsError
      customerPaymentsData = data || []
    }

    // Get safe names for payments (both supplier and customer payments)
    const paymentSafeIds = [
      ...(paymentsData || []).filter(p => p.safe_id).map(p => p.safe_id as string),
      ...customerPaymentsData.filter(p => p.safe_id).map(p => p.safe_id as string)
    ]
    const safesMap = await fetchSafeNames(paymentSafeIds)

    // Build combined statement items
    const items: Array<{ item: any; type: 'purchase' | 'payment' | 'sale' | 'customerPayment'; date: Date }> = []

    // Add purchases
    purchasesData?.forEach(purchase => {
      items.push({
        item: purchase,
        type: 'purchase',
        date: new Date(purchase.created_at)
      })
    })

    // Add supplier payments
    paymentsData?.forEach(payment => {
      items.push({
        item: payment,
        type: 'payment',
        date: new Date(payment.created_at)
      })
    })

    // Add sales from linked customer
    salesData.forEach(sale => {
      items.push({
        item: sale,
        type: 'sale',
        date: new Date(sale.created_at)
      })
    })

    // Add customer payments from linked customer
    customerPaymentsData.forEach(payment => {
      items.push({
        item: payment,
        type: 'customerPayment',
        date: new Date(payment.created_at)
      })
    })

    // Sort by date descending (newest first)
    items.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Take only pageSize items
    const pageItems = items.slice(0, pageSize)

    // Build statement items with running balance
    let balance = currentRunningBalance
    const statementItems: SupplierStatementItem[] = []

    pageItems.forEach((item, index) => {
      if (item.type === 'purchase') {
        const purchase = item.item
        const isReturn = purchase.invoice_type === 'Purchase Return'
        const invoiceAmount = Math.abs(purchase.total_amount)

        // Get paid amount from the map (linked payments)
        const paidAmount = Math.abs(paidAmountsMap.get(purchase.id) || 0)
        const hasPaidAmount = paidAmount > 0

        // Determine operation type based on whether there's a payment
        let operationType: string
        if (isReturn) {
          operationType = hasPaidAmount ? 'مرتجع شراء - دفعة' : 'مرتجع شراء'
        } else {
          operationType = hasPaidAmount ? 'فاتورة شراء - دفعة' : 'فاتورة شراء'
        }

        // Purchase increases supplier balance (we owe them more)
        // Return decreases supplier balance (we owe them less)
        // Payment reduces the effect
        const netAmount = isReturn
          ? -invoiceAmount + paidAmount
          : invoiceAmount - paidAmount

        const balanceAfter = balance
        balance = balance - netAmount

        statementItems.push({
          id: `purchase-${purchase.id}`,
          purchaseId: purchase.id,
          invoiceId: purchase.id,  // Alias for purchaseId
          date: item.date,
          description: `فاتورة ${purchase.invoice_number}`,
          type: operationType,
          amount: netAmount,
          invoiceValue: invoiceAmount,
          paidAmount: paidAmount,
          balance: balanceAfter,
          isNegative: isReturn,
          safe_name: (purchase as any).record?.name || null,
          employee_name: (purchase as any).creator?.full_name || null,
          payment_method: purchasePaymentMethodMap.get(purchase.id) || null,
          notes: (purchase as any).notes || null
        })
      } else if (item.type === 'payment') {
        const payment = item.item
        const amount = Math.abs(payment.amount || 0)

        // Payment reduces supplier balance (we owe them less)
        const netAmount = -amount

        const balanceAfter = balance
        balance = balance - netAmount

        statementItems.push({
          id: `payment-${payment.id}`,
          paymentId: payment.id,
          date: item.date,
          description: `دفعة: ${payment.notes || ''}`,
          type: 'دفعة',
          amount: netAmount,
          invoiceValue: 0,
          paidAmount: amount,
          balance: balanceAfter,
          isNegative: true,
          safe_name: payment.safe_id ? safesMap.get(payment.safe_id) || null : null,
          employee_name: (payment as any).creator?.full_name || null,
          payment_method: payment.payment_method || null,
          userNotes: payment.notes || null,
          notes: payment.notes || null
        })
      } else if (item.type === 'sale') {
        const sale = item.item
        const isReturn = sale.invoice_type === 'Sale Return'
        const invoiceAmount = Math.abs(sale.total_amount)

        const operationType = isReturn ? 'مرتجع بيع' : 'فاتورة بيع'

        // Sale from linked customer REDUCES supplier balance
        // Sale Return INCREASES supplier balance
        const netAmount = isReturn ? invoiceAmount : -invoiceAmount

        const balanceAfter = balance
        balance = balance - netAmount

        statementItems.push({
          id: `sale-${sale.id}`,
          saleId: sale.id,
          date: item.date,
          description: `فاتورة ${sale.invoice_number}`,
          type: operationType,
          amount: netAmount,
          invoiceValue: invoiceAmount,
          paidAmount: 0,
          balance: balanceAfter,
          isNegative: !isReturn,
          safe_name: (sale as any).record?.name || null,
          employee_name: (sale as any).cashier?.full_name || null,
          payment_method: sale.payment_method || null
        })
      } else if (item.type === 'customerPayment') {
        const payment = item.item
        const isLoan = payment.notes?.startsWith('سلفة')
        const isDiscount = payment.notes?.startsWith('خصم')
        const amount = Math.abs(payment.amount || 0)

        let operationType: string
        let netAmount: number

        if (isLoan) {
          // سلفة: تزيد ما على العميل = تقلل ما له عند المورد
          operationType = 'إضافة'
          netAmount = -amount  // Reduces supplier balance
        } else if (isDiscount) {
          // خصم: يقلل ما على العميل = يزيد ما له عند المورد
          operationType = 'خصم'
          netAmount = amount  // Increases supplier balance
        } else {
          // دفعة: تقلل ما على العميل = تزيد ما له عند المورد
          operationType = 'دفعة عميل'
          netAmount = amount  // Increases supplier balance
        }

        const balanceAfter = balance
        balance = balance - netAmount

        statementItems.push({
          id: `customer-payment-${payment.id}`,
          customerPaymentId: payment.id,
          date: item.date,
          description: isLoan
            ? `إضافة: ${payment.notes?.replace(/^سلفة\s*-?\s*/, '') || ''}`
            : isDiscount
              ? `خصم: ${payment.notes?.replace(/^خصم\s*-?\s*/, '') || ''}`
              : `دفعة عميل: ${payment.notes || ''}`,
          type: operationType,
          amount: netAmount,
          invoiceValue: 0,
          paidAmount: amount,
          balance: balanceAfter,
          isNegative: isLoan,
          safe_name: payment.safe_id ? safesMap.get(payment.safe_id) || null : null,
          employee_name: (payment as any).creator?.full_name || null,
          payment_method: payment.payment_method || null,
          userNotes: payment.notes || null,
          notes: payment.notes || null
        })
      }
    })

    const hasMoreData = items.length >= pageSize

    return {
      statements: statementItems,
      hasMore: hasMoreData,
      newBalance: balance
    }
  }, [pageSize, fetchSafeNames])

  // Fetch the first page
  const fetchFirstPage = useCallback(async () => {
    if (!enabled || !optionsRef.current.supplierId) return

    setIsLoading(true)
    setError(null)
    setHasMore(true)
    setCursor(null)

    try {
      // First, get the current supplier balance
      const balanceData = await calculateSupplierBalanceWithLinked(optionsRef.current.supplierId)
      const balance = balanceData.balance
      setCurrentBalance(balance)

      // Fetch first page with current balance
      const { statements: statementsData, hasMore: moreAvailable, newBalance } = await fetchPage(null, balance)

      setStatements(statementsData)
      setRunningBalance(newBalance)

      // Set cursor for next page
      if (statementsData.length > 0 && moreAvailable) {
        const lastItem = statementsData[statementsData.length - 1]
        setCursor({
          created_at: lastItem.date.toISOString(),
          id: lastItem.id
        })
        setHasMore(true)
      } else {
        setHasMore(false)
      }

      initialLoadDone.current = true
    } catch (err) {
      console.error('Error fetching supplier statement:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setStatements([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled, fetchPage])

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isLoadingMore || !cursor) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const { statements: statementsData, hasMore: moreAvailable, newBalance } = await fetchPage(cursor, runningBalance)

      if (statementsData.length === 0) {
        setHasMore(false)
        return
      }

      // Append to existing statements
      setStatements(prev => [...prev, ...statementsData])
      setRunningBalance(newBalance)

      // Update cursor for next page
      if (statementsData.length > 0 && moreAvailable) {
        const lastItem = statementsData[statementsData.length - 1]
        setCursor({
          created_at: lastItem.date.toISOString(),
          id: lastItem.id
        })
        setHasMore(true)
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Error loading more supplier statement:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [enabled, hasMore, isLoadingMore, cursor, fetchPage, runningBalance])

  // Refresh - reset and fetch first page again
  const refresh = useCallback(async () => {
    initialLoadDone.current = false
    await fetchFirstPage()
  }, [fetchFirstPage])

  // Effect to fetch first page when options change
  useEffect(() => {
    if (enabled && optionsRef.current.supplierId) {
      fetchFirstPage()
    }
  }, [
    enabled,
    supplierId,
    dateFilter?.type,
    dateFilter?.startDate?.toString(),
    dateFilter?.endDate?.toString()
  ])

  return {
    statements,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
    totalLoaded: statements.length,
    currentBalance
  }
}

export default useInfiniteSupplierStatement
