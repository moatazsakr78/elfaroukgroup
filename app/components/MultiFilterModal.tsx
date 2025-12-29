'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  XMarkIcon,
  FunnelIcon,
  UserGroupIcon,
  UsersIcon,
  ArchiveBoxIcon,
  TagIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  CheckIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'
import { useReportFilters } from '../lib/hooks/useReportFilters'
import {
  MultiFiltersResult,
  initialMultiFilters,
  getMultiFiltersCount
} from '../types/filters'

interface MultiFilterModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: MultiFiltersResult) => void
  initialFilters?: MultiFiltersResult
}

export default function MultiFilterModal({
  isOpen,
  onClose,
  onApply,
  initialFilters = initialMultiFilters
}: MultiFilterModalProps) {
  const {
    customers,
    customerGroups,
    users,
    products,
    categories,
    safes,
    branches,
    warehouses,
    isLoading,
    error
  } = useReportFilters()

  const [filters, setFilters] = useState<MultiFiltersResult>(initialFilters)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['customers', 'products']) // مفتوح افتراضياً
  )
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({})

  // إعادة تعيين الفلاتر عند الفتح
  useEffect(() => {
    if (isOpen) {
      setFilters(initialFilters)
    }
  }, [isOpen, initialFilters])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }, [])

  const handleToggle = useCallback((
    field: keyof MultiFiltersResult,
    id: string
  ) => {
    setFilters(prev => {
      const currentArray = prev[field] as string[]
      const newArray = currentArray.includes(id)
        ? currentArray.filter(i => i !== id)
        : [...currentArray, id]
      return { ...prev, [field]: newArray }
    })
  }, [])

  const handleSelectAll = useCallback((
    field: keyof MultiFiltersResult,
    ids: string[]
  ) => {
    setFilters(prev => ({ ...prev, [field]: ids }))
  }, [])

  const handleDeselectAll = useCallback((
    field: keyof MultiFiltersResult
  ) => {
    setFilters(prev => ({ ...prev, [field]: [] }))
  }, [])

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const handleClear = () => {
    setFilters(initialMultiFilters)
  }

  const totalSelectedCount = getMultiFiltersCount(filters)

  // فلترة الخيارات بناءً على البحث
  const getFilteredOptions = useCallback((
    options: { id: string; name: string }[],
    section: string
  ) => {
    const query = searchQueries[section]?.toLowerCase() || ''
    if (!query) return options
    return options.filter(opt => opt.name.toLowerCase().includes(query))
  }, [searchQueries])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#2B3544] border border-gray-600 rounded-lg shadow-xl z-50 w-[700px] max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-[#374151] px-6 py-4 border-b border-gray-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <FunnelIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">فلتر متعدد</h2>
              <p className="text-gray-400 text-sm">اختر عناصر متعددة من كل فئة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
              <span className="mr-3 text-gray-300">جاري التحميل...</span>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-10">{error}</div>
          ) : (
            <div className="space-y-3">

              {/* 1. العملاء */}
              <FilterSection
                icon={<UserGroupIcon className="h-5 w-5" />}
                label="العملاء"
                sectionKey="customers"
                isExpanded={expandedSections.has('customers')}
                onToggleExpand={() => toggleSection('customers')}
                selectedCount={filters.customerIds.length}
                totalCount={customers.length}
                options={getFilteredOptions(customers, 'customers')}
                selectedIds={filters.customerIds}
                onToggle={(id) => handleToggle('customerIds', id)}
                onSelectAll={() => handleSelectAll('customerIds', customers.map(c => c.id))}
                onDeselectAll={() => handleDeselectAll('customerIds')}
                searchQuery={searchQueries['customers'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, customers: q }))}
              />

              {/* 2. فئات العملاء */}
              <FilterSection
                icon={<UsersIcon className="h-5 w-5" />}
                label="فئات العملاء"
                sectionKey="customerGroups"
                isExpanded={expandedSections.has('customerGroups')}
                onToggleExpand={() => toggleSection('customerGroups')}
                selectedCount={filters.customerGroupIds.length}
                totalCount={customerGroups.length}
                options={getFilteredOptions(customerGroups, 'customerGroups')}
                selectedIds={filters.customerGroupIds}
                onToggle={(id) => handleToggle('customerGroupIds', id)}
                onSelectAll={() => handleSelectAll('customerGroupIds', customerGroups.map(g => g.id))}
                onDeselectAll={() => handleDeselectAll('customerGroupIds')}
                searchQuery={searchQueries['customerGroups'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, customerGroups: q }))}
              />

              {/* 3. المستخدمين */}
              <FilterSection
                icon={<UsersIcon className="h-5 w-5" />}
                label="المستخدمين"
                sectionKey="users"
                isExpanded={expandedSections.has('users')}
                onToggleExpand={() => toggleSection('users')}
                selectedCount={filters.userIds.length}
                totalCount={users.length}
                options={getFilteredOptions(users, 'users')}
                selectedIds={filters.userIds}
                onToggle={(id) => handleToggle('userIds', id)}
                onSelectAll={() => handleSelectAll('userIds', users.map(u => u.id))}
                onDeselectAll={() => handleDeselectAll('userIds')}
                searchQuery={searchQueries['users'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, users: q }))}
              />

              {/* 4. المنتجات */}
              <FilterSection
                icon={<ArchiveBoxIcon className="h-5 w-5" />}
                label="المنتجات"
                sectionKey="products"
                isExpanded={expandedSections.has('products')}
                onToggleExpand={() => toggleSection('products')}
                selectedCount={filters.productIds.length}
                totalCount={products.length}
                options={getFilteredOptions(products, 'products')}
                selectedIds={filters.productIds}
                onToggle={(id) => handleToggle('productIds', id)}
                onSelectAll={() => handleSelectAll('productIds', products.map(p => p.id))}
                onDeselectAll={() => handleDeselectAll('productIds')}
                searchQuery={searchQueries['products'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, products: q }))}
              />

              {/* 5. فئات المنتجات */}
              <FilterSection
                icon={<TagIcon className="h-5 w-5" />}
                label="فئات المنتجات"
                sectionKey="categories"
                isExpanded={expandedSections.has('categories')}
                onToggleExpand={() => toggleSection('categories')}
                selectedCount={filters.categoryIds.length}
                totalCount={categories.length}
                options={getFilteredOptions(categories, 'categories')}
                selectedIds={filters.categoryIds}
                onToggle={(id) => handleToggle('categoryIds', id)}
                onSelectAll={() => handleSelectAll('categoryIds', categories.map(c => c.id))}
                onDeselectAll={() => handleDeselectAll('categoryIds')}
                searchQuery={searchQueries['categories'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, categories: q }))}
              />

              {/* 6. الخزن */}
              <FilterSection
                icon={<BanknotesIcon className="h-5 w-5" />}
                label="الخزن"
                sectionKey="safes"
                isExpanded={expandedSections.has('safes')}
                onToggleExpand={() => toggleSection('safes')}
                selectedCount={filters.safeIds.length}
                totalCount={safes.length}
                options={getFilteredOptions(safes, 'safes')}
                selectedIds={filters.safeIds}
                onToggle={(id) => handleToggle('safeIds', id)}
                onSelectAll={() => handleSelectAll('safeIds', safes.map(s => s.id))}
                onDeselectAll={() => handleDeselectAll('safeIds')}
                searchQuery={searchQueries['safes'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, safes: q }))}
              />

              {/* 7. الفروع */}
              <FilterSection
                icon={<BuildingStorefrontIcon className="h-5 w-5" />}
                label="الفروع"
                sectionKey="branches"
                isExpanded={expandedSections.has('branches')}
                onToggleExpand={() => toggleSection('branches')}
                selectedCount={filters.branchIds.length}
                totalCount={branches.length}
                options={getFilteredOptions(branches, 'branches')}
                selectedIds={filters.branchIds}
                onToggle={(id) => handleToggle('branchIds', id)}
                onSelectAll={() => handleSelectAll('branchIds', branches.map(b => b.id))}
                onDeselectAll={() => handleDeselectAll('branchIds')}
                searchQuery={searchQueries['branches'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, branches: q }))}
              />

              {/* 8. المخازن */}
              <FilterSection
                icon={<BuildingOffice2Icon className="h-5 w-5" />}
                label="المخازن"
                sectionKey="warehouses"
                isExpanded={expandedSections.has('warehouses')}
                onToggleExpand={() => toggleSection('warehouses')}
                selectedCount={filters.warehouseIds.length}
                totalCount={warehouses.length}
                options={getFilteredOptions(warehouses, 'warehouses')}
                selectedIds={filters.warehouseIds}
                onToggle={(id) => handleToggle('warehouseIds', id)}
                onSelectAll={() => handleSelectAll('warehouseIds', warehouses.map(w => w.id))}
                onDeselectAll={() => handleDeselectAll('warehouseIds')}
                searchQuery={searchQueries['warehouses'] || ''}
                onSearchChange={(q) => setSearchQueries(prev => ({ ...prev, warehouses: q }))}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#374151] px-6 py-4 border-t border-gray-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {totalSelectedCount} عنصر محدد
            </span>
            {totalSelectedCount > 0 && (
              <button
                onClick={handleClear}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                إلغاء الكل
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 rounded transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// مكون القسم القابل للطي
interface FilterSectionProps {
  icon: React.ReactNode
  label: string
  sectionKey: string
  isExpanded: boolean
  onToggleExpand: () => void
  selectedCount: number
  totalCount: number
  options: { id: string; name: string }[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

function FilterSection({
  icon,
  label,
  sectionKey,
  isExpanded,
  onToggleExpand,
  selectedCount,
  totalCount,
  options,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  searchQuery,
  onSearchChange
}: FilterSectionProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  return (
    <div className="bg-[#374151] rounded-lg border border-gray-600 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-600/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-300">{icon}</span>
          <span className="text-white font-medium">{label}</span>
          {selectedCount > 0 && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
              {selectedCount} محدد
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">{totalCount}</span>
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-600 p-3">
          {/* Search & Actions */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="بحث..."
                className="w-full pl-3 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={onSelectAll}
              className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded whitespace-nowrap"
            >
              تحديد الكل
            </button>
            <button
              onClick={onDeselectAll}
              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded whitespace-nowrap"
            >
              إلغاء الكل
            </button>
          </div>

          {/* Options Grid */}
          <div className="max-h-40 overflow-y-auto scrollbar-hide">
            {options.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      selectedSet.has(option.id)
                        ? 'bg-green-600/20 border border-green-500/50'
                        : 'bg-[#2B3544] border border-transparent hover:border-gray-500'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(option.id)}
                        onChange={() => onToggle(option.id)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedSet.has(option.id)
                          ? 'bg-green-600 border-green-600'
                          : 'bg-transparent border-gray-400'
                      }`}>
                        {selectedSet.has(option.id) && (
                          <CheckIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-white truncate">{option.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 text-sm">
                لا توجد نتائج
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
