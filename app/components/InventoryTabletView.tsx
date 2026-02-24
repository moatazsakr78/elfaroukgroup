'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ProductGridImage } from './ui/OptimizedImage'
import ResizableTable from './tables/ResizableTable'
import Sidebar from './layout/Sidebar'
import TopHeader from './layout/TopHeader'
import AddBranchModal from './AddBranchModal'
import AddStorageModal from './AddStorageModal'
import ManagementModal from './ManagementModal'
import CategoriesTreeView from './CategoriesTreeView'
import ColumnsControlModal from './ColumnsControlModal'
import QuantityAdjustmentModal from './QuantityAdjustmentModal'
import TransferQuantityModal from './TransferQuantityModal'
import { useProductsAdmin } from '@/lib/hooks/useProductsAdmin'
import { useActivityLogger } from '@/app/lib/hooks/useActivityLogger'
import { revalidateProductPage } from '@/lib/utils/revalidate'
import {
  ArrowPathIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon,
  CogIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EyeIcon,
  XMarkIcon,
  Bars3Icon,
  EyeSlashIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  BanknotesIcon,
  PlusIcon,
  MinusIcon,
  CubeIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline'

// Database category interface
interface Category {
  id: string
  name: string
  name_en: string | null
  parent_id: string | null
  image_url: string | null
  is_active: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

interface InventoryTabletViewProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedGroup: string
  setSelectedGroup: (group: string) => void
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  stockStatusFilters: {
    good: boolean
    low: boolean
    zero: boolean
  }
  setStockStatusFilters: React.Dispatch<React.SetStateAction<{good: boolean, low: boolean, zero: boolean}>>
  hasMoreProducts: boolean
  remainingProductsCount: number
  onLoadAllProducts: () => void
}

export default function InventoryTabletView({
  searchQuery,
  setSearchQuery,
  selectedGroup,
  setSelectedGroup,
  isSidebarOpen,
  setIsSidebarOpen,
  stockStatusFilters,
  setStockStatusFilters,
  hasMoreProducts,
  remainingProductsCount,
  onLoadAllProducts
}: InventoryTabletViewProps) {
  const [showBranchesDropdown, setShowBranchesDropdown] = useState(false)
  const [selectedBranches, setSelectedBranches] = useState<{[key: string]: boolean}>({})
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false)
  const [isAddStorageModalOpen, setIsAddStorageModalOpen] = useState(false)
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<any>(null)
  const [isEditingBranch, setIsEditingBranch] = useState(false)
  const [editWarehouse, setEditWarehouse] = useState<any>(null)
  const [isEditingWarehouse, setIsEditingWarehouse] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const [showProductModal, setShowProductModal] = useState(false)
  const [modalProduct, setModalProduct] = useState<any>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<{[key: string]: boolean}>({})
  const [isCategoriesHidden, setIsCategoriesHidden] = useState(true)

  // Performance: Limit visible products
  const VISIBLE_PRODUCTS_LIMIT = 50
  const [showAllProducts, setShowAllProducts] = useState(false)

  // Audit status filters
  const [auditStatusFilters, setAuditStatusFilters] = useState({
    fully_audited: true, // تام الجرد
    ready: true, // استعد
    not_audited: true // غير مجرود
  })

  // Audit branches dropdown
  const [showAuditBranchesDropdown, setShowAuditBranchesDropdown] = useState(false)

  // Ref for scrollable toolbar
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Quantity adjustment modal states
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [quantityModalMode, setQuantityModalMode] = useState<'add' | 'edit' | 'subtract'>('add')
  const [showQuantityDropdown, setShowQuantityDropdown] = useState(false)
  const quantityDropdownRef = useRef<HTMLDivElement>(null)
  const quantityDropdownMenuRef = useRef<HTMLDivElement>(null)
  const [quantityDropdownPos, setQuantityDropdownPos] = useState<{top: number, left: number}>({top: 0, left: 0})
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<any>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Get products and branches data - Using optimized admin hook for better mobile performance
  const { products, setProducts, branches, isLoading, error, fetchProducts } = useProductsAdmin()
  const activityLog = useActivityLogger()

  // OPTIMIZED: Memoized branch toggle handler
  const handleBranchToggle = useCallback((branchId: string) => {
    setSelectedBranches(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }))
  }, [])

  // OPTIMIZED: Memoized refresh handler
  const handleRefresh = useCallback(() => {
    fetchProducts()
  }, [fetchProducts])

  // OPTIMIZED: Memoized stock status toggle handler
  const handleStockStatusToggle = useCallback((status: 'good' | 'low' | 'zero') => {
    setStockStatusFilters(prev => ({
      ...prev,
      [status]: !prev[status]
    }))
  }, [setStockStatusFilters])

  // OPTIMIZED: Memoized columns change handler
  const handleColumnsChange = useCallback((updatedColumns: any[]) => {
    const newVisibleColumns: {[key: string]: boolean} = {}
    updatedColumns.forEach(col => {
      newVisibleColumns[col.id] = col.visible
    })
    setVisibleColumns(newVisibleColumns)
  }, [])

  // Initialize selected branches when branches data loads
  useEffect(() => {
    if (branches.length > 0 && Object.keys(selectedBranches).length === 0) {
      const initialBranches: {[key: string]: boolean} = {}
      branches.forEach(branch => {
        initialBranches[branch.id] = true
      })
      setSelectedBranches(initialBranches)
    }
  }, [branches, selectedBranches])

  // Initialize visible columns state
  useEffect(() => {
    const allColumns = ['index', 'name', 'category', 'totalQuantity', 'cost_price', 'price', 'wholesale_price', 'price1', 'price2', 'price3', 'price4', 'barcode', 'activity']
    
    // Add branch columns
    branches.forEach(branch => {
      allColumns.push(`quantity_${branch.id}`, `lowstock_${branch.id}`, `variants_${branch.id}`)
    })
    
    const initialVisible: {[key: string]: boolean} = {}
    allColumns.forEach(colId => {
      initialVisible[colId] = true
    })
    
    setVisibleColumns(initialVisible)
  }, [branches])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.branches-dropdown')) {
        setShowBranchesDropdown(false)
      }
      if (!target.closest('.audit-branches-dropdown')) {
        setShowAuditBranchesDropdown(false)
      }
      if (!target.closest('.quantity-dropdown') && !target.closest('.quantity-dropdown-menu')) {
        setShowQuantityDropdown(false)
      }
    }

    if (showBranchesDropdown || showAuditBranchesDropdown || showQuantityDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showBranchesDropdown, showAuditBranchesDropdown, showQuantityDropdown])

  // OPTIMIZED: Memoized function to calculate total quantity
  const calculateTotalQuantity = useCallback((item: any) => {
    let totalQuantity = 0
    if (item.inventoryData) {
      Object.entries(item.inventoryData).forEach(([branchId, inventory]: [string, any]) => {
        if (selectedBranches[branchId]) {
          totalQuantity += inventory?.quantity || 0
        }
      })
    }
    return totalQuantity
  }, [selectedBranches])

  // OPTIMIZED: Memoized function to determine stock status
  const getStockStatus = useCallback((item: any) => {
    const totalQuantity = calculateTotalQuantity(item)
    
    if (totalQuantity === 0) return 'zero'
    
    let hasLowStock = false
    if (item.inventoryData) {
      Object.entries(item.inventoryData).forEach(([branchId, inventory]: [string, any]) => {
        if (selectedBranches[branchId]) {
          const quantity = inventory?.quantity || 0
          const minStock = inventory?.min_stock || 0
          if (quantity <= minStock && minStock > 0) {
            hasLowStock = true
          }
        }
      })
    }
    
    return hasLowStock ? 'low' : 'good'
  }, [calculateTotalQuantity, selectedBranches])

  // OPTIMIZED: Generate dynamic table columns with advanced memoization
  const dynamicTableColumns = useMemo(() => {
    const staticColumns = [
    { 
      id: 'index', 
      header: '#', 
      accessor: '#', 
      width: 60,
      render: (value: any, item: any, index: number) => (
        <span className="text-gray-400 font-medium">{index + 1}</span>
      )
    },
    { 
      id: 'name', 
      header: 'اسم المنتج', 
      accessor: 'name', 
      width: 200,
      render: (value: string) => <span className="text-white font-medium">{value}</span>
    },
    { 
      id: 'category', 
      header: 'المجموعة', 
      accessor: 'category', 
      width: 120,
      render: (value: any) => (
        <span className="text-gray-300">
          {value?.name || 'غير محدد'}
        </span>
      )
    },
    { 
      id: 'totalQuantity', 
      header: 'كمية كلية', 
      accessor: 'totalQuantity', 
      width: 120,
      render: (value: any, item: any) => {
        // Calculate total quantity based on selected branches only
        let totalQuantity = 0
        if (item.inventoryData) {
          Object.entries(item.inventoryData).forEach(([branchId, inventory]: [string, any]) => {
            if (selectedBranches[branchId]) {
              totalQuantity += inventory?.quantity || 0
            }
          })
        }
        
        // Determine color based on stock status
        const stockStatus = getStockStatus(item)
        let colorClass = 'text-green-400' // Good - Green
        if (stockStatus === 'low') colorClass = 'text-yellow-400' // Low - Yellow  
        if (stockStatus === 'zero') colorClass = 'text-red-400' // Zero - Red
        
        return (
          <span className={`${colorClass} font-medium`}>قطعة {totalQuantity}</span>
        )
      }
    },
    { 
      id: 'cost_price', 
      header: 'سعر الشراء', 
      accessor: 'cost_price', 
      width: 120,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price', 
      header: 'سعر البيع', 
      accessor: 'price', 
      width: 120,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'wholesale_price', 
      header: 'سعر الجملة', 
      accessor: 'wholesale_price', 
      width: 120,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price1', 
      header: 'سعر 1', 
      accessor: 'price1', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price2', 
      header: 'سعر 2', 
      accessor: 'price2', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price3', 
      header: 'سعر 3', 
      accessor: 'price3', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'price4', 
      header: 'سعر 4', 
      accessor: 'price4', 
      width: 100,
      render: (value: number) => <span className="text-white">{(value || 0).toFixed(2)}</span>
    },
    { 
      id: 'barcode', 
      header: 'الباركود', 
      accessor: 'barcode', 
      width: 150,
      render: (value: string) => <span className="text-gray-300 font-mono text-sm">{value || '-'}</span>
    }
    ]

    // Add dynamic branch quantity columns (only for selected branches)
  const branchQuantityColumns = branches
    .filter(branch => selectedBranches[branch.id])
    .map(branch => ({
      id: `quantity_${branch.id}`,
      header: branch.name,
      accessor: `quantity_${branch.id}`,
      width: 120,
      render: (value: any, item: any) => {
        const inventoryData = item.inventoryData?.[branch.id]
        const quantity = inventoryData?.quantity || 0
        const minStock = inventoryData?.min_stock || 0
        
        // Determine color based on quantity status for this specific branch
        let colorClass = 'text-green-400' // Good - Green
        if (quantity === 0) {
          colorClass = 'text-red-400' // Zero - Red
        } else if (quantity <= minStock && minStock > 0) {
          colorClass = 'text-yellow-400' // Low - Yellow
        }
        
        return (
          <span className={`${colorClass} font-medium`}>
            قطعة {quantity}
          </span>
        )
      }
      }))

    // Add dynamic branch low stock columns (only for selected branches)
  const branchLowStockColumns = branches
    .filter(branch => selectedBranches[branch.id])
    .map(branch => ({
      id: `lowstock_${branch.id}`,
      header: `منخفض - ${branch.name}`,
      accessor: `lowstock_${branch.id}`,
      width: 150,
      render: (value: any, item: any) => {
        const inventoryData = item.inventoryData?.[branch.id]
        const minStock = inventoryData?.min_stock || 0
        const quantity = inventoryData?.quantity || 0
        
        // Show warning style if quantity is below or equal to min stock
        const isLowStock = quantity <= minStock && minStock > 0
        
        return (
          <span className={`font-medium ${isLowStock ? 'text-red-400' : 'text-yellow-400'}`}>
            {minStock} قطعة
          </span>
        )
      }
      }))

      // Add dynamic branch variants columns (only for selected branches)
    const variantColumns = branches
    .filter(branch => selectedBranches[branch.id])
    .map(branch => ({
    id: `variants_${branch.id}`,
    header: `الأشكال والألوان - ${branch.name}`,
    accessor: `variants_${branch.id}`,
    width: 250,
    render: (value: any, item: any) => {
      const variants = item.variantsData?.[branch.id] || []
      const colorVariants = variants.filter((v: any) => v.variant_type === 'color')
      const shapeVariants = variants.filter((v: any) => v.variant_type === 'shape')
      
      // Helper function to get variant color
      const getVariantColor = (variant: any) => {
        if (variant.variant_type === 'color') {
          // Try to find the color from product colors
          const productColor = item.productColors?.find((c: any) => c.name === variant.name)
          if (productColor?.color) {
            return productColor.color
          }
          
          // Try to parse color from variant value if it's JSON
          try {
            if (variant.value && variant.value.startsWith('{')) {
              const valueData = JSON.parse(variant.value)
              if (valueData.color) {
                return valueData.color
              }
            }
          } catch (e) {
            // If parsing fails, use default
          }
        }
        return '#6B7280' // Default gray color
      }

      // Helper function to get text color based on background
      const getTextColor = (bgColor: string) => {
        // Convert hex to RGB
        const hex = bgColor.replace('#', '')
        const r = parseInt(hex.substr(0, 2), 16)
        const g = parseInt(hex.substr(2, 2), 16)
        const b = parseInt(hex.substr(4, 2), 16)
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        
        // Return white for dark colors, black for light colors
        return luminance > 0.5 ? '#000000' : '#FFFFFF'
      }

      // Calculate unassigned quantity
      const totalInventoryQuantity = item.inventoryData?.[branch.id]?.quantity || 0
      const assignedQuantity = [...colorVariants, ...shapeVariants].reduce((sum: number, variant: any) => sum + variant.quantity, 0)
      const unassignedQuantity = totalInventoryQuantity - assignedQuantity

      return (
        <div className="flex flex-wrap gap-1">
          {[...colorVariants, ...shapeVariants].map((variant: any, index: number) => {
            const bgColor = getVariantColor(variant)
            const textColor = getTextColor(bgColor)
            
            return (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  borderColor: bgColor === '#6B7280' ? '#6B7280' : bgColor
                }}
              >
                {variant.name} ({variant.quantity})
              </span>
            )
          })}
          
          {/* Show unassigned quantity if any */}
          {unassignedQuantity > 0 && (
            <span
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white bg-gray-600 border border-gray-600"
            >
              غير محدد ({unassignedQuantity})
            </span>
          )}
        </div>
      )
    }
  }))

    const activityColumn = { 
      id: 'activity', 
      header: 'نشيط', 
      accessor: 'is_active', 
      width: 80,
      render: (value: boolean) => (
        <div className="flex justify-center">
          <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
      )
    }

    // Get count of selected branches
    const selectedBranchesCount = Object.values(selectedBranches).filter(Boolean).length

    // Combine all columns - hide totalQuantity if only one branch is selected
    const allColumns = [
      ...staticColumns.filter(col => {
        // Hide totalQuantity column if only one branch is selected
        if (col.id === 'totalQuantity' && selectedBranchesCount === 1) {
          return false
        }
        return true
      }),
      ...branchQuantityColumns,
      ...branchLowStockColumns,
      ...variantColumns,
      activityColumn
    ]
    
    // Filter columns based on visibility
    return allColumns.filter(col => visibleColumns[col.id] !== false)
  }, [branches, visibleColumns, selectedBranches, calculateTotalQuantity, getStockStatus])

  // OPTIMIZED: Memoized product filtering
  const filteredProducts = useMemo(() => {
    if (!products.length) return []

    return products.filter(item => {
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      const stockStatus = getStockStatus(item)
      return stockStatusFilters[stockStatus as keyof typeof stockStatusFilters]
    })
  }, [products, searchQuery, stockStatusFilters, getStockStatus])

  // PERFORMANCE: Limit visible products to reduce DOM nodes
  const visibleProducts = useMemo(() => {
    const hasActiveFilter = searchQuery
    if (hasActiveFilter || showAllProducts) {
      return filteredProducts
    }
    return filteredProducts.slice(0, VISIBLE_PRODUCTS_LIMIT)
  }, [filteredProducts, searchQuery, showAllProducts])

  const hasMoreProductsLocal = !showAllProducts &&
    !searchQuery &&
    filteredProducts.length > VISIBLE_PRODUCTS_LIMIT

  // Reset showAllProducts when filters change
  useEffect(() => {
    setShowAllProducts(false)
  }, [searchQuery, stockStatusFilters])

  // OPTIMIZED: Memoized columns data preparation
  const getAllColumns = useMemo(() => {
    return dynamicTableColumns.map(col => ({
      id: col.id,
      header: col.header,
      visible: visibleColumns[col.id] !== false
    }))
  }, [dynamicTableColumns, visibleColumns])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleCategorySelect = (category: Category | null) => {
    setSelectedCategory(category)
  }

  // Branch management handlers
  const handleBranchCreated = () => {
    console.log('New branch created successfully')
  }

  const handleWarehouseCreated = () => {
    console.log('New warehouse created successfully')
  }

  const handleEditBranch = (branch: any) => {
    setEditBranch(branch)
    setIsEditingBranch(true)
    setIsAddBranchModalOpen(true)
    setIsManagementModalOpen(false)
  }

  const handleEditWarehouse = (warehouse: any) => {
    setEditWarehouse(warehouse)
    setIsEditingWarehouse(true)
    setIsAddStorageModalOpen(true)
    setIsManagementModalOpen(false)
  }

  // Toggle categories visibility
  const toggleCategoriesVisibility = () => {
    setIsCategoriesHidden(!isCategoriesHidden)
  }

  // Calculate capital per branch from loaded products
  const branchCapitals = useMemo(() => {
    const capitalMap: { [branchId: string]: number } = {}
    let total = 0

    products.forEach((product: any) => {
      const costPrice = parseFloat(product.cost_price) || 0
      if (costPrice <= 0 || !product.inventoryData) return

      Object.entries(product.inventoryData).forEach(([branchId, inv]: [string, any]) => {
        if (!selectedBranches[branchId]) return
        const qty = parseFloat(inv?.quantity) || 0
        if (qty <= 0) return
        const value = qty * costPrice
        capitalMap[branchId] = (capitalMap[branchId] || 0) + value
        total += value
      })
    })

    const branchList = branches
      .filter(b => selectedBranches[b.id] && capitalMap[b.id])
      .map(b => ({ id: b.id, name: b.name, capital: capitalMap[b.id] || 0 }))
      .sort((a, b) => b.capital - a.capital)

    return { total, branches: branchList }
  }, [products, branches, selectedBranches])

  // Handle quantity adjustment actions
  const handleQuantityAction = useCallback((mode: 'add' | 'edit' | 'subtract') => {
    if (!selectedProduct) {
      alert('يرجى اختيار منتج أولاً')
      return
    }

    setQuantityModalMode(mode)
    setSelectedProductForQuantity(selectedProduct)
    setShowQuantityModal(true)
    setShowQuantityDropdown(false)
  }, [selectedProduct])

  // Handle transfer action
  const handleTransferAction = useCallback(() => {
    if (!selectedProduct) {
      alert('يرجى اختيار منتج أولاً')
      return
    }
    setSelectedProductForQuantity(selectedProduct)
    setShowTransferModal(true)
    setShowQuantityDropdown(false)
  }, [selectedProduct])

  // Handle quantity confirmation with database update
  const handleQuantityConfirm = useCallback(async (newQuantity: number, reason: string, branchId: string) => {
    if (!selectedProductForQuantity || !branchId) {
      alert('بيانات المنتج أو الفرع مفقودة')
      return
    }

    try {
      const payload = {
        action: 'update_inventory',
        productId: selectedProductForQuantity.id,
        branchId: branchId,
        quantity: newQuantity
      }

      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      let result
      try {
        result = await response.json()
      } catch {
        throw new Error('استجابة غير صالحة من الخادم')
      }

      if (!response.ok) {
        throw new Error(result?.error || result?.message || `HTTP Error ${response.status}`)
      }

      if (!result.success) {
        throw new Error(result.error || result.message || 'فشل في تحديث الكمية')
      }

      // Smart update - Update only this product's inventory locally
      setProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.id === selectedProductForQuantity.id) {
            const newInventoryData = {
              ...product.inventoryData,
              [branchId]: {
                ...product.inventoryData?.[branchId],
                quantity: newQuantity,
              }
            }

            const newTotalQuantity = Object.values(newInventoryData).reduce(
              (sum, inv: any) => sum + (inv?.quantity || 0), 0
            )

            return {
              ...product,
              inventoryData: newInventoryData,
              totalQuantity: newTotalQuantity
            } as any
          }
          return product
        })
      )

      // Refresh website cache
      revalidateProductPage(selectedProductForQuantity.id).catch(() => {})

      const successMessage = quantityModalMode === 'add' ? 'تم إضافة الكمية بنجاح' : 'تم تعديل الكمية بنجاح'
      alert(successMessage)
      activityLog({ entityType: 'inventory', actionType: 'update', entityId: selectedProductForQuantity.id, entityName: selectedProductForQuantity.name })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      alert('حدث خطأ في تحديث الكمية: ' + errorMessage)
    }
  }, [selectedProductForQuantity, quantityModalMode, setProducts, activityLog])

  // Handle transfer confirmation
  const handleTransferConfirm = useCallback(async (quantity: number, reason: string, fromBranchId: string, toBranchId: string) => {
    if (!selectedProductForQuantity) return

    try {
      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer_inventory',
          productId: selectedProductForQuantity.id,
          fromBranchId,
          toBranchId,
          transferQuantity: quantity
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'فشل في تحويل الكمية')
      }

      // Update local state for both branches
      setProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.id === selectedProductForQuantity.id) {
            const newInventoryData = {
              ...product.inventoryData,
              [fromBranchId]: {
                ...product.inventoryData?.[fromBranchId],
                quantity: result.fromNewQty,
              },
              [toBranchId]: {
                ...product.inventoryData?.[toBranchId],
                quantity: result.toNewQty,
              }
            }

            const newTotalQuantity = Object.values(newInventoryData).reduce(
              (sum, inv: any) => sum + (inv?.quantity || 0), 0
            )

            return {
              ...product,
              inventoryData: newInventoryData,
              totalQuantity: newTotalQuantity
            } as any
          }
          return product
        })
      )

      revalidateProductPage(selectedProductForQuantity.id).catch(() => {})
      alert('تم تحويل الكمية بنجاح')
      activityLog({ entityType: 'inventory', actionType: 'update', entityId: selectedProductForQuantity.id, entityName: selectedProductForQuantity.name })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      alert('حدث خطأ في تحويل الكمية: ' + errorMessage)
    }
  }, [selectedProductForQuantity, setProducts, activityLog])

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-hidden flex flex-col">
        
        {/* Top Action Buttons Toolbar - Tablet Optimized with horizontal scrolling (EXACT COPY FROM PRODUCTS) */}
        <div className="bg-[#374151] border-b border-gray-600 px-2 py-2 w-full">
          <div
            ref={toolbarRef}
            className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span className="text-xs">تحديث</span>
            </button>

            <button
              onClick={() => setIsAddBranchModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors"
            >
              <BuildingStorefrontIcon className="h-4 w-4" />
              <span className="text-xs">إضافة فرع</span>
            </button>

            <button
              onClick={() => setIsAddStorageModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors"
            >
              <BuildingOffice2Icon className="h-4 w-4" />
              <span className="text-xs">إضافة مخزن</span>
            </button>

            <button
              onClick={() => setIsManagementModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors"
            >
              <CogIcon className="h-4 w-4" />
              <span className="text-xs">إدارة</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors">
              <DocumentArrowDownIcon className="h-4 w-4" />
              <span className="text-xs">حفظ كـ PDF</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors">
              <DocumentTextIcon className="h-4 w-4" />
              <span className="text-xs">تصدير اكسل</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors">
              <ClipboardDocumentListIcon className="h-4 w-4" />
              <span className="text-xs">جرد سريع</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors">
              <ChartBarIcon className="h-4 w-4" />
              <span className="text-xs">تقرير</span>
            </button>

            <button
              onClick={() => setShowColumnsModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors"
            >
              <TableCellsIcon className="h-4 w-4" />
              <span className="text-xs">الأعمدة</span>
            </button>

            {/* Quantity Dropdown Button */}
            <div className="relative quantity-dropdown flex-shrink-0" ref={quantityDropdownRef}>
              <button
                onClick={() => {
                  if (!showQuantityDropdown && quantityDropdownRef.current) {
                    const rect = quantityDropdownRef.current.getBoundingClientRect()
                    setQuantityDropdownPos({
                      top: rect.bottom + 4,
                      left: rect.left + rect.width / 2
                    })
                  }
                  setShowQuantityDropdown(!showQuantityDropdown)
                }}
                className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white cursor-pointer whitespace-nowrap bg-[#2B3544] hover:bg-[#434E61] rounded transition-colors"
              >
                <CubeIcon className="h-4 w-4" />
                <span className="text-xs">الكمية</span>
                <ChevronDownIcon className={`h-3 w-3 transition-transform ${showQuantityDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Search and Controls Section - Full Width Above Everything */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-3 flex-shrink-0">
          {/* Single Horizontal Row - Search Bar, Product Count, View Toggle, Categories Toggle, Branches Dropdown */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'}}>

            {/* 1. Search Bar */}
            <div className="relative flex-shrink-0 w-64">
              <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اسم المنتج..."
                className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5DADE2] focus:border-transparent"
                style={{ fontSize: '16px' }}
                onFocus={(e) => {
                  // Prevent zoom on iOS Safari
                  e.target.style.fontSize = '16px';
                  e.target.style.transformOrigin = 'left top';
                  e.target.style.zoom = '1';
                }}
              />
            </div>

            {/* 2. Product Count (Plain Text) */}
            <span className="text-xs text-gray-400 whitespace-nowrap">
              عرض {visibleProducts.length} من {products.length}
            </span>

            {/* 3. View Toggle (Images or Tables) */}
            <div className="flex bg-[#2B3544] rounded-md overflow-hidden flex-shrink-0 border border-gray-600">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                title="عرض الصور"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                }`}
                title="عرض الجداول"
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>

            {/* 4. Categories Toggle Button */}
            <button
              onClick={toggleCategoriesVisibility}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors bg-[#2B3544] border border-gray-600 flex-shrink-0"
              title={isCategoriesHidden ? 'إظهار المجموعات' : 'إخفاء المجموعات'}
            >
              {isCategoriesHidden ? (
                <FolderIcon className="h-4 w-4" />
              ) : (
                <FolderOpenIcon className="h-4 w-4" />
              )}
            </button>

            {/* 5. Branches and Warehouses Button */}
            <div className="relative branches-dropdown flex-shrink-0">
              <button
                onClick={() => setShowBranchesDropdown(!showBranchesDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white text-xs font-medium transition-colors whitespace-nowrap"
              >
                <span>الفروع والمخازن</span>
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${showBranchesDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Branches Dropdown */}
              {showBranchesDropdown && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-[#2B3544] border-2 border-[#4A5568] rounded-xl shadow-2xl z-[9999] overflow-hidden">
                  <div className="p-2">
                    <div className="space-y-1">
                      {branches.map(branch => (
                        <label
                          key={branch.id}
                          className="flex items-center gap-2 p-2 bg-[#374151] hover:bg-[#434E61] rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBranches[branch.id] || false}
                            onChange={() => handleBranchToggle(branch.id)}
                            className="w-4 h-4 text-blue-600 bg-[#2B3544] border-2 border-blue-500 rounded focus:ring-blue-500"
                          />
                          <span className="text-white text-sm flex-1 text-right">
                            {branch.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Stock Status Filter Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleStockStatusToggle('good')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  stockStatusFilters.good
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 text-gray-400 opacity-50'
                }`}
              >
                جيد
              </button>
              <button
                onClick={() => handleStockStatusToggle('low')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  stockStatusFilters.low
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-gray-600 text-gray-400 opacity-50'
                }`}
              >
                منخفض
              </button>
              <button
                onClick={() => handleStockStatusToggle('zero')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  stockStatusFilters.zero
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-600 text-gray-400 opacity-50'
                }`}
              >
                صفر
              </button>
            </div>

            {/* 7. Audit Branches Dropdown */}
            <div className="relative audit-branches-dropdown flex-shrink-0">
              <button
                onClick={() => setShowAuditBranchesDropdown(!showAuditBranchesDropdown)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium transition-colors whitespace-nowrap"
              >
                <span>فروع الجرد</span>
                <ChevronDownIcon className={`h-3 w-3 transition-transform ${showAuditBranchesDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Audit Branches Dropdown Menu */}
              {showAuditBranchesDropdown && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-[#2B3544] border-2 border-[#4A5568] rounded-xl shadow-2xl z-[9999] overflow-hidden">
                  <div className="p-2">
                    <div className="space-y-1">
                      {branches.map(branch => (
                        <div
                          key={branch.id}
                          className="flex items-center justify-between p-2 bg-[#374151] hover:bg-[#434E61] rounded-lg transition-colors"
                        >
                          <span className="text-white text-sm">
                            {branch.name}
                          </span>
                          <div className="flex gap-2">
                            <button className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded">
                              تام
                            </button>
                            <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">
                              استعد
                            </button>
                            <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">
                              غير مجرود
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 8. Audit Status Filter Buttons */}
            <button
              onClick={() => setAuditStatusFilters(prev => ({ ...prev, fully_audited: !prev.fully_audited }))}
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                auditStatusFilters.fully_audited
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 text-gray-400 opacity-50'
              }`}
            >
              تام الجرد
            </button>
            <button
              onClick={() => setAuditStatusFilters(prev => ({ ...prev, ready: !prev.ready }))}
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                auditStatusFilters.ready
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-gray-600 text-gray-400 opacity-50'
              }`}
            >
              استعد
            </button>
            <button
              onClick={() => setAuditStatusFilters(prev => ({ ...prev, not_audited: !prev.not_audited }))}
              className={`px-2 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                auditStatusFilters.not_audited
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-600 text-gray-400 opacity-50'
              }`}
            >
              غير موجود
            </button>
          </div>

          {/* Capital Display Row */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mt-2" style={{scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch'}}>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 border border-blue-500/30 rounded-lg flex-shrink-0">
              <BanknotesIcon className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-gray-400">رأس المال:</span>
              <span className="text-sm font-bold text-emerald-400">
                {branchCapitals.total.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {branchCapitals.branches.map(branch => (
              <div
                key={branch.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-[#2B3544] border border-gray-600/50 rounded-md flex-shrink-0"
              >
                <span className="text-xs text-gray-400">{branch.name}:</span>
                <span className="text-xs font-semibold text-blue-300">
                  {branch.capital.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content Area with Sidebar and Main Content - Below Search Bar */}
        <div className="flex-1 flex overflow-hidden">

          {/* Categories Tree Sidebar - Starts at content level */}
          {!isCategoriesHidden && (
            <CategoriesTreeView
              onCategorySelect={handleCategorySelect}
              selectedCategoryId={selectedCategory?.id}
              showActionButtons={false}
            />
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Products Content Container */}
            <div className="flex-1 overflow-hidden bg-[#2B3544]">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-white">جاري التحميل...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-400">خطأ: {error}</div>
                </div>
              ) : viewMode === 'table' ? (
                <ResizableTable
                  className="h-full w-full"
                  columns={dynamicTableColumns}
                  data={visibleProducts}
                  selectedRowId={selectedProduct?.id || null}
                  onRowClick={(item, index) => {
                    if (selectedProduct?.id === item.id) {
                      setSelectedProduct(null)
                    } else {
                      setSelectedProduct(item)
                    }
                  }}
                />
              ) : (
                // Grid View - Responsive columns (tablet gets more columns)
                <div className="h-full overflow-y-auto scrollbar-hide p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {visibleProducts.map((product, index) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          if (selectedProduct?.id === product.id) {
                            setSelectedProduct(null)
                          } else {
                            setSelectedProduct(product)
                          }
                        }}
                        className={`bg-[#374151] rounded-lg p-3 cursor-pointer transition-all duration-200 border-2 relative group ${
                          selectedProduct?.id === product.id
                            ? 'border-blue-500 bg-[#434E61]'
                            : 'border-transparent hover:border-gray-500 hover:bg-[#434E61]'
                        }`}
                      >
                        {/* Hover Button */}
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setModalProduct(product)
                              const firstImage = product.main_image_url || null
                              setSelectedImage(firstImage)
                              setShowProductModal(true)
                            }}
                            className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Product Image - Larger on tablets */}
                        <div className="w-full h-36 sm:h-44 md:h-48 bg-[#2B3544] rounded-md mb-3 flex items-center justify-center overflow-hidden">
                          {product.main_image_url ? (
                            <img
                              src={product.main_image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                          ) : null}
                          <div className={`w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center ${product.main_image_url ? 'hidden' : ''}`}>
                            <span className="text-2xl">📦</span>
                          </div>
                        </div>

                        {/* Product Name */}
                        <h3 className="text-white font-medium text-xs text-center mb-2 line-clamp-2">
                          {product.name}
                        </h3>

                        {/* Product Details */}
                        <div className="space-y-1 text-xs">
                          {/* Selling Price */}
                          <div className="flex justify-center mb-2">
                            <span className="text-blue-400 font-medium text-xs">
                              {(product.price || 0).toFixed(2)}
                            </span>
                          </div>

                          {/* Total Quantity */}
                          <div className="flex justify-between items-center">
                            <span className={`font-medium text-xs ${
                              (() => {
                                const stockStatus = getStockStatus(product)
                                if (stockStatus === 'zero') return 'text-red-400'
                                if (stockStatus === 'low') return 'text-yellow-400'
                                return 'text-green-400'
                              })()
                            }`}>
                              {calculateTotalQuantity(product)}
                            </span>
                            <span className="text-gray-400 text-xs">الكمية</span>
                          </div>

                          {/* Per-Branch Quantities */}
                          {product.inventoryData && Object.entries(product.inventoryData)
                            .filter(([locationId]) => selectedBranches[locationId])
                            .map(([locationId, inventory]: [string, any]) => {
                              const branch = branches.find(b => b.id === locationId)
                              const locationName = branch?.name || `موقع ${locationId.slice(0, 8)}`
                              const quantity = inventory?.quantity || 0
                              const minStock = inventory?.min_stock || 0

                              let colorClass = 'text-green-400'
                              if (quantity === 0) {
                                colorClass = 'text-red-400'
                              } else if (quantity <= minStock && minStock > 0) {
                                colorClass = 'text-yellow-400'
                              }

                              return (
                                <div key={locationId} className="flex justify-between items-center">
                                  <span className={`${colorClass} font-medium text-xs`}>
                                    {quantity}
                                  </span>
                                  <span className="text-gray-400 text-xs truncate">
                                    {locationName}
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Load All Products Button - Mobile/Tablet */}
                  {hasMoreProductsLocal && (
                    <div className="flex justify-center py-6">
                      <button
                        onClick={() => setShowAllProducts(true)}
                        className="w-full max-w-md px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-lg"
                      >
                        تحميل كل المنتجات ({filteredProducts.length - VISIBLE_PRODUCTS_LIMIT} منتج إضافي)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Branch Management Modals */}
      <AddBranchModal 
        isOpen={isAddBranchModalOpen} 
        onClose={() => {
          setIsAddBranchModalOpen(false)
          setEditBranch(null)
          setIsEditingBranch(false)
        }}
        onBranchCreated={handleBranchCreated}
        editBranch={editBranch}
        isEditing={isEditingBranch}
      />

      <AddStorageModal 
        isOpen={isAddStorageModalOpen} 
        onClose={() => {
          setIsAddStorageModalOpen(false)
          setEditWarehouse(null)
          setIsEditingWarehouse(false)
        }}
        onWarehouseCreated={handleWarehouseCreated}
        editWarehouse={editWarehouse}
        isEditing={isEditingWarehouse}
      />

      <ManagementModal 
        isOpen={isManagementModalOpen} 
        onClose={() => setIsManagementModalOpen(false)}
        onEditBranch={handleEditBranch}
        onEditWarehouse={handleEditWarehouse}
      />

      {/* Columns Control Modal */}
      <ColumnsControlModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={getAllColumns}
        onColumnsChange={handleColumnsChange}
      />

      {/* Quantity Dropdown Menu - Fixed position to escape overflow container */}
      {showQuantityDropdown && (
        <div
          ref={quantityDropdownMenuRef}
          className="fixed quantity-dropdown-menu bg-[#2B3544] border border-[#4A5568] rounded-lg shadow-xl z-[9999] min-w-[160px] py-1"
          style={{
            top: quantityDropdownPos.top,
            left: quantityDropdownPos.left,
            transform: 'translateX(-50%)'
          }}
        >
          <button
            onClick={() => handleQuantityAction('add')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-green-600/20 hover:text-green-400 transition-colors"
          >
            <PlusIcon className="h-4 w-4 text-green-400" />
            <span className="text-sm">إضافة</span>
          </button>
          <button
            onClick={() => handleQuantityAction('subtract')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-colors"
          >
            <MinusIcon className="h-4 w-4 text-red-400" />
            <span className="text-sm">خصم</span>
          </button>
          <button
            onClick={() => handleQuantityAction('edit')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-blue-600/20 hover:text-blue-400 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4 text-blue-400" />
            <span className="text-sm">تعديل</span>
          </button>
          <button
            onClick={() => handleTransferAction()}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-purple-600/20 hover:text-purple-400 transition-colors"
          >
            <ArrowsRightLeftIcon className="h-4 w-4 text-purple-400" />
            <span className="text-sm">تحويل</span>
          </button>
        </div>
      )}

      {/* Quantity Adjustment Modal */}
      <QuantityAdjustmentModal
        isOpen={showQuantityModal}
        onClose={() => setShowQuantityModal(false)}
        product={selectedProductForQuantity}
        mode={quantityModalMode}
        branches={branches}
        onConfirm={handleQuantityConfirm}
      />

      {/* Transfer Quantity Modal */}
      <TransferQuantityModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        product={selectedProductForQuantity}
        branches={branches}
        onConfirm={handleTransferConfirm}
      />

      {/* Tablet-optimized styles - EXACT COPY FROM PRODUCTS */}
      <style jsx global>{`
        /* Hide scrollbars but keep functionality */
        .scrollbar-hide {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* Internet Explorer 10+ */
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none; /* WebKit */
        }

        /* Touch-friendly interactions */
        @media (max-width: 1024px) {
          button, .cursor-pointer {
            min-height: 44px;
          }
        }

        /* Line clamp utility */
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}