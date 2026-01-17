'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase/client'
import {
  saveProducts,
  saveInventory,
  saveBranches,
  saveCategories,
  saveCustomers,
  saveRecords,
  savePaymentMethods,
  getLastSyncTime,
  setLastSyncTime,
  hasOfflineData,
  getAllProducts,
  getAllInventory,
  getAllBranches,
  getAllCategories,
  getAllCustomers,
  getAllRecords,
  getAllPaymentMethods
} from '../offline/db'
import type {
  OfflineProduct,
  OfflineInventory,
  OfflineBranch,
  OfflineCategory,
  OfflineCustomer,
  OfflineRecord,
  OfflinePaymentMethod
} from '../offline/types'

export interface SyncState {
  isSyncing: boolean
  lastSyncTime: string | null
  error: string | null
  progress: {
    current: number
    total: number
    currentTask: string
  }
}

export interface OfflineDataState {
  isReady: boolean
  products: OfflineProduct[]
  inventory: OfflineInventory[]
  branches: OfflineBranch[]
  categories: OfflineCategory[]
  customers: OfflineCustomer[]
  records: OfflineRecord[]
  paymentMethods: OfflinePaymentMethod[]
}

const SYNC_TASKS = [
  'branches',
  'categories',
  'products',
  'inventory',
  'customers',
  'records',
  'paymentMethods'
]

