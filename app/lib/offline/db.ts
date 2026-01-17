// IndexedDB setup and operations for Offline POS

import {
  OfflineProduct,
  OfflineInventory,
  OfflineBranch,
  OfflineCategory,
  OfflineCustomer,
  OfflineRecord,
  OfflinePaymentMethod,
  PendingSale,
  SyncLogEntry,
  STORE_NAMES,
  META_KEYS
} from './types'

const DB_NAME = 'pos-offline-db'
const DB_VERSION = 1

let dbInstance: IDBDatabase | null = null

// Generate unique device ID
function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Get or create device ID
export async function getDeviceId(): Promise<string> {
  const meta = await getMeta(META_KEYS.DEVICE_ID)
  if (meta) return meta as string

  const deviceId = generateDeviceId()
  await setMeta(META_KEYS.DEVICE_ID, deviceId)
  return deviceId
}

// Open IndexedDB connection
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result

      // Handle connection close
      dbInstance.onclose = () => {
        dbInstance = null
      }

      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Products store
      if (!db.objectStoreNames.contains(STORE_NAMES.PRODUCTS)) {
        const productsStore = db.createObjectStore(STORE_NAMES.PRODUCTS, { keyPath: 'id' })
        productsStore.createIndex('barcode', 'barcode', { unique: false })
        productsStore.createIndex('category_id', 'category_id', { unique: false })
        productsStore.createIndex('name', 'name', { unique: false })
      }

      // Inventory store (composite key: product_id + branch_id)
      if (!db.objectStoreNames.contains(STORE_NAMES.INVENTORY)) {
        const inventoryStore = db.createObjectStore(STORE_NAMES.INVENTORY, { keyPath: ['product_id', 'branch_id'] })
        inventoryStore.createIndex('product_id', 'product_id', { unique: false })
        inventoryStore.createIndex('branch_id', 'branch_id', { unique: false })
      }

      // Branches store
      if (!db.objectStoreNames.contains(STORE_NAMES.BRANCHES)) {
        db.createObjectStore(STORE_NAMES.BRANCHES, { keyPath: 'id' })
      }

      // Categories store
      if (!db.objectStoreNames.contains(STORE_NAMES.CATEGORIES)) {
        const categoriesStore = db.createObjectStore(STORE_NAMES.CATEGORIES, { keyPath: 'id' })
        categoriesStore.createIndex('parent_id', 'parent_id', { unique: false })
      }

      // Customers store
      if (!db.objectStoreNames.contains(STORE_NAMES.CUSTOMERS)) {
        const customersStore = db.createObjectStore(STORE_NAMES.CUSTOMERS, { keyPath: 'id' })
        customersStore.createIndex('phone', 'phone', { unique: false })
        customersStore.createIndex('name', 'name', { unique: false })
      }

      // Records (Safes) store
      if (!db.objectStoreNames.contains(STORE_NAMES.RECORDS)) {
        const recordsStore = db.createObjectStore(STORE_NAMES.RECORDS, { keyPath: 'id' })
        recordsStore.createIndex('branch_id', 'branch_id', { unique: false })
      }

      // Payment methods store
      if (!db.objectStoreNames.contains(STORE_NAMES.PAYMENT_METHODS)) {
        db.createObjectStore(STORE_NAMES.PAYMENT_METHODS, { keyPath: 'id' })
      }

      // Pending sales store
      if (!db.objectStoreNames.contains(STORE_NAMES.PENDING_SALES)) {
        const pendingSalesStore = db.createObjectStore(STORE_NAMES.PENDING_SALES, { keyPath: 'local_id' })
        pendingSalesStore.createIndex('sync_status', 'sync_status', { unique: false })
        pendingSalesStore.createIndex('created_at', 'created_at', { unique: false })
        pendingSalesStore.createIndex('temp_invoice_number', 'temp_invoice_number', { unique: true })
      }

      // Sync log store
      if (!db.objectStoreNames.contains(STORE_NAMES.SYNC_LOG)) {
        const syncLogStore = db.createObjectStore(STORE_NAMES.SYNC_LOG, { keyPath: 'id' })
        syncLogStore.createIndex('local_id', 'local_id', { unique: false })
        syncLogStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Meta store for configuration
      if (!db.objectStoreNames.contains(STORE_NAMES.META)) {
        db.createObjectStore(STORE_NAMES.META, { keyPath: 'key' })
      }
    }
  })
}

