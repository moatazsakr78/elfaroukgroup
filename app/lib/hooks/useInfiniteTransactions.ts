'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { DateFilter } from '../../components/SimpleDateFilterModal'
import { getDateRangeFromFilter } from '../utils/dateFilters'

// Transaction type for cash drawer transactions
export interface CashDrawerTransaction {
  id: string
  drawer_id: string | null
  record_id: string | null
  transaction_type: string | null
  amount: number | null
  balance_after: number | null
  sale_id: string | null
  notes: string | null
  performed_by: string | null
  created_at: string | null
  payment_method?: string | null
  safe_name?: string
  customer_name?: string
}

// Cursor for pagination - composite cursor using created_at and id
interface Cursor {
  created_at: string
  id: string
}

// Options for the hook
export interface UseInfiniteTransactionsOptions {
  recordIds?: string[] // Filter by safe/record IDs (empty/undefined = all)
  transactionType?: string // Transaction type filter
  paymentMethod?: string // Payment method filter (e.g. 'cash', 'InstaPay')
  dateFilter?: DateFilter // Date range filter
  enabled?: boolean // Enable/disable fetching
  pageSize?: number // Number of records per page (default 200)
  safes?: Array<{ id: string; name: string }> // List of safes for name mapping
  excludeSales?: boolean // If true, only show non-sale transactions (transfers)
}

// Return type for the hook
export interface UseInfiniteTransactionsReturn {
  transactions: CashDrawerTransaction[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  error: Error | null
  totalLoaded: number
}

// Special record ID for "no safe" transactions
const NO_SAFE_RECORD_ID = '00000000-0000-0000-0000-000000000000'

export function useInfiniteTransactions(
  options: UseInfiniteTransactionsOptions
): UseInfiniteTransactionsReturn {
  const {
    recordIds,
    transactionType = 'all',
    paymentMethod: paymentMethodFilter,
    dateFilter = { type: 'all' },
    enabled = true,
    pageSize = 200,
    safes = [],
    excludeSales = false
  } = options

  const [transactions, setTransactions] = useState<CashDrawerTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)

  // Track if initial load has happened
  const initialLoadDone = useRef(false)

  // Ref to track the latest options to avoid stale closures
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Apply safe filter to a query
  const applySafeFilter = useCallback((query: any, ids?: string[]) => {
    if (!ids || ids.length === 0) return query

    const hasNoSafe = ids.includes('no_safe')
    const regularIds = ids.filter(id => id !== 'no_safe')

    if (hasNoSafe && regularIds.length > 0) {
      // Both "no safe" and specific safes
      query = query.or(`record_id.is.null,record_id.eq.${NO_SAFE_RECORD_ID},record_id.in.(${regularIds.join(',')})`)
    } else if (hasNoSafe) {
      // Only "no safe"
      query = query.or(`record_id.is.null,record_id.eq.${NO_SAFE_RECORD_ID}`)
    } else if (regularIds.length === 1) {
      query = query.eq('record_id', regularIds[0])
    } else {
      query = query.in('record_id', regularIds)
    }

    return query
  }, [])

