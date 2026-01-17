'use client'

import { useState, useCallback, useEffect } from 'react'
import { createSalesInvoice, CreateSalesInvoiceParams } from '../invoices/createSalesInvoice'
import {
  createOfflineSalesInvoice,
  shouldUseOfflineMode,
  OfflineCartItem,
  OfflineInvoiceSelections
} from '../offline/offlineSales'
import { useOfflineStatus } from './useOfflineStatus'
import { useOfflineData } from './useOfflineData'

export interface CreateInvoiceResult {
  success: boolean
  invoiceId?: string
  invoiceNumber: string
  totalAmount: number
  message: string
  isOffline: boolean
  localId?: string
}

export function useOfflineSales() {
  const { isOnline, pendingSalesCount, refreshPendingCount } = useOfflineStatus()
  const { syncFromServer, syncState } = useOfflineData()
  const [isCreating, setIsCreating] = useState(false)

  // Sync data when component mounts (if online)
  useEffect(() => {
    if (isOnline) {
      syncFromServer()
    }
  }, [isOnline, syncFromServer])

  /**
   * Create a sales invoice - automatically uses offline mode if needed
   */
  const createInvoice = useCallback(async (
    params: CreateSalesInvoiceParams
  ): Promise<CreateInvoiceResult> => {
    setIsCreating(true)

    try {
      // Check if we should use offline mode
      if (shouldUseOfflineMode()) {
        // Convert params to offline format
        const offlineCartItems: OfflineCartItem[] = params.cartItems.map(item => ({
          product: {
            id: item.product.id,
            name: item.product.name,
            cost_price: item.product.cost_price || 0
          },
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          branch_id: item.branch_id || params.selections.branch?.id || '',
          branch_name: item.branch_name,
          selectedColors: item.selectedColors
        }))

        const offlineSelections: OfflineInvoiceSelections = {
          customer: params.selections.customer ? {
            id: params.selections.customer.id,
            name: params.selections.customer.name
          } : null,
          branch: {
            id: params.selections.branch.id,
            name: params.selections.branch.name
          },
          record: params.selections.record ? {
            id: params.selections.record.id,
            name: params.selections.record.name
          } : null
        }

        const offlineResult = await createOfflineSalesInvoice({
          cartItems: offlineCartItems,
          selections: offlineSelections,
          paymentMethod: params.paymentMethod || 'cash',
          notes: params.notes,
          isReturn: params.isReturn,
          paymentSplitData: params.paymentSplitData?.map(p => ({
            id: p.id,
            amount: p.amount,
            paymentMethodId: p.paymentMethodId
          })),
          creditAmount: params.creditAmount,
          userId: params.userId,
          userName: params.userName
        })

        // Refresh pending count
        refreshPendingCount()

        return {
          success: offlineResult.success,
          invoiceNumber: offlineResult.tempInvoiceNumber,
          totalAmount: offlineResult.totalAmount,
          message: offlineResult.message,
          isOffline: true,
          localId: offlineResult.localId
        }
      }

      // Online mode - use regular createSalesInvoice
      const result = await createSalesInvoice(params)

      return {
        success: result.success,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        totalAmount: result.totalAmount,
        message: result.message,
        isOffline: false
      }
    } catch (error: any) {
      // If online mode fails due to network error, try offline
      if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('fetch')) {
        console.log('Online mode failed, falling back to offline...')

        try {
          const offlineCartItems: OfflineCartItem[] = params.cartItems.map(item => ({
            product: {
              id: item.product.id,
              name: item.product.name,
              cost_price: item.product.cost_price || 0
            },
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            branch_id: item.branch_id || params.selections.branch?.id || '',
            branch_name: item.branch_name,
            selectedColors: item.selectedColors
          }))

          const offlineSelections: OfflineInvoiceSelections = {
            customer: params.selections.customer ? {
              id: params.selections.customer.id,
              name: params.selections.customer.name
            } : null,
            branch: {
              id: params.selections.branch.id,
              name: params.selections.branch.name
            },
            record: params.selections.record ? {
              id: params.selections.record.id,
              name: params.selections.record.name
            } : null
          }

          const offlineResult = await createOfflineSalesInvoice({
            cartItems: offlineCartItems,
            selections: offlineSelections,
            paymentMethod: params.paymentMethod || 'cash',
            notes: params.notes,
            isReturn: params.isReturn,
            paymentSplitData: params.paymentSplitData?.map(p => ({
              id: p.id,
              amount: p.amount,
              paymentMethodId: p.paymentMethodId
            })),
            creditAmount: params.creditAmount,
            userId: params.userId,
            userName: params.userName
          })

          refreshPendingCount()

          return {
            success: offlineResult.success,
            invoiceNumber: offlineResult.tempInvoiceNumber,
            totalAmount: offlineResult.totalAmount,
            message: offlineResult.message + ' (فشل الاتصال)',
            isOffline: true,
            localId: offlineResult.localId
          }
        } catch (offlineError: any) {
          throw offlineError
        }
      }

      throw error
    } finally {
      setIsCreating(false)
    }
  }, [refreshPendingCount])

  return {
    createInvoice,
    isCreating,
    isOnline,
    pendingSalesCount,
    syncState,
    syncFromServer
  }
}

export default useOfflineSales
