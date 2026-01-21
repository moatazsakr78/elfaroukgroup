'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../supabase/client'
import { DateFilter } from '../../components/SimpleDateFilterModal'
import { getDateRangeFromFilter } from '../utils/dateFilters'
import { calculateCustomerBalanceWithLinked } from '@/app/lib/services/partyLinkingService'

// Statement item type
export interface CustomerStatementItem {
  id: string
  saleId?: string | null
  paymentId?: string | null
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
  index?: number
}

// Cursor for pagination
interface Cursor {
  created_at: string
  id: string
}

// Options for the hook
export interface UseInfiniteCustomerStatementOptions {
  customerId?: string | null
  dateFilter?: DateFilter
  enabled?: boolean
  pageSize?: number
}

// Return type for the hook
export interface UseInfiniteCustomerStatementReturn {
  statements: CustomerStatementItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  error: Error | null
  totalLoaded: number
  currentBalance: number
}

export function useInfiniteCustomerStatement(
  options: UseInfiniteCustomerStatementOptions
): UseInfiniteCustomerStatementReturn {
  const {
    customerId,
    dateFilter = { type: 'all' },
    enabled = true,
    pageSize = 200
  } = options

  const [statements, setStatements] = useState<CustomerStatementItem[]>([])
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
    const currentCustomerId = optionsRef.current.customerId
    const currentDateFilter = optionsRef.current.dateFilter || { type: 'all' }

    if (!currentCustomerId) return { statements: [], hasMore: false, newBalance: currentRunningBalance }

    const { startDate, endDate } = getDateRangeFromFilter(currentDateFilter)

    // Fetch sales (newest first)
    let salesQuery = supabase
      .from('sales')
      .select(`
        id, invoice_number, total_amount, invoice_type, created_at, time,
        record:records(name),
        cashier:user_profiles(full_name)
      `)
      .eq('customer_id', currentCustomerId)

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

    const { data: salesData, error: salesError } = await salesQuery

    if (salesError) throw salesError

    // Fetch payments (newest first)
    let paymentsQuery = supabase
      .from('customer_payments')
      .select(`
        id, amount, notes, created_at, payment_date, safe_id, sale_id,
        creator:user_profiles(full_name)
      `)
      .eq('customer_id', currentCustomerId)
      .is('sale_id', null) // Only standalone payments

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

    // Get cash drawer transactions for sales to get actual paid amounts
    const saleIds = salesData?.map(s => s.id) || []
    let paidAmountsMap = new Map<string, number>()
    let saleTransactionsMap = new Map<string, any>()

    if (saleIds.length > 0) {
      const { data: transactionsData } = await supabase
        .from('cash_drawer_transactions')
        .select(`
          sale_id, amount, performed_by,
          record:records(name)
        `)
        .in('sale_id', saleIds)
        .eq('transaction_type', 'sale')

      if (transactionsData) {
        for (const tx of transactionsData) {
          if (tx.sale_id) {
            paidAmountsMap.set(tx.sale_id, tx.amount || 0)
            saleTransactionsMap.set(tx.sale_id, tx)
          }
        }
      }

      // Also check for linked payments
      const { data: linkedPayments } = await supabase
        .from('customer_payments')
        .select('sale_id, amount')
        .in('sale_id', saleIds)

      if (linkedPayments) {
        linkedPayments.forEach(payment => {
          if (payment.sale_id) {
            const existing = paidAmountsMap.get(payment.sale_id) || 0
            paidAmountsMap.set(payment.sale_id, existing + (payment.amount || 0))
          }
        })
      }
    }

    // Build combined statement items
    const items: Array<{ item: any; type: 'sale' | 'payment'; date: Date }> = []

    // Add sales
    salesData?.forEach(sale => {
      items.push({
        item: sale,
        type: 'sale',
        date: new Date(sale.created_at)
      })
    })

    // Add standalone payments
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
    // Since we're displaying newest first, we need to work backwards from current balance
    let balance = currentRunningBalance
    const statementItems: CustomerStatementItem[] = []

    pageItems.forEach((item, index) => {
      if (item.type === 'sale') {
        const sale = item.item
        const isReturn = sale.invoice_type === 'Sale Return'
        const invoiceAmount = Math.abs(sale.total_amount)
        const paidAmount = Math.abs(paidAmountsMap.get(sale.id) || 0)
        const saleTx = saleTransactionsMap.get(sale.id)

        // Net effect on balance
        const hasPaidAmount = paidAmount > 0
        let operationType: string
        if (isReturn) {
          operationType = hasPaidAmount ? 'مرتجع بيع - دفعة' : 'مرتجع بيع'
        } else {
          operationType = hasPaidAmount ? 'فاتورة بيع - دفعة' : 'فاتورة بيع'
        }

        // Calculate what balance change this transaction caused
        const netAmount = isReturn
          ? -invoiceAmount + paidAmount
          : invoiceAmount - paidAmount

        // Balance AFTER this transaction
        const balanceAfter = balance

        // Balance BEFORE this transaction (for next iteration going backwards)
        balance = balance - netAmount

        statementItems.push({
          id: `sale-${sale.id}`,
          saleId: sale.id,
          date: item.date,
          description: `فاتورة ${sale.invoice_number}`,
          type: operationType,
          amount: netAmount,
          invoiceValue: invoiceAmount,
          paidAmount: paidAmount,
          balance: balanceAfter,
          isNegative: isReturn,
          safe_name: (sale as any).record?.name || saleTx?.record?.name || null,
          employee_name: (sale as any).cashier?.full_name || saleTx?.performed_by || null
        })
      } else {
        const payment = item.item
        const isLoan = payment.notes?.startsWith('سلفة')
        const amount = Math.abs(payment.amount || 0)

        // Payment reduces balance (negative effect on customer debt)
        // Loan increases balance (positive effect on customer debt)
        const netAmount = isLoan ? amount : -amount

        const balanceAfter = balance
        balance = balance - netAmount

        statementItems.push({
          id: `payment-${payment.id}`,
          paymentId: payment.id,
          date: item.date,
          description: isLoan ? `سلفة: ${payment.notes || ''}` : `دفعة: ${payment.notes || ''}`,
          type: isLoan ? 'سلفة' : 'دفعة',
          amount: netAmount,
          invoiceValue: 0,
          paidAmount: amount,
          balance: balanceAfter,
          isNegative: !isLoan,
          safe_name: payment.safe_id ? safesMap.get(payment.safe_id) || null : null,
          employee_name: (payment as any).creator?.full_name || null,
          userNotes: payment.notes || null
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
    if (!enabled || !optionsRef.current.customerId) return

    setIsLoading(true)
    setError(null)
    setHasMore(true)
    setCursor(null)

    try {
      // First, get the current customer balance
      const balanceData = await calculateCustomerBalanceWithLinked(optionsRef.current.customerId)
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
      console.error('Error fetching customer statement:', err)
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
      console.error('Error loading more customer statement:', err)
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
    if (enabled && optionsRef.current.customerId) {
      fetchFirstPage()
    }
  }, [
    enabled,
    customerId,
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

export default useInfiniteCustomerStatement
