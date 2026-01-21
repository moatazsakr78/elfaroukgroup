'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { DateFilter } from '../../components/SimpleDateFilterModal'
import { getDateRangeFromFilter } from '../utils/dateFilters'

// Supplier payment type
export interface SupplierPayment {
  id: string
  amount: number | null
  payment_method: string | null
  reference_number: string | null
  notes: string | null
  payment_date: string | null
  created_at: string | null
  created_by: string | null
  safe_id: string | null
  safe_name?: string | null
  employee_name?: string | null
}

// Cursor for pagination
interface Cursor {
  created_at: string
  id: string
}

// Options for the hook
export interface UseInfiniteSupplierPaymentsOptions {
  supplierId?: string | null
  dateFilter?: DateFilter
  enabled?: boolean
  pageSize?: number
}

// Return type for the hook
export interface UseInfiniteSupplierPaymentsReturn {
  payments: SupplierPayment[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  error: Error | null
  totalLoaded: number
}

export function useInfiniteSupplierPayments(
  options: UseInfiniteSupplierPaymentsOptions
): UseInfiniteSupplierPaymentsReturn {
  const {
    supplierId,
    dateFilter = { type: 'all' },
    enabled = true,
    pageSize = 200
  } = options

  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)

  const initialLoadDone = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Fetch safe names for payments
  const fetchSafeNames = useCallback(async (safeIds: string[]): Promise<Map<string, string>> => {
    const safesMap = new Map<string, string>()
    if (safeIds.length === 0) return safesMap

    const { data: safesData } = await supabase
      .from('records')
      .select('id, name')
      .in('id', safeIds)

    if (safesData) {
      safesData.forEach(safe => safesMap.set(safe.id, safe.name))
    }

    return safesMap
  }, [])

  // Fetch a page of payments
  const fetchPage = useCallback(async (cursorData: Cursor | null) => {
    const currentSupplierId = optionsRef.current.supplierId
    const currentDateFilter = optionsRef.current.dateFilter || { type: 'all' }

    if (!currentSupplierId) return { data: [], hasMore: false }

    const { startDate, endDate } = getDateRangeFromFilter(currentDateFilter)

    let query = supabase
      .from('supplier_payments')
      .select(`
        id, amount, payment_method, reference_number, notes, payment_date, created_at, created_by, safe_id,
        creator:user_profiles(full_name)
      `)
      .eq('supplier_id', currentSupplierId)

    // Apply date filter
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
    if (!enabled || !optionsRef.current.supplierId) return

    setIsLoading(true)
    setError(null)
    setHasMore(true)
    setCursor(null)

    try {
      const { data: paymentsData, hasMore: moreAvailable } = await fetchPage(null)

      if (paymentsData.length === 0) {
        setPayments([])
        setHasMore(false)
        return
      }

      // Get safe names
      const safeIds = paymentsData.filter((p: any) => p.safe_id).map((p: any) => p.safe_id as string)
      const safesMap = await fetchSafeNames(safeIds)

      // Map payments with safe_name and employee_name
      const paymentsWithInfo = paymentsData.map((payment: any) => ({
        ...payment,
        safe_name: payment.safe_id ? safesMap.get(payment.safe_id) || null : null,
        employee_name: payment.creator?.full_name || null
      }))

      setPayments(paymentsWithInfo)

      // Set cursor for next page
      if (paymentsData.length > 0 && moreAvailable) {
        const lastItem = paymentsData[paymentsData.length - 1]
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
      console.error('Error fetching supplier payments:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setPayments([])
    } finally {
      setIsLoading(false)
    }
  }, [enabled, fetchPage, fetchSafeNames])

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isLoadingMore || !cursor) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const { data: paymentsData, hasMore: moreAvailable } = await fetchPage(cursor)

      if (paymentsData.length === 0) {
        setHasMore(false)
        return
      }

      // Get safe names
      const safeIds = paymentsData.filter((p: any) => p.safe_id).map((p: any) => p.safe_id as string)
      const safesMap = await fetchSafeNames(safeIds)

      // Map payments with safe_name and employee_name
      const paymentsWithInfo = paymentsData.map((payment: any) => ({
        ...payment,
        safe_name: payment.safe_id ? safesMap.get(payment.safe_id) || null : null,
        employee_name: payment.creator?.full_name || null
      }))

      // Append to existing payments
      setPayments(prev => [...prev, ...paymentsWithInfo])

      // Update cursor for next page
      if (paymentsData.length > 0 && moreAvailable) {
        const lastItem = paymentsData[paymentsData.length - 1]
        setCursor({
          created_at: lastItem.created_at || '',
          id: lastItem.id
        })
        setHasMore(true)
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Error loading more supplier payments:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [enabled, hasMore, isLoadingMore, cursor, fetchPage, fetchSafeNames])

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
    payments,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
    totalLoaded: payments.length
  }
}

export default useInfiniteSupplierPayments