  // Build the base query
  const buildQuery = useCallback(() => {
    let query = supabase
      .from('cash_drawer_transactions')
      .select('*')

    const currentOptions = optionsRef.current
    const { startDate, endDate } = getDateRangeFromFilter(currentOptions.dateFilter || { type: 'all' })

    // Apply safe filter
    query = applySafeFilter(query, currentOptions.recordIds)

    // Apply transaction type filter
    if (currentOptions.transactionType && currentOptions.transactionType !== 'all') {
      if (currentOptions.transactionType === 'transfer') {
        // Filter both transfer_in and transfer_out
        query = query.in('transaction_type', ['transfer_in', 'transfer_out'])
      } else {
        query = query.eq('transaction_type', currentOptions.transactionType)
      }
    }

    // Filter for non-sale transactions only (transfers, deposits, withdrawals)
    if (currentOptions.excludeSales) {
      query = query.is('sale_id', null)
    }

    // Apply payment method filter
    if (currentOptions.paymentMethod && currentOptions.paymentMethod !== 'all') {
      query = query.eq('payment_method', currentOptions.paymentMethod)
    }

    // Apply date filter - this is the key fix!
    // We filter at the database level instead of client-side
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }

    return query
  }, [applySafeFilter])

  // Fetch customer names for transactions with sale_ids
  const fetchCustomerNames = useCallback(async (txs: CashDrawerTransaction[]): Promise<Record<string, string>> => {
    const saleIds = txs
      .filter(tx => tx.sale_id)
      .map(tx => tx.sale_id)
      .filter((id): id is string => id !== null)

    if (saleIds.length === 0) return {}

    const { data: salesData } = await supabase
      .from('sales')
      .select('id, customers:customer_id(name)')
      .in('id', saleIds)

    const customerMap: Record<string, string> = {}
    if (salesData) {
      salesData.forEach((sale: any) => {
        if (sale.customers?.name) {
          customerMap[sale.id] = sale.customers.name
        }
      })
    }

    return customerMap
  }, [])

  // Map safe names to transactions
  const mapSafeNames = useCallback((txs: CashDrawerTransaction[], currentSafes: Array<{ id: string; name: string }>): CashDrawerTransaction[] => {
    return txs.map(tx => {
      // Check if this is a "لا يوجد" record
      if (tx.record_id === null || tx.record_id === NO_SAFE_RECORD_ID) {
        return { ...tx, safe_name: 'لا يوجد' }
      }
      const safe = currentSafes.find(s => s.id === tx.record_id)
      return { ...tx, safe_name: safe?.name || 'غير معروف' }
    })
  }, [])

  // Fetch the first page
  const fetchFirstPage = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)
    setHasMore(true)
    setCursor(null)

    try {
      const query = buildQuery()
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const fetchedData = (data || []) as CashDrawerTransaction[]

      // Fetch customer names
      const customerMap = await fetchCustomerNames(fetchedData)

      // Map safe names and customer names
      const transactionsWithNames = mapSafeNames(fetchedData, safes).map(tx => ({
        ...tx,
        customer_name: tx.sale_id ? customerMap[tx.sale_id] || undefined : undefined
      }))

      setTransactions(transactionsWithNames)

      // Set cursor for next page
      if (fetchedData.length > 0 && fetchedData.length >= pageSize) {
        const lastItem = fetchedData[fetchedData.length - 1]
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
      console.error('Error fetching transactions:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled, buildQuery, pageSize, fetchCustomerNames, mapSafeNames, safes])

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isLoadingMore || !cursor) return

    setIsLoadingMore(true)
    setError(null)

    try {
      // Build the query with cursor-based pagination
      const { startDate, endDate } = getDateRangeFromFilter(optionsRef.current.dateFilter || { type: 'all' })

      let query = supabase
        .from('cash_drawer_transactions')
        .select('*')

      // Apply safe filter
      query = applySafeFilter(query, optionsRef.current.recordIds)

      // Apply transaction type filter
      if (optionsRef.current.transactionType && optionsRef.current.transactionType !== 'all') {
        if (optionsRef.current.transactionType === 'transfer') {
          query = query.in('transaction_type', ['transfer_in', 'transfer_out'])
        } else {
          query = query.eq('transaction_type', optionsRef.current.transactionType)
        }
      }

      // Filter for non-sale transactions only (transfers, deposits, withdrawals)
      if (optionsRef.current.excludeSales) {
        query = query.is('sale_id', null)
      }

      // Apply payment method filter
      if (optionsRef.current.paymentMethod && optionsRef.current.paymentMethod !== 'all') {
        query = query.eq('payment_method', optionsRef.current.paymentMethod)
      }

      // Apply date filter
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString())
      }

      // Apply cursor - records with created_at < cursor OR (created_at = cursor AND id < cursor.id)
      // For descending order, we want records BEFORE the cursor
      query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)

      query = query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize)

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      const fetchedData = (data || []) as CashDrawerTransaction[]

      // Fetch customer names
      const customerMap = await fetchCustomerNames(fetchedData)

      // Map safe names and customer names
      const transactionsWithNames = mapSafeNames(fetchedData, safes).map(tx => ({
        ...tx,
        customer_name: tx.sale_id ? customerMap[tx.sale_id] || undefined : undefined
      }))

      // Append to existing transactions
      setTransactions(prev => [...prev, ...transactionsWithNames])

      // Update cursor for next page
      if (fetchedData.length > 0 && fetchedData.length >= pageSize) {
        const lastItem = fetchedData[fetchedData.length - 1]
        setCursor({
          created_at: lastItem.created_at || '',
          id: lastItem.id
        })
        setHasMore(true)
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Error loading more transactions:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [enabled, hasMore, isLoadingMore, cursor, pageSize, fetchCustomerNames, mapSafeNames, safes, applySafeFilter])

  // Refresh - reset and fetch first page again
  const refresh = useCallback(async () => {
    initialLoadDone.current = false
    await fetchFirstPage()
  }, [fetchFirstPage])

  // Effect to fetch first page when options change
  useEffect(() => {
    if (enabled) {
      // Reset and fetch when filter options change
      fetchFirstPage()
    }
  }, [
    enabled,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    recordIds?.join(','),
    transactionType,
    paymentMethodFilter,
    excludeSales,
    dateFilter?.type,
    dateFilter?.startDate?.toString(),
    dateFilter?.endDate?.toString(),
    safes.length
  ])

  return {
    transactions,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
    totalLoaded: transactions.length
  }
}

export default useInfiniteTransactions