// Generic CRUD operations
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await openDatabase()
  const transaction = db.transaction(storeName, mode)
  return transaction.objectStore(storeName)
}

// Get all items from a store
export async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName)
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Get item by key
export async function getByKey<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const store = await getStore(storeName)
  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Get items by index
export async function getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const store = await getStore(storeName)
  const index = store.index(indexName)
  return new Promise((resolve, reject) => {
    const request = index.getAll(value)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Put item (insert or update)
export async function put<T>(storeName: string, item: T): Promise<IDBValidKey> {
  const store = await getStore(storeName, 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put(item)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Put multiple items
export async function putAll<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)

  return new Promise((resolve, reject) => {
    items.forEach(item => store.put(item))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// Delete item by key
export async function deleteByKey(storeName: string, key: IDBValidKey): Promise<void> {
  const store = await getStore(storeName, 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Clear all items from a store
export async function clearStore(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Count items in a store
export async function count(storeName: string): Promise<number> {
  const store = await getStore(storeName)
  return new Promise((resolve, reject) => {
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Meta operations
export async function getMeta(key: string): Promise<unknown> {
  const result = await getByKey<{ key: string; value: unknown }>(STORE_NAMES.META, key)
  return result?.value
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await put(STORE_NAMES.META, { key, value })
}

// Specific operations for Products
export async function getAllProducts(): Promise<OfflineProduct[]> {
  return getAll<OfflineProduct>(STORE_NAMES.PRODUCTS)
}

export async function getProductById(id: string): Promise<OfflineProduct | undefined> {
  return getByKey<OfflineProduct>(STORE_NAMES.PRODUCTS, id)
}

export async function getProductByBarcode(barcode: string): Promise<OfflineProduct | undefined> {
  const products = await getByIndex<OfflineProduct>(STORE_NAMES.PRODUCTS, 'barcode', barcode)
  return products[0]
}

export async function saveProducts(products: OfflineProduct[]): Promise<void> {
  await putAll(STORE_NAMES.PRODUCTS, products)
}

// Specific operations for Inventory
export async function getAllInventory(): Promise<OfflineInventory[]> {
  return getAll<OfflineInventory>(STORE_NAMES.INVENTORY)
}

export async function getInventoryByProduct(productId: string): Promise<OfflineInventory[]> {
  return getByIndex<OfflineInventory>(STORE_NAMES.INVENTORY, 'product_id', productId)
}

export async function getInventoryByBranch(branchId: string): Promise<OfflineInventory[]> {
  return getByIndex<OfflineInventory>(STORE_NAMES.INVENTORY, 'branch_id', branchId)
}

export async function getInventoryForProductAndBranch(productId: string, branchId: string): Promise<OfflineInventory | undefined> {
  return getByKey<OfflineInventory>(STORE_NAMES.INVENTORY, [productId, branchId])
}

export async function saveInventory(inventory: OfflineInventory[]): Promise<void> {
  await putAll(STORE_NAMES.INVENTORY, inventory)
}

export async function updateLocalInventory(productId: string, branchId: string, quantityChange: number): Promise<void> {
  const current = await getInventoryForProductAndBranch(productId, branchId)
  const newQuantity = (current?.quantity || 0) + quantityChange

  await put<OfflineInventory>(STORE_NAMES.INVENTORY, {
    product_id: productId,
    branch_id: branchId,
    quantity: newQuantity, // Allow negative - will be resolved on sync
    updated_at: new Date().toISOString()
  })
}

// Specific operations for Branches
export async function getAllBranches(): Promise<OfflineBranch[]> {
  return getAll<OfflineBranch>(STORE_NAMES.BRANCHES)
}

export async function saveBranches(branches: OfflineBranch[]): Promise<void> {
  await putAll(STORE_NAMES.BRANCHES, branches)
}

// Specific operations for Categories
export async function getAllCategories(): Promise<OfflineCategory[]> {
  return getAll<OfflineCategory>(STORE_NAMES.CATEGORIES)
}

export async function saveCategories(categories: OfflineCategory[]): Promise<void> {
  await putAll(STORE_NAMES.CATEGORIES, categories)
}

// Specific operations for Customers
export async function getAllCustomers(): Promise<OfflineCustomer[]> {
  return getAll<OfflineCustomer>(STORE_NAMES.CUSTOMERS)
}

export async function getCustomerById(id: string): Promise<OfflineCustomer | undefined> {
  return getByKey<OfflineCustomer>(STORE_NAMES.CUSTOMERS, id)
}

export async function saveCustomers(customers: OfflineCustomer[]): Promise<void> {
  await putAll(STORE_NAMES.CUSTOMERS, customers)
}

// Specific operations for Records (Safes)
export async function getAllRecords(): Promise<OfflineRecord[]> {
  return getAll<OfflineRecord>(STORE_NAMES.RECORDS)
}

export async function saveRecords(records: OfflineRecord[]): Promise<void> {
  await putAll(STORE_NAMES.RECORDS, records)
}

// Specific operations for Payment Methods
export async function getAllPaymentMethods(): Promise<OfflinePaymentMethod[]> {
  return getAll<OfflinePaymentMethod>(STORE_NAMES.PAYMENT_METHODS)
}

export async function savePaymentMethods(methods: OfflinePaymentMethod[]): Promise<void> {
  await putAll(STORE_NAMES.PAYMENT_METHODS, methods)
}

// Specific operations for Pending Sales
export async function getAllPendingSales(): Promise<PendingSale[]> {
  return getAll<PendingSale>(STORE_NAMES.PENDING_SALES)
}

export async function getPendingSaleByLocalId(localId: string): Promise<PendingSale | undefined> {
  return getByKey<PendingSale>(STORE_NAMES.PENDING_SALES, localId)
}

export async function getPendingSalesByStatus(status: string): Promise<PendingSale[]> {
  return getByIndex<PendingSale>(STORE_NAMES.PENDING_SALES, 'sync_status', status)
}

export async function savePendingSale(sale: PendingSale): Promise<void> {
  await put(STORE_NAMES.PENDING_SALES, sale)
}

export async function updatePendingSaleStatus(
  localId: string,
  status: PendingSale['sync_status'],
  invoiceNumber?: string,
  error?: string
): Promise<void> {
  const sale = await getPendingSaleByLocalId(localId)
  if (sale) {
    sale.sync_status = status
    if (invoiceNumber) sale.invoice_number = invoiceNumber
    if (status === 'synced') sale.synced_at = new Date().toISOString()
    if (error) {
      sale.sync_error = error
      sale.retry_count = (sale.retry_count || 0) + 1
    }
    await put(STORE_NAMES.PENDING_SALES, sale)
  }
}

export async function deletePendingSale(localId: string): Promise<void> {
  await deleteByKey(STORE_NAMES.PENDING_SALES, localId)
}

export async function getPendingSalesCount(): Promise<number> {
  return count(STORE_NAMES.PENDING_SALES)
}

export async function getPendingSalesCountByStatus(status: string): Promise<number> {
  const sales = await getPendingSalesByStatus(status)
  return sales.length
}

// Sync Log operations
export async function addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const logEntry: SyncLogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  }
  await put(STORE_NAMES.SYNC_LOG, logEntry)
}

export async function getSyncLogForSale(localId: string): Promise<SyncLogEntry[]> {
  return getByIndex<SyncLogEntry>(STORE_NAMES.SYNC_LOG, 'local_id', localId)
}

// Utility to get last sync time
export async function getLastSyncTime(): Promise<string | null> {
  const lastSync = await getMeta(META_KEYS.LAST_SYNC)
  return lastSync as string | null
}

export async function setLastSyncTime(time: string): Promise<void> {
  await setMeta(META_KEYS.LAST_SYNC, time)
}

// Check if database has data
export async function hasOfflineData(): Promise<boolean> {
  const productCount = await count(STORE_NAMES.PRODUCTS)
  return productCount > 0
}

// Clear all offline data
export async function clearAllOfflineData(): Promise<void> {
  const stores = Object.values(STORE_NAMES)
  for (const store of stores) {
    await clearStore(store)
  }
}
