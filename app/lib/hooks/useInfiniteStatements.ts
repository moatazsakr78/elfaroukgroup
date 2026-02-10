'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { DateFilter } from '../../components/SimpleDateFilterModal'
import { getDateRangeFromFilter } from '../utils/dateFilters'

// Statement item type
export interface StatementItem {
  id: string
  sale_id?: string | null
  date: string
  time: string
  description: string
  type: string
  paidAmount: number
  invoiceValue: number
  balance: number
  created_at: string
  isPositive: boolean
  employee_name?: string | null
  payment_method?: string | null
  index?: number
}

// Cursor for pagination
interface Cursor {
  created_at: string
  id: string
}

// Options for the hook
export interface UseInfiniteStatementsOptions {
  recordId?: string | null // Safe/record ID
  dateFilter?: DateFilter // Date range filter
  enabled?: boolean // Enable/disable fetching
  pageSize?: number // Number of records per page (default 200)
}

// Return type for the hook
export interface UseInfiniteStatementsReturn {
  statements: StatementItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  error: Error | null
  totalLoaded: number
}

export function useInfiniteStatements(
  options: UseInfiniteStatementsOptions
): UseInfiniteStatementsReturn {
  const {
    recordId,
    dateFilter = { type: 'today' },
    enabled = true,
    pageSize = 200
  } = options

  const [statements, setStatements] = useState<StatementItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)

  // Track if initial load has happened
  const initialLoadDone = useRef(false)

  // Ref to track the latest options
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Process transaction data into statement format
  const processTransactionToStatement = useCallback((
    tx: any,
    salesMap: Map<string, any>,
    index: number
  ): StatementItem => {
    const amount = parseFloat(String(tx.amount || 0)) || 0
    const balanceAfter = parseFloat(String(tx.balance_after || 0)) || 0

    let typeName = 'دفعة'
    let description = tx.notes || typeName
    let invoiceValue = 0
    const isPositive = amount >= 0

    // Check if this transaction is linked to a sale
    if (tx.sale_id && salesMap.has(tx.sale_id)) {
      const sale = salesMap.get(tx.sale_id)
      invoiceValue = parseFloat(String(sale.total_amount || 0)) || 0

      // Determine type based on sale invoice_type
      if (sale.invoice_type === 'Sale Return') {
        typeName = 'مرتجع بيع'
      } else {
        typeName = 'فاتورة بيع'
      }

      // Check if this is a payment only (دفعة)
      if (sale.notes && sale.notes.includes('دفعة')) {
        typeName = 'دفعة'
      }

      description = `${typeName} - ${sale.invoice_number}`
    } else {
      // Non-sale transaction
      if (tx.transaction_type === 'withdrawal') {
        typeName = 'سحب'
      } else if (tx.transaction_type === 'adjustment') {
        typeName = 'تسوية'
      } else if (tx.transaction_type === 'deposit') {
        typeName = 'إيداع'
      } else if (tx.transaction_type === 'return') {
        typeName = 'مرتجع بيع'
      } else if (tx.transaction_type === 'transfer_out') {
        typeName = 'تحويل'
      } else if (tx.transaction_type === 'transfer_in') {
        typeName = 'تحويل'
      }
      description = tx.notes || typeName
    }

    const createdDate = tx.created_at ? new Date(tx.created_at) : new Date()

    // Get employee name from sale if available
    const saleData = tx.sale_id ? salesMap.get(tx.sale_id) : null
    const employeeName = saleData?.cashier?.full_name || tx.performed_by || null

    // Get payment method - prefer from transaction, fallback to sale
    const salePaymentMethod = saleData?.payment_method || null
    const paymentMethod = tx.payment_method || salePaymentMethod || null

    return {
      id: tx.id,
      sale_id: tx.sale_id || null,
      date: createdDate.toLocaleDateString('en-GB'),
      time: createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      description,
      type: typeName,
      paidAmount: Math.abs(amount),
      invoiceValue: Math.abs(invoiceValue),
      balance: balanceAfter,
      created_at: tx.created_at || new Date().toISOString(),
      isPositive,
      employee_name: employeeName,
      payment_method: paymentMethod,
      index: index + 1
    }
  }, [])

  // Fetch sales map for a list of sale_ids
  const fetchSalesMap = useCallback(async (saleIds: string[]): Promise<Map<string, any>> => {
    const salesMap = new Map()
    if (saleIds.length === 0) return salesMap

    const { data: salesData } = await supabase
      .from('sales')
      .select(`
        id, invoice_number, total_amount, payment_method, invoice_type, created_at, time, notes,
        cashier:user_profiles(full_name)
      `)
      .in('id', saleIds)

    if (salesData) {
      salesData.forEach((sale: any) => {
        salesMap.set(sale.id, sale)
      })
    }

    return salesMap
  }, [])

  // Fetch a page of transactions
  const fetchPage = useCallback(async (cursorData: Cursor | null, isLoadMore: boolean = false) => {
    const currentRecordId = optionsRef.current.recordId
    const currentDateFilter = optionsRef.current.dateFilter || { type: 'today' }

    if (!currentRecordId) return { data: [], hasMore: false }

    const { startDate, endDate } = getDateRangeFromFilter(currentDateFilter)

    let query = supabase
      .from('cash_drawer_transactions')
      .select('id, sale_id, amount, balance_after, transaction_type, notes, created_at, performed_by, payment_method')
      .eq('record_id', currentRecordId)

    // Apply date filter at database level - THIS IS THE KEY FIX!
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }

    // Apply cursor for pagination (descending order - newest first)
    if (cursorData) {
      query = query.or(`created_at.lt.${cursorData.created_at},and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`)
    }

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize)

    const { data, error } = await query

    if (error) throw error

    return {
      data: data || [],
      hasMore: (data || []).length >= pageSize
    }
  }, [pageSize])

  // Fetch the first page
  const fetchFirstPage = useCallback(async () => {
    if (!enabled || !optionsRef.current.recordId) return

    setIsLoading(true)
    setError(null)
    setHasMore(true)
    setCursor(null)

    try {
      const { data: transactionsData, hasMore: moreAvailable } = await fetchPage(null)

      if (transactionsData.length === 0) {
        setStatements([])
        setHasMore(false)
        return
      }

      // Get unique sale_ids
      const saleIds = transactionsData
        .filter((tx: any) => tx.sale_id)
        .map((tx: any) => tx.sale_id)

      // Fetch sales data
      const salesMap = await fetchSalesMap(saleIds)

      // Process transactions into statements
      const processedStatements = transactionsData.map((tx: any, index: number) =>
        processTransactionToStatement(tx, salesMap, index)
      )

      setStatements(processedStatements)

      // Set cursor for next page
      if (transactionsData.length > 0 && moreAvailable) {
        const lastItem = transactionsData[transactionsData.length - 1]
        setCursor({
          created_at: lastItem.created_at || '',
          id: lastItem.id
        })
        setHasMore(true)
      } else {
        setHasMore(false)
      }

      initialLoadDone.current = true
    } catch (err) {
      console.error('Error fetching statements:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setStatements([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled, fetchPage, fetchSalesMap, processTransactionToStatement])

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isLoadingMore || !cursor) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const { data: transactionsData, hasMore: moreAvailable } = await fetchPage(cursor, true)

      if (transactionsData.length === 0) {
        setHasMore(false)
        return
      }

      // Get unique sale_ids
      const saleIds = transactionsData
        .filter((tx: any) => tx.sale_id)
        .map((tx: any) => tx.sale_id)

      // Fetch sales data
      const salesMap = await fetchSalesMap(saleIds)

      // Process transactions into statements with correct index
      const currentCount = statements.length
      const processedStatements = transactionsData.map((tx: any, index: number) =>
        processTransactionToStatement(tx, salesMap, currentCount + index)
      )

      // Append to existing statements
      setStatements(prev => [...prev, ...processedStatements])

      // Update cursor for next page
      if (transactionsData.length > 0 && moreAvailable) {
        const lastItem = transactionsData[transactionsData.length - 1]
        setCursor({
          created_at: lastItem.created_at || '',
          id: lastItem.id
        })
        setHasMore(true)
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Error loading more statements:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [enabled, hasMore, isLoadingMore, cursor, fetchPage, fetchSalesMap, processTransactionToStatement, statements.length])

  // Refresh - reset and fetch first page again
  const refresh = useCallback(async () => {
    initialLoadDone.current = false
    await fetchFirstPage()
  }, [fetchFirstPage])

  // Effect to fetch first page when options change
  useEffect(() => {
    if (enabled && optionsRef.current.recordId) {
      fetchFirstPage()
    }
  }, [
    enabled,
    recordId,
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
    totalLoaded: statements.length
  }
}

export default useInfiniteStatements
