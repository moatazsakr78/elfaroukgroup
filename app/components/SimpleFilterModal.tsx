'use client'

import { useState, useEffect } from 'react'
import {
  XMarkIcon,
  FunnelIcon,
  UserGroupIcon,
  UsersIcon,
  ArchiveBoxIcon,
  TagIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline'
import { useReportFilters } from '../lib/hooks/useReportFilters'
import {
  SimpleFiltersResult,
  initialSimpleFilters,
  getSimpleFiltersCount
} from '../types/filters'

interface SimpleFilterModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: SimpleFiltersResult) => void
  initialFilters?: SimpleFiltersResult
}

export default function SimpleFilterModal({
  isOpen,
  onClose,
  onApply,
  initialFilters = initialSimpleFilters
}: SimpleFilterModalProps) {
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

  const [filters, setFilters] = useState<SimpleFiltersResult>(initialFilters)

  // إعادة تعيين الفلاتر عند الفتح
  useEffect(() => {
    if (isOpen) {
      setFilters(initialFilters)
    }
  }, [isOpen, initialFilters])

  const handleSelectChange = (
    field: keyof SimpleFiltersResult,
    value: string
  ) => {
    setFilters(prev => ({
      ...prev,
      [field]: value || null
    }))
  }

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const handleClear = () => {
    setFilters(initialSimpleFilters)
  }

  const activeFiltersCount = getSimpleFiltersCount(filters)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#2B3544] border border-gray-600 rounded-lg shadow-xl z-50 w-[600px] max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-[#374151] px-6 py-4 border-b border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <FunnelIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">فلتر بسيط</h2>
              <p className="text-gray-400 text-sm">اختر فلتر واحد من كل فئة</p>
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
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="mr-3 text-gray-300">جاري التحميل...</span>
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-10">{error}</div>
          ) : (
            <div className="space-y-4">

              {/* 1. العملاء */}
              <FilterDropdown
                icon={<UserGroupIcon className="h-5 w-5" />}
                label="العملاء"
                value={filters.customerId || ''}
                onChange={(v) => handleSelectChange('customerId', v)}
                options={customers}
                placeholder="جميع العملاء"
              />

              {/* 2. فئات العملاء */}
              <FilterDropdown
                icon={<UsersIcon className="h-5 w-5" />}
                label="فئات العملاء"
                value={filters.customerGroupId || ''}
                onChange={(v) => handleSelectChange('customerGroupId', v)}
                options={customerGroups}
                placeholder="جميع فئات العملاء"
              />

              {/* 3. المستخدمين */}
              <FilterDropdown
                icon={<UsersIcon className="h-5 w-5" />}
                label="المستخدمين"
                value={filters.userId || ''}
                onChange={(v) => handleSelectChange('userId', v)}
                options={users}
                placeholder="جميع المستخدمين"
              />

              {/* 4. المنتجات */}
              <FilterDropdown
                icon={<ArchiveBoxIcon className="h-5 w-5" />}
                label="المنتجات"
                value={filters.productId || ''}
                onChange={(v) => handleSelectChange('productId', v)}
                options={products}
                placeholder="جميع المنتجات"
              />

              {/* 5. فئات المنتجات */}
              <FilterDropdown
                icon={<TagIcon className="h-5 w-5" />}
                label="فئات المنتجات"
                value={filters.categoryId || ''}
                onChange={(v) => handleSelectChange('categoryId', v)}
                options={categories}
                placeholder="جميع فئات المنتجات"
              />

              {/* 6. الخزن */}
              <FilterDropdown
                icon={<BanknotesIcon className="h-5 w-5" />}
                label="الخزن"
                value={filters.safeId || ''}
                onChange={(v) => handleSelectChange('safeId', v)}
                options={safes}
                placeholder="جميع الخزن"
              />

              {/* 7. الفروع */}
              <FilterDropdown
                icon={<BuildingStorefrontIcon className="h-5 w-5" />}
                label="الفروع"
                value={filters.branchId || ''}
                onChange={(v) => handleSelectChange('branchId', v)}
                options={branches}
                placeholder="جميع الفروع"
              />

              {/* 8. المخازن */}
              <FilterDropdown
                icon={<BuildingOffice2Icon className="h-5 w-5" />}
                label="المخازن"
                value={filters.warehouseId || ''}
                onChange={(v) => handleSelectChange('warehouseId', v)}
                options={warehouses}
                placeholder="جميع المخازن"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#374151] px-6 py-4 border-t border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {activeFiltersCount} فلتر نشط
            </span>
            {activeFiltersCount > 0 && (
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
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// مكون Dropdown مشترك
interface FilterDropdownProps {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; name: string; secondaryText?: string }[]
  placeholder: string
}

function FilterDropdown({
  icon,
  label,
  value,
  onChange,
  options,
  placeholder
}: FilterDropdownProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-36 flex items-center gap-2 text-gray-300 flex-shrink-0">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-[#374151] border border-gray-600 rounded-md px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.secondaryText && ` - ${option.secondaryText}`}
          </option>
        ))}
      </select>
    </div>
  )
}
