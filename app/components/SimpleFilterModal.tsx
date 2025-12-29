'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  XMarkIcon,
  FunnelIcon,
  UserGroupIcon,
  UsersIcon,
  ArchiveBoxIcon,
  TagIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { useReportFilters } from '../lib/hooks/useReportFilters'
import {
  SimpleFiltersResult,
  initialSimpleFilters,
  getSimpleFiltersCount,
  LocationOption
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
    locations,
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
    if (field === 'locationId') {
      // عند اختيار موقع، نحدد نوعه (فرع أو مخزن)
      const selectedLocation = locations.find(l => l.id === value)
      setFilters(prev => ({
        ...prev,
        locationId: value || null,
        locationType: selectedLocation?.type || null
      }))
    } else {
      setFilters(prev => ({
        ...prev,
        [field]: value || null
      }))
    }
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
              <SearchableSelect
                icon={<UserGroupIcon className="h-5 w-5" />}
                label="العملاء"
                value={filters.customerId || ''}
                onChange={(v) => handleSelectChange('customerId', v)}
                options={customers}
                placeholder="جميع العملاء"
              />

              {/* 2. فئات العملاء */}
              <SearchableSelect
                icon={<UsersIcon className="h-5 w-5" />}
                label="فئات العملاء"
                value={filters.customerGroupId || ''}
                onChange={(v) => handleSelectChange('customerGroupId', v)}
                options={customerGroups}
                placeholder="جميع فئات العملاء"
              />

              {/* 3. المستخدمين */}
              <SearchableSelect
                icon={<UsersIcon className="h-5 w-5" />}
                label="المستخدمين"
                value={filters.userId || ''}
                onChange={(v) => handleSelectChange('userId', v)}
                options={users}
                placeholder="جميع المستخدمين"
              />

              {/* 4. المنتجات */}
              <SearchableSelect
                icon={<ArchiveBoxIcon className="h-5 w-5" />}
                label="المنتجات"
                value={filters.productId || ''}
                onChange={(v) => handleSelectChange('productId', v)}
                options={products}
                placeholder="جميع المنتجات"
              />

              {/* 5. فئات المنتجات */}
              <SearchableSelect
                icon={<TagIcon className="h-5 w-5" />}
                label="فئات المنتجات"
                value={filters.categoryId || ''}
                onChange={(v) => handleSelectChange('categoryId', v)}
                options={categories}
                placeholder="جميع فئات المنتجات"
              />

              {/* 6. الخزن */}
              <SearchableSelect
                icon={<BanknotesIcon className="h-5 w-5" />}
                label="الخزن"
                value={filters.safeId || ''}
                onChange={(v) => handleSelectChange('safeId', v)}
                options={safes}
                placeholder="جميع الخزن"
              />

              {/* 7. الفروع والمخازن (مدمجة) */}
              <SearchableSelect
                icon={<BuildingStorefrontIcon className="h-5 w-5" />}
                label="الفروع والمخازن"
                value={filters.locationId || ''}
                onChange={(v) => handleSelectChange('locationId', v)}
                options={locations.map(l => ({
                  id: l.id,
                  name: l.label,
                  secondaryText: l.type === 'branch' ? 'فرع' : 'مخزن'
                }))}
                placeholder="جميع الفروع والمخازن"
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

// مكون SearchableSelect - قائمة منسدلة مع بحث
interface SearchableSelectProps {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; name: string; secondaryText?: string }[]
  placeholder: string
}

function SearchableSelect({
  icon,
  label,
  value,
  onChange,
  options,
  placeholder
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // البحث في الخيارات
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase()
    return options.filter(
      opt =>
        opt.name.toLowerCase().includes(query) ||
        (opt.secondaryText && opt.secondaryText.toLowerCase().includes(query))
    )
  }, [options, searchQuery])

  // الحصول على اسم الخيار المحدد
  const selectedOption = options.find(opt => opt.id === value)
  const displayValue = selectedOption ? selectedOption.name : placeholder

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // التركيز على حقل البحث عند فتح القائمة
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (optionId: string) => {
    onChange(optionId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-36 flex items-center gap-2 text-gray-300 flex-shrink-0">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        {/* الزر الرئيسي */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-[#374151] border rounded-md px-4 py-2.5 text-right flex items-center justify-between cursor-pointer transition-colors ${
            isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-gray-600 hover:border-gray-500'
          }`}
        >
          <span className={value ? 'text-white' : 'text-gray-400'}>
            {displayValue}
          </span>
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* القائمة المنسدلة */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#374151] border border-gray-600 rounded-md shadow-lg z-10 overflow-hidden">
            {/* حقل البحث */}
            <div className="p-2 border-b border-gray-600">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث..."
                  className="w-full bg-[#2B3544] border border-gray-600 rounded px-9 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* قائمة الخيارات */}
            <div className="max-h-48 overflow-y-auto">
              {/* خيار "الكل" */}
              <div
                onClick={handleClear}
                className={`px-4 py-2.5 cursor-pointer transition-colors ${
                  !value
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-300 hover:bg-gray-600/30'
                }`}
              >
                {placeholder}
              </div>

              {/* الخيارات المفلترة */}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={`px-4 py-2.5 cursor-pointer transition-colors ${
                      value === option.id
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-gray-300 hover:bg-gray-600/30'
                    }`}
                  >
                    <span>{option.name}</span>
                    {option.secondaryText && (
                      <span className="text-gray-500 text-sm mr-2">
                        ({option.secondaryText})
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-gray-500 text-center text-sm">
                  لا توجد نتائج
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
