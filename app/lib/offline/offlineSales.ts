// Offline Sales Invoice Creation

import {
  savePendingSale,
  updateLocalInventory,
  addSyncLog,
  getDeviceId
} from './db'
import type {
  PendingSale,
  PendingSaleItem,
  PaymentEntry
} from './types'

// دالة لإرجاع الوقت بتوقيت القاهرة في صيغة ISO
// Cairo is UTC+2 (Egypt doesn't use DST since 2014)
function getCairoISOString(): string {
  const now = new Date()
  const cairoOffset = 2 * 60 // 2 hours in minutes
  const utcOffset = now.getTimezoneOffset() // Minutes behind UTC (negative for ahead)
  const cairoTime = new Date(now.getTime() + (cairoOffset + utcOffset) * 60000)
  return cairoTime.toISOString()
}

export interface OfflineCartItem {
  product: {
    id: string
    name: string
    cost_price: number
  }
  quantity: number
  price: number
  total: number
  branch_id: string
  branch_name?: string
  selectedColors?: { [key: string]: number } | null
  selectedShapes?: { [key: string]: number } | null
}

export interface OfflineInvoiceSelections {
  customer: {
    id: string
    name: string
  } | null
  branch: {
    id: string
    name: string
  }
  record: {
    id: string
    name: string
  } | null
}

export interface CreateOfflineSaleParams {
  cartItems: OfflineCartItem[]
  selections: OfflineInvoiceSelections
  paymentMethod: string
  notes?: string
  isReturn?: boolean
  paymentSplitData?: PaymentEntry[]
  creditAmount?: number
  userId?: string | null
  userName?: string | null
}

export interface OfflineSaleResult {
  success: boolean
  localId: string
  tempInvoiceNumber: string
  totalAmount: number
  message: string
  isOffline: true
}

// Generate temporary invoice number for offline sales
function generateTempInvoiceNumber(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 4).toUpperCase()
  return `OFF-${timestamp}-${random}`
}

// Generate unique local ID
function generateLocalId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Default customer ID for walk-in customers
const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Create a sales invoice offline
 * - Saves to IndexedDB
 * - Updates local inventory
 * - Returns temporary invoice number
 * - Will be synced when back online
 */
export async function createOfflineSalesInvoice({
  cartItems,
  selections,
  paymentMethod = 'cash',
  notes,
  isReturn = false,
  paymentSplitData = [],
  creditAmount = 0,
  userId = null,
  userName = null
}: CreateOfflineSaleParams): Promise<OfflineSaleResult> {
  // Validate inputs
  if (!selections.branch) {
    throw new Error('يجب تحديد الفرع قبل إنشاء الفاتورة')
  }

  if (!cartItems || cartItems.length === 0) {
    throw new Error('لا يمكن إنشاء فاتورة بدون منتجات')
  }

  // Validate cart items
  for (const item of cartItems) {
    if (!item.product || !item.product.id) {
      throw new Error(`منتج غير صالح في السلة`)
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new Error(`كمية غير صالحة للمنتج ${item.product.name}`)
    }
    if (typeof item.price !== 'number' || item.price < 0) {
      throw new Error(`سعر غير صالح للمنتج ${item.product.name}`)
    }
  }

  try {
    // Generate IDs and numbers
    const localId = generateLocalId()
    const tempInvoiceNumber = generateTempInvoiceNumber()
    const deviceId = await getDeviceId()

    // Calculate totals
    const baseTotal = cartItems.reduce((sum, item) => sum + item.total, 0)
    const totalAmount = isReturn ? -baseTotal : baseTotal
    const taxAmount = 0
    const discountAmount = 0
    const profit = cartItems.reduce((sum, item) => {
      const costPrice = item.product.cost_price || 0
      const itemProfit = (item.price - costPrice) * item.quantity
      return sum + (isReturn ? -itemProfit : itemProfit)
    }, 0)

    // Get customer info
    const customerId = selections.customer?.id || DEFAULT_CUSTOMER_ID
    const customerName = selections.customer?.name || 'عميل نقدي'

    // Prepare sale items for storage
    const saleItems: PendingSaleItem[] = cartItems.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: isReturn ? -item.quantity : item.quantity,
      unit_price: item.price,
      cost_price: item.product.cost_price || 0,
      discount: 0,
      branch_id: item.branch_id || selections.branch.id,
      notes: item.selectedColors && Object.keys(item.selectedColors).length > 0
        ? `الألوان المحددة: ${Object.entries(item.selectedColors)
            .filter(([_, qty]) => qty > 0)
            .map(([color, qty]) => `${color}: ${qty}`)
            .join(', ')}`
        : null,
      selected_colors: item.selectedColors
    }))

    // Create pending sale record
    const pendingSale: PendingSale = {
      local_id: localId,
      temp_invoice_number: tempInvoiceNumber,
      invoice_number: null, // Will be assigned by server after sync
      invoice_type: isReturn ? 'Sale Return' : 'Sale Invoice',
      total_amount: totalAmount,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      profit: profit,
      payment_method: paymentMethod,
      branch_id: selections.branch.id,
      branch_name: selections.branch.name,
      customer_id: customerId,
      customer_name: customerName,
      record_id: selections.record?.id || null,
      record_name: selections.record?.name || null,
      notes: notes || null,
      items: saleItems,
      payment_split_data: paymentSplitData,
      credit_amount: creditAmount,
      user_id: userId,
      user_name: userName,
      created_at: getCairoISOString(), // توقيت القاهرة (UTC+2)
      synced_at: null,
      sync_status: 'pending',
      sync_error: null,
      retry_count: 0,
      device_id: deviceId
    }

    // Save to IndexedDB
    await savePendingSale(pendingSale)

    // Update local inventory
    // For sales: subtract quantity
    // For returns: add quantity back
    for (const item of cartItems) {
      const quantityChange = isReturn ? item.quantity : -item.quantity
      const branchId = item.branch_id || selections.branch.id

      await updateLocalInventory(item.product.id, branchId, quantityChange)
    }

    // Log the creation
    await addSyncLog({
      local_id: localId,
      action: 'create',
      details: `فاتورة ${isReturn ? 'مرتجع' : 'بيع'} offline: ${tempInvoiceNumber}, المبلغ: ${totalAmount}`
    })

    console.log('Offline sale created:', {
      localId,
      tempInvoiceNumber,
      totalAmount,
      itemsCount: cartItems.length
    })

    return {
      success: true,
      localId,
      tempInvoiceNumber,
      totalAmount,
      message: isReturn
        ? 'تم حفظ المرتجع - في انتظار المزامنة'
        : 'تم حفظ الفاتورة - في انتظار المزامنة',
      isOffline: true
    }
  } catch (error: any) {
    console.error('Failed to create offline sale:', error)
    throw new Error(error.message || 'فشل في حفظ الفاتورة offline')
  }
}

/**
 * Check if we should use offline mode
 * Returns true if:
 * - Navigator is offline
 * - Or connection is slow/unreliable
 */
export function shouldUseOfflineMode(): boolean {
  if (typeof navigator === 'undefined') return false
  return !navigator.onLine
}
