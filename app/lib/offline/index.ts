// Offline Support Module - Export all offline functionality

// Types
export * from './types'

// Database operations
export {
  openDatabase,
  getDeviceId,
  // Products
  getAllProducts,
  getProductById,
  getProductByBarcode,
  saveProducts,
  // Inventory
  getAllInventory,
  getInventoryByProduct,
  getInventoryByBranch,
  getInventoryForProductAndBranch,
  saveInventory,
  updateLocalInventory,
  // Branches
  getAllBranches,
  saveBranches,
  // Categories
  getAllCategories,
  saveCategories,
  // Customers
  getAllCustomers,
  getCustomerById,
  saveCustomers,
  // Records (Safes)
  getAllRecords,
  saveRecords,
  // Payment Methods
  getAllPaymentMethods,
  savePaymentMethods,
  // Pending Sales
  getAllPendingSales,
  getPendingSaleByLocalId,
  getPendingSalesByStatus,
  savePendingSale,
  updatePendingSaleStatus,
  deletePendingSale,
  getPendingSalesCount,
  getPendingSalesCountByStatus,
  // Sync Log
  addSyncLog,
  getSyncLogForSale,
  // Meta
  getLastSyncTime,
  setLastSyncTime,
  hasOfflineData,
  clearAllOfflineData
} from './db'

// Offline Sales
export {
  createOfflineSalesInvoice,
  shouldUseOfflineMode,
  type OfflineCartItem,
  type OfflineInvoiceSelections,
  type CreateOfflineSaleParams,
  type OfflineSaleResult
} from './offlineSales'

// Sync Manager
export {
  syncPendingSales,
  triggerManualSync,
  initSyncManager,
  isSyncInProgress,
  cleanupSyncedSales,
  onSyncComplete,
  type SyncResult
} from './syncManager'
