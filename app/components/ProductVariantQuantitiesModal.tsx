'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import { Product, Branch } from '../lib/hooks/useProducts'
import {
  XMarkIcon,
  CheckIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline'
import Image from 'next/image'

interface ProductVariantQuantitiesModalProps {
  product: Product
  branches: Branch[]
  isOpen: boolean
  onClose: () => void
  onQuantitiesUpdated: () => void
}

interface VariantDefinition {
  id: string
  product_id: string
  variant_type: 'color' | 'shape'
  name: string | null
  color_hex: string | null
  image_url: string | null
  barcode: string | null
  sort_order: number
}

interface QuantityData {
  [variantId: string]: {
    [branchId: string]: number
  }
}

export default function ProductVariantQuantitiesModal({
  product,
  branches,
  isOpen,
  onClose,
  onQuantitiesUpdated
}: ProductVariantQuantitiesModalProps) {
  const [activeVariantType, setActiveVariantType] = useState<'color' | 'shape'>('color')
  const [definitions, setDefinitions] = useState<VariantDefinition[]>([])
  const [quantities, setQuantities] = useState<QuantityData>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

  // Load definitions and quantities when modal opens
  useEffect(() => {
    if (isOpen && product) {
      // Set default branch
      if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id)
      }
      loadDefinitionsAndQuantities()
    }
  }, [isOpen, product, activeVariantType])

  // Reload quantities when branch changes
  useEffect(() => {
    if (isOpen && selectedBranchId) {
      loadQuantitiesForBranch()
    }
  }, [selectedBranchId])

  const loadDefinitionsAndQuantities = async () => {
    setIsLoading(true)
    try {
      // Load variant definitions
      const { data: defs, error: defsError } = await supabase
        .from('product_color_shape_definitions')
        .select('*')
        .eq('product_id', product.id)
        .eq('variant_type', activeVariantType)
        .order('sort_order', { ascending: true })

      if (defsError) throw defsError
      setDefinitions((defs || []) as any)

      // Load all quantities for these variants across all branches
      if (defs && defs.length > 0) {
        const variantIds = defs.map(d => d.id)
        const { data: qtys, error: qtysError } = await supabase
          .from('product_variant_quantities')
          .select('*')
          .in('variant_definition_id', variantIds)

        if (qtysError) throw qtysError

        // Organize quantities by variant and branch
        const qtyData: QuantityData = {}
        defs.forEach(def => {
          qtyData[def.id] = {}
          branches.forEach(branch => {
            qtyData[def.id][branch.id] = 0
          })
        })

        qtys?.forEach(qty => {
          if (qtyData[qty.variant_definition_id]) {
            qtyData[qty.variant_definition_id][qty.branch_id] = qty.quantity
          }
        })

        setQuantities(qtyData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuantitiesForBranch = async () => {
    if (!selectedBranchId || definitions.length === 0) return

    try {
      const variantIds = definitions.map(d => d.id)
      const { data: qtys, error } = await supabase
        .from('product_variant_quantities')
        .select('*')
        .in('variant_definition_id', variantIds)
        .eq('branch_id', selectedBranchId)

      if (error) throw error

      // Update quantities state for this branch
      setQuantities(prev => {
        const updated = { ...prev }
        definitions.forEach(def => {
          const qty = qtys?.find(q => q.variant_definition_id === def.id)
          if (!updated[def.id]) updated[def.id] = {}
          updated[def.id][selectedBranchId] = qty?.quantity || 0
        })
        return updated
      })
    } catch (error) {
      console.error('Error loading quantities:', error)
    }
  }

  const handleQuantityChange = (variantId: string, branchId: string, value: string) => {
    const numValue = parseInt(value) || 0
    setQuantities(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [branchId]: numValue
      }
    }))
  }

  const handleSave = async () => {
    if (!selectedBranchId) {
      alert('يرجى اختيار فرع')
      return
    }

    setIsSaving(true)
    try {
      // Prepare upsert data for the selected branch only
      const upsertData = definitions.map(def => ({
        variant_definition_id: def.id,
        branch_id: selectedBranchId,
        quantity: quantities[def.id]?.[selectedBranchId] || 0,
        updated_at: new Date().toISOString()
      }))

      // Upsert quantities (update if exists, insert if not)
      const { error } = await supabase
        .from('product_variant_quantities')
        .upsert(upsertData, {
          onConflict: 'variant_definition_id,branch_id'
        })

      if (error) throw error

      alert('تم حفظ الكميات بنجاح!')
      onQuantitiesUpdated()
    } catch (error) {
      console.error('Error saving quantities:', error)
      alert('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedBranch = branches.find(b => b.id === selectedBranchId)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BuildingStorefrontIcon className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">تحديد كميات الألوان والأشكال</h2>
              <p className="text-sm text-green-100">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Branch Selection & Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Branch Selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">الفرع:</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Variant Type Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveVariantType('color')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeVariantType === 'color'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                الألوان
              </button>
              <button
                onClick={() => setActiveVariantType('shape')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeVariantType === 'shape'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                الأشكال
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">جاري التحميل...</p>
            </div>
          ) : definitions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BuildingStorefrontIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">لا توجد {activeVariantType === 'color' ? 'ألوان' : 'أشكال'} محددة لهذا المنتج</p>
              <p className="text-sm mt-2">
                يجب أولاً إضافة {activeVariantType === 'color' ? 'ألوان' : 'أشكال'} للمنتج من خلال صفحة إدارة الألوان والأشكال
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-bold">ملاحظة:</span> أدخل الكمية المتوفرة من كل {activeVariantType === 'color' ? 'لون' : 'شكل'} في <span className="font-bold">{selectedBranch?.name}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {definitions.map((def) => (
                  <div
                    key={def.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-green-400 transition-colors"
                  >
                    {/* Image */}
                    {def.image_url && (
                      <div className="relative w-full h-40 mb-3 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={def.image_url}
                          alt={def.name || 'شكل المنتج'}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-product.svg'
                          }}
                        />
                      </div>
                    )}

                    {/* Name & Color */}
                    <div className="mb-3">
                      {def.name && (
                        <h4 className="font-bold text-gray-800 mb-1">{def.name}</h4>
                      )}
                      {def.color_hex && (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded border border-gray-300"
                            style={{ backgroundColor: def.color_hex }}
                          ></div>
                          <span className="text-xs text-gray-600">{def.color_hex}</span>
                        </div>
                      )}
                    </div>

                    {/* Quantity Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        الكمية
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={quantities[def.id]?.[selectedBranchId] || 0}
                        onChange={(e) => handleQuantityChange(def.id, selectedBranchId, e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-center text-lg font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || definitions.length === 0}
            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2 font-medium"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                جاري الحفظ...
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                حفظ الكميات
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