export function useOfflineData() {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncTime: null,
    error: null,
    progress: { current: 0, total: SYNC_TASKS.length, currentTask: '' }
  })

  const [data, setData] = useState<OfflineDataState>({
    isReady: false,
    products: [],
    inventory: [],
    branches: [],
    categories: [],
    customers: [],
    records: [],
    paymentMethods: []
  })

  const syncInProgress = useRef(false)

  // Load data from IndexedDB
  const loadLocalData = useCallback(async () => {
    try {
      const [
        products,
        inventory,
        branches,
        categories,
        customers,
        records,
        paymentMethods,
        lastSync
      ] = await Promise.all([
        getAllProducts(),
        getAllInventory(),
        getAllBranches(),
        getAllCategories(),
        getAllCustomers(),
        getAllRecords(),
        getAllPaymentMethods(),
        getLastSyncTime()
      ])

      setData({
        isReady: products.length > 0,
        products,
        inventory,
        branches,
        categories,
        customers,
        records,
        paymentMethods
      })

      setSyncState(prev => ({ ...prev, lastSyncTime: lastSync }))
    } catch (error) {
      console.error('Failed to load local data:', error)
    }
  }, [])

  // Sync branches from server
  const syncBranches = async (): Promise<void> => {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, is_active')
      .eq('is_active', true)

    if (error) throw new Error(`Failed to sync branches: ${error.message}`)

    const offlineBranches: OfflineBranch[] = branches.map(b => ({
      id: b.id,
      name: b.name,
      is_active: b.is_active
    }))

    await saveBranches(offlineBranches)
  }

  // Sync categories from server
  const syncCategories = async (): Promise<void> => {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, parent_id')

    if (error) throw new Error(`Failed to sync categories: ${error.message}`)

    const offlineCategories: OfflineCategory[] = categories.map(c => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id
    }))

    await saveCategories(offlineCategories)
  }

  // Sync products from server
  const syncProducts = async (): Promise<void> => {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        barcode,
        sku,
        category_id,
        description,
        cost_price,
        price,
        wholesale_price,
        is_active,
        updated_at,
        product_images (image_url, is_primary)
      `)
      .eq('is_active', true)

    if (error) throw new Error(`Failed to sync products: ${error.message}`)

    const offlineProducts: OfflineProduct[] = products.map(p => {
      const primaryImage = p.product_images?.find((img: any) => img.is_primary)
      const firstImage = p.product_images?.[0]

      return {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        sku: p.sku,
        category_id: p.category_id,
        description: p.description,
        cost_price: p.cost_price || 0,
        price: p.price || 0,
        wholesale_price: p.wholesale_price,
        image_url: primaryImage?.image_url || firstImage?.image_url || null,
        is_active: p.is_active,
        updated_at: p.updated_at
      }
    })

    await saveProducts(offlineProducts)
  }

  // Sync inventory from server
  const syncInventory = async (): Promise<void> => {
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('product_id, branch_id, quantity, updated_at')

    if (error) throw new Error(`Failed to sync inventory: ${error.message}`)

    const offlineInventory: OfflineInventory[] = inventory.map(i => ({
      product_id: i.product_id,
      branch_id: i.branch_id,
      quantity: i.quantity || 0,
      updated_at: i.updated_at
    }))

    await saveInventory(offlineInventory)
  }

  // Sync customers from server
  const syncCustomers = async (): Promise<void> => {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, phone, email')
      .limit(1000) // Limit to most recent 1000 customers

    if (error) throw new Error(`Failed to sync customers: ${error.message}`)

    const offlineCustomers: OfflineCustomer[] = customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email
    }))

    await saveCustomers(offlineCustomers)
  }

  // Sync records (safes) from server
  const syncRecords = async (): Promise<void> => {
    const { data: records, error } = await supabase
      .from('records')
      .select('id, name, branch_id')

    if (error) throw new Error(`Failed to sync records: ${error.message}`)

    const offlineRecords: OfflineRecord[] = records.map(r => ({
      id: r.id,
      name: r.name,
      branch_id: r.branch_id
    }))

    await saveRecords(offlineRecords)
  }

  // Sync payment methods from server
  const syncPaymentMethods = async (): Promise<void> => {
    const { data: methods, error } = await supabase
      .from('payment_methods')
      .select('id, name, is_active')
      .eq('is_active', true)

    if (error) throw new Error(`Failed to sync payment methods: ${error.message}`)

    const offlineMethods: OfflinePaymentMethod[] = methods.map(m => ({
      id: m.id,
      name: m.name,
      is_active: m.is_active
    }))

    await savePaymentMethods(offlineMethods)
  }

  // Full sync from server to IndexedDB
  const syncFromServer = useCallback(async (force: boolean = false) => {
    if (syncInProgress.current) {
      console.log('Sync already in progress, skipping...')
      return
    }

    if (!navigator.onLine) {
      console.log('Offline, cannot sync from server')
      return
    }

    // Check if we need to sync
    if (!force) {
      const lastSync = await getLastSyncTime()
      if (lastSync) {
        const lastSyncDate = new Date(lastSync)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        if (lastSyncDate > fiveMinutesAgo) {
          console.log('Data was synced recently, skipping...')
          return
        }
      }
    }

    syncInProgress.current = true
    setSyncState(prev => ({
      ...prev,
      isSyncing: true,
      error: null,
      progress: { current: 0, total: SYNC_TASKS.length, currentTask: '' }
    }))

    try {
      // Sync each data type
      const tasks = [
        { name: 'branches', fn: syncBranches, label: 'الفروع' },
        { name: 'categories', fn: syncCategories, label: 'الفئات' },
        { name: 'products', fn: syncProducts, label: 'المنتجات' },
        { name: 'inventory', fn: syncInventory, label: 'المخزون' },
        { name: 'customers', fn: syncCustomers, label: 'العملاء' },
        { name: 'records', fn: syncRecords, label: 'الخزن' },
        { name: 'paymentMethods', fn: syncPaymentMethods, label: 'طرق الدفع' }
      ]

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i]
        setSyncState(prev => ({
          ...prev,
          progress: { current: i, total: tasks.length, currentTask: task.label }
        }))

        await task.fn()
      }

      // Update last sync time
      const now = new Date().toISOString()
      await setLastSyncTime(now)

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: now,
        progress: { current: SYNC_TASKS.length, total: SYNC_TASKS.length, currentTask: 'تم' }
      }))

      // Reload local data
      await loadLocalData()

      console.log('Offline data sync completed successfully')
    } catch (error: any) {
      console.error('Sync failed:', error)
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: error.message || 'فشل في مزامنة البيانات'
      }))
    } finally {
      syncInProgress.current = false
    }
  }, [loadLocalData])

  // Initial load
  useEffect(() => {
    loadLocalData()
  }, [loadLocalData])

  // Auto-sync when coming online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online, syncing data...')
      syncFromServer()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncFromServer])

  // Get product with inventory for a branch
  const getProductWithStock = useCallback((productId: string, branchId: string) => {
    const product = data.products.find(p => p.id === productId)
    if (!product) return null

    const inventory = data.inventory.find(
      i => i.product_id === productId && i.branch_id === branchId
    )

    return {
      ...product,
      quantity: inventory?.quantity || 0
    }
  }, [data.products, data.inventory])

  // Search products by barcode or name
  const searchProducts = useCallback((query: string, branchId?: string) => {
    const lowerQuery = query.toLowerCase()

    return data.products
      .filter(p => {
        const matchesQuery =
          p.barcode?.toLowerCase().includes(lowerQuery) ||
          p.name.toLowerCase().includes(lowerQuery) ||
          p.sku?.toLowerCase().includes(lowerQuery)

        return matchesQuery
      })
      .map(product => {
        const inventory = branchId
          ? data.inventory.find(i => i.product_id === product.id && i.branch_id === branchId)
          : null

        return {
          ...product,
          quantity: inventory?.quantity || 0
        }
      })
  }, [data.products, data.inventory])

  return {
    data,
    syncState,
    syncFromServer,
    loadLocalData,
    getProductWithStock,
    searchProducts
  }
}

export default useOfflineData
