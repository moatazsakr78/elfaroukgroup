// Sync Manager - Handles synchronization of offline sales to server

import {
  getPendingSalesByStatus,
  updatePendingSaleStatus,
  addSyncLog,
  deletePendingSale
} from './db'
import type { PendingSale } from './types'

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

export interface SingleSyncResult {
  success: boolean
  localId: string
  invoiceNumber?: string
  error?: string
}

let isSyncing = false
let syncCallbacks: ((result: SyncResult) => void)[] = []

/**
 * Register a callback to be notified when sync completes
 */
export function onSyncComplete(callback: (result: SyncResult) => void): () => void {
  syncCallbacks.push(callback)
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback)
  }
}

/**
 * Notify all registered callbacks
 */
function notifySyncComplete(result: SyncResult) {
  syncCallbacks.forEach(cb => {
    try {
      cb(result)
    } catch (e) {
      console.error('Sync callback error:', e)
    }
  })
}

/**
 * Sync a single sale to the server
 */
async function syncSingleSale(sale: PendingSale): Promise<SingleSyncResult> {
  try {
    // Mark as syncing
    await updatePendingSaleStatus(sale.local_id, 'syncing')

    // Send to server
    const response = await fetch('/api/sync/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sales: [sale]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()

    if (result.success && result.results?.[0]) {
      const syncedSale = result.results[0]

      if (syncedSale.success) {
        // Update local record with server invoice number
        await updatePendingSaleStatus(
          sale.local_id,
          'synced',
          syncedSale.invoice_number
        )

        // Log success
        await addSyncLog({
          local_id: sale.local_id,
          action: 'sync_success',
          details: `تمت المزامنة: ${sale.temp_invoice_number} -> ${syncedSale.invoice_number}`
        })

        return {
          success: true,
          localId: sale.local_id,
          invoiceNumber: syncedSale.invoice_number
        }
      } else {
        throw new Error(syncedSale.error || 'فشل في المزامنة')
      }
    } else {
      throw new Error(result.error || 'استجابة غير صحيحة من السيرفر')
    }
  } catch (error: any) {
    console.error(`Failed to sync sale ${sale.local_id}:`, error)

    // Mark as failed
    await updatePendingSaleStatus(
      sale.local_id,
      'failed',
      undefined,
      error.message
    )

    // Log failure
    await addSyncLog({
      local_id: sale.local_id,
      action: 'sync_failed',
      details: null,
      error: error.message
    })

    return {
      success: false,
      localId: sale.local_id,
      error: error.message
    }
  }
}

/**
 * Sync all pending sales to the server
 * - Syncs in order of created_at (oldest first)
 * - Retries failed sales up to 3 times
 */
export async function syncPendingSales(): Promise<SyncResult> {
  if (isSyncing) {
    console.log('Sync already in progress')
    return { success: false, synced: 0, failed: 0, errors: ['مزامنة قيد التنفيذ'] }
  }

  if (!navigator.onLine) {
    console.log('Cannot sync - offline')
    return { success: false, synced: 0, failed: 0, errors: ['لا يوجد اتصال بالإنترنت'] }
  }

  isSyncing = true
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: []
  }

  try {
    // Get all pending sales
    const pendingSales = await getPendingSalesByStatus('pending')

    // Also retry failed sales with low retry count
    const failedSales = await getPendingSalesByStatus('failed')
    const retryableFailed = failedSales.filter(s => s.retry_count < 3)

    // Combine and sort by created_at (oldest first)
    const salesToSync = [...pendingSales, ...retryableFailed].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    if (salesToSync.length === 0) {
      console.log('No sales to sync')
      return result
    }

    console.log(`Syncing ${salesToSync.length} sales...`)

    // Sync each sale sequentially (to maintain order)
    for (const sale of salesToSync) {
      const syncResult = await syncSingleSale(sale)

      if (syncResult.success) {
        result.synced++
      } else {
        result.failed++
        result.errors.push(`${sale.temp_invoice_number}: ${syncResult.error}`)
      }
    }

    result.success = result.failed === 0

    console.log(`Sync complete: ${result.synced} synced, ${result.failed} failed`)
  } catch (error: any) {
    console.error('Sync error:', error)
    result.success = false
    result.errors.push(error.message || 'خطأ غير متوقع')
  } finally {
    isSyncing = false
    notifySyncComplete(result)
  }

  return result
}

/**
 * Check if sync is currently in progress
 */
export function isSyncInProgress(): boolean {
  return isSyncing
}

/**
 * Delete a synced sale from local storage (cleanup)
 */
export async function cleanupSyncedSales(): Promise<number> {
  const syncedSales = await getPendingSalesByStatus('synced')
  let deleted = 0

  for (const sale of syncedSales) {
    // Keep synced sales for 24 hours before deleting
    const syncedAt = new Date(sale.synced_at || sale.created_at)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    if (syncedAt < oneDayAgo) {
      await deletePendingSale(sale.local_id)
      deleted++
    }
  }

  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} synced sales`)
  }

  return deleted
}

/**
 * Initialize sync manager
 * - Sets up online/offline listeners
 * - Starts periodic sync
 */
export function initSyncManager(): () => void {
  // Sync when coming online
  const handleOnline = () => {
    console.log('Back online - starting sync')
    syncPendingSales()
  }

  window.addEventListener('online', handleOnline)

  // Periodic sync every 5 minutes when online
  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      syncPendingSales()
      cleanupSyncedSales()
    }
  }, 5 * 60 * 1000)

  // Initial sync if online
  if (navigator.onLine) {
    setTimeout(() => syncPendingSales(), 1000)
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
    clearInterval(intervalId)
  }
}

/**
 * Manual sync trigger (for UI button)
 */
export async function triggerManualSync(): Promise<SyncResult> {
  return syncPendingSales()
}
