// Types for Offline POS System

export interface OfflineProduct {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  category_id: string | null
  description: string | null
  cost_price: number
  price: number
  wholesale_price: number | null
  image_url: string | null
  is_active: boolean
  updated_at: string
}

export interface OfflineInventory {
  product_id: string
  branch_id: string
  quantity: number
  updated_at: string
}

export interface OfflineBranch {
  id: string
  name: string
  is_active: boolean
}

export interface OfflineCategory {
  id: string
  name: string
  parent_id: string | null
}

export interface OfflineCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
}

export interface OfflineRecord {
  id: string
  name: string
  branch_id: string | null
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface PendingSaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
  discount: number
  branch_id: string
  notes: string | null
  selected_colors?: { [key: string]: number } | null
}

export interface PendingSale {
  local_id: string
  temp_invoice_number: string
  invoice_number: string | null
  invoice_type: 'Sale Invoice' | 'Sale Return'
  total_amount: number
  tax_amount: number
  discount_amount: number
  profit: number
  payment_method: string
  branch_id: string
  branch_name: string
  customer_id: string
  customer_name: string
  record_id: string | null
  record_name: string | null
  notes: string | null
  items: PendingSaleItem[]
  payment_split_data: PaymentEntry[]
  credit_amount: number
  user_id: string | null
  user_name: string | null
  created_at: string  // ISO string - actual time of sale
  synced_at: string | null
  sync_status: SyncStatus
  sync_error: string | null
  retry_count: number
  device_id: string
}

export interface PaymentEntry {
  id: string
  amount: number
  paymentMethodId: string
  paymentMethodName?: string
}

export interface SyncLogEntry {
  id: string
  local_id: string
  action: 'create' | 'sync_success' | 'sync_failed' | 'retry'
  timestamp: string
  details: string | null
  error?: string | null
}

export interface OfflinePaymentMethod {
  id: string
  name: string
  is_active: boolean
}

// IndexedDB Store Names
export const STORE_NAMES = {
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  BRANCHES: 'branches',
  CATEGORIES: 'categories',
  CUSTOMERS: 'customers',
  RECORDS: 'records',
  PAYMENT_METHODS: 'payment_methods',
  PENDING_SALES: 'pending_sales',
  SYNC_LOG: 'sync_log',
  META: 'meta'
} as const

// Meta keys for tracking sync state
export const META_KEYS = {
  LAST_SYNC: 'last_sync',
  DEVICE_ID: 'device_id',
  DB_VERSION: 'db_version'
} as const
