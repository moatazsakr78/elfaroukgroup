'use client'

import { useState, useEffect, useCallback } from 'react'
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { Product } from '../../lib/hooks/useProductsAdmin'
import {
  generateInventoryPDF,
  PDFExportColumn,
  EXPORT_COLUMNS,
  PRICE_OPTIONS,
  PriceType
} from '../lib/utils/pdfExport'

interface InventoryPDFExportModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  selectedProductIds: string[]
  onSelectModeRequest?: () => void
}

export default function InventoryPDFExportModal({
  isOpen,
  onClose,
  products,
  selectedProductIds,
  onSelectModeRequest
}: InventoryPDFExportModalProps) {
  // Export columns state
  const [columns, setColumns] = useState<PDFExportColumn[]>(
    EXPORT_COLUMNS.map(col => ({ ...col }))
  )

  // Price type state
  const [priceType, setPriceType] = useState<PriceType>('price')

  // Include images state
  const [includeImages, setIncludeImages] = useState(true)

  // Export mode state
  const [exportMode, setExportMode] = useState<'all' | 'selected'>('all')

  // Export progress state
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [currentProductName, setCurrentProductName] = useState('')
  const [processedCount, setProcessedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Reset export mode when selected products change
  useEffect(() => {
    if (selectedProductIds.length === 0 && exportMode === 'selected') {
      setExportMode('all')
    }
  }, [selectedProductIds, exportMode])

  // Handle column toggle
  const handleColumnToggle = useCallback((columnId: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, enabled: !col.enabled } : col
      )
    )
  }, [])

  // Select all columns
  const handleSelectAllColumns = useCallback(() => {
    setColumns(prev => prev.map(col => ({ ...col, enabled: true })))
  }, [])

  // Deselect all columns
  const handleDeselectAllColumns = useCallback(() => {
    setColumns(prev => prev.map(col => ({ ...col, enabled: false })))
  }, [])

  // Handle export
  const handleExport = useCallback(async () => {
    // Get products to export
    const productsToExport = exportMode === 'all'
      ? products
      : products.filter(p => selectedProductIds.includes(p.id))

    if (productsToExport.length === 0) {
      alert('لا توجد منتجات للتصدير')
      return
    }

    // Check if at least one column is selected
    const enabledColumns = columns.filter(col => col.enabled)
    if (enabledColumns.length === 0) {
      alert('يرجى اختيار عمود واحد على الأقل')
      return
    }

    try {
      setIsExporting(true)
      setExportProgress(0)
      setProcessedCount(0)
      setTotalCount(productsToExport.length)
      setCurrentProductName('')

      console.log(`📄 Starting PDF export for ${productsToExport.length} products...`)

      await generateInventoryPDF(
        productsToExport,
        {
          columns,
          priceType,
          includeImages,
          title: 'جرد المخزون - El Farouk Group'
        },
        (current, total, productName) => {
          setProcessedCount(current)
          setTotalCount(total)
          setExportProgress(Math.round((current / total) * 100))
          setCurrentProductName(productName)
        }
      )

      alert(`تم تصدير ${productsToExport.length} منتج بنجاح!`)
      onClose()

    } catch (error) {
      console.error('❌ PDF Export error:', error)
      alert('حدث خطأ أثناء إنشاء ملف PDF. يرجى المحاولة مرة أخرى.')
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setCurrentProductName('')
      setProcessedCount(0)
      setTotalCount(0)
    }
  }, [products, selectedProductIds, exportMode, columns, priceType, includeImages, onClose])

  if (!isOpen) return null

  const enabledColumnsCount = columns.filter(col => col.enabled).length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={!isExporting ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-xl shadow-2xl border border-[#4A5568] w-full max-w-2xl max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="px-6 py-4 border-b border-[#4A5568] flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex items-center gap-3">
              <DocumentArrowDownIcon className="h-6 w-6 text-white" />
              <div>
                <h3 className="text-lg font-bold text-white">Packing List</h3>
                <p className="text-sm text-blue-200">اختر المنتجات والأعمدة</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="p-2 text-white hover:text-gray-200 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] scrollbar-hide">

            {/* Export Mode Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                نطاق التصدير
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === 'all'}
                    onChange={() => setExportMode('all')}
                    disabled={isExporting}
                    className="w-4 h-4 text-blue-600 bg-[#2B3544] border-gray-600"
                  />
                  <span className="text-white">جميع المنتجات ({products.length})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === 'selected'}
                    onChange={() => setExportMode('selected')}
                    disabled={isExporting || selectedProductIds.length === 0}
                    className="w-4 h-4 text-blue-600 bg-[#2B3544] border-gray-600"
                  />
                  <span className={selectedProductIds.length === 0 ? 'text-gray-500' : 'text-white'}>
                    المنتجات المحددة ({selectedProductIds.length})
                  </span>
                </label>
              </div>

              {/* زر تفعيل وضع التحديد */}
              {onSelectModeRequest && selectedProductIds.length === 0 && (
                <button
                  onClick={() => {
                    onSelectModeRequest()
                    onClose()
                  }}
                  disabled={isExporting}
                  className="w-full mt-4 px-4 py-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  الانتقال لتحديد المنتجات
                </button>
              )}
            </div>

            {/* Price Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                نوع السعر
              </label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as PriceType)}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-[#374151] border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {PRICE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Include Images Toggle */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  disabled={isExporting}
                  className="w-5 h-5 text-blue-600 bg-[#2B3544] border-2 border-blue-500 rounded focus:ring-blue-500"
                />
                <span className="text-white font-medium">تضمين صور المنتجات</span>
              </label>
              {includeImages && (
                <p className="text-sm text-yellow-400 mt-2 pr-8">
                  ⚠️ تضمين الصور قد يستغرق وقتًا أطول
                </p>
              )}
            </div>

            {/* Columns Selection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-300">
                  الأعمدة المراد تصديرها
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAllColumns}
                    disabled={isExporting}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    تحديد الكل
                  </button>
                  <button
                    onClick={handleDeselectAllColumns}
                    disabled={isExporting}
                    className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>

              {/* Columns Grid */}
              <div className="grid grid-cols-2 gap-2">
                {columns.map(column => (
                  <label
                    key={column.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                      column.enabled
                        ? 'bg-blue-600/20 border-blue-500'
                        : 'bg-[#374151] border-gray-600 hover:bg-[#434E61]'
                    } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={column.enabled}
                      onChange={() => handleColumnToggle(column.id)}
                      disabled={isExporting}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-white text-sm font-medium">
                      {column.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-3 p-3 bg-[#374151] rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-400 font-medium">
                    {enabledColumnsCount} من أصل {columns.length}
                  </span>
                  <span className="text-gray-400">الأعمدة المحددة</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#4A5568] bg-[#374151]">
            {/* Progress Bar */}
            {isExporting && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    جاري التصدير... ({processedCount} من {totalCount})
                  </span>
                  <span className="text-sm font-bold text-blue-400">{exportProgress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                {currentProductName && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    📄 {currentProductName}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                إلغاء
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || enabledColumnsCount === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التصدير...
                  </>
                ) : (
                  <>
                    <DocumentArrowDownIcon className="h-5 w-5" />
                    تصدير PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
