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

    // Fetch payments (newest first)
    let paymentsQuery = supabase
      .from('supplier_payments')
      .select(`
        id, amount, notes, created_at, payment_date, safe_id,
        creator:user_profiles(full_name)
      `)
      .eq('supplier_id', currentSupplierId)

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

    // Get safe names for payments
    const paymentSafeIds = (paymentsData || []).filter(p => p.safe_id).map(p => p.safe_id as string)
    const safesMap = await fetchSafeNames(paymentSafeIds)

    // Build combined statement items
    const items: Array<{ item: any; type: 'purchase' | 'payment'; date: Date }> = []

    // Add purchases
    purchasesData?.forEach(purchase => {
      items.push({
        item: purchase,
        type: 'purchase',
        date: new Date(purchase.created_at)
      })
    })

    // Add payments
    paymentsData?.forEach(payment => {
      items.push({
        item: payment,
        type: 'payment',
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

        const operationType = isReturn ? 'مرتجع شراء' : 'فاتورة شراء'

        // Purchase increases supplier balance (we owe them more)
        // Return decreases supplier balance (we owe them less)
        const netAmount = isReturn ? -invoiceAmount : invoiceAmount

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
          paidAmount: 0,
          balance: balanceAfter,
          isNegative: isReturn,
          safe_name: (purchase as any).record?.name || null,
          employee_name: (purchase as any).creator?.full_name || null,
          notes: (purchase as any).notes || null
        })
      } else {
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
