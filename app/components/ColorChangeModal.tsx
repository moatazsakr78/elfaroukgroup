'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase/client'
import { Product, Branch, ProductVariant } from '../lib/hooks/useProducts'
import { 
  XMarkIcon, 
  CheckIcon,
  TagIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  PlusIcon,
  MinusIcon
} from '@heroicons/react/24/outline'

interface ColorChangeModalProps {
  product: Product
  branches: Branch[]
  isOpen: boolean
  onClose: () => void
  onColorChangeComplete: () => void
}

interface ProductColor {
  name: string
  color: string
  image?: string
}

interface ColorQuantity {
  colorName: string
  color: string
  quantity: number
  maxQuantity?: number // للألوان في قسم "من" - أقصى كمية متاحة
}

export default function ColorChangeModal({ 
  product, 
  branches, 
  isOpen, 
  onClose, 
  onColorChangeComplete 
}: ColorChangeModalProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [fromColors, setFromColors] = useState<ColorQuantity[]>([])
  const [toColors, setToColors] = useState<ColorQuantity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Get product colors from the product data
  const productColors = useMemo((): ProductColor[] => {
    let colors: ProductColor[] = []

    // Try to get colors from productColors property
    if (product.productColors && Array.isArray(product.productColors) && product.productColors.length > 0) {
      colors = product.productColors
    }
    // Fallback - try to parse from description field
    else if (product.description && product.description.startsWith('{')) {
      try {
        const descriptionData = JSON.parse(product.description)
        colors = descriptionData.colors || []
      } catch (e) {
        console.error('Error parsing product colors from description:', e)
      }
    }

    return colors
  }, [product.description, product.productColors])

  // Get available branches with color variants
  const availableBranches = useMemo(() => {
    return branches.filter(branch => {
      const variants = product.variantsData?.[branch.id] || []
      const colorVariants = variants.filter(v => 
        v.variant_type === 'color' && v.name !== 'غير محدد' && v.quantity > 0
      )
      return colorVariants.length > 0
    }).map(branch => ({
      id: branch.id,
      name: branch.name,
      colorVariants: (product.variantsData?.[branch.id] || []).filter(v => 
        v.variant_type === 'color' && v.name !== 'غير محدد' && v.quantity > 0
      )
    }))
  }, [product, branches])

  // Initialize from colors when branch is selected
  useEffect(() => {
    if (selectedBranchId && availableBranches.length > 0) {
      const selectedBranch = availableBranches.find(b => b.id === selectedBranchId)
      if (selectedBranch) {
        const fromColorsList: ColorQuantity[] = selectedBranch.colorVariants.map(variant => ({
          colorName: variant.name,
          color: getColorHex(variant.name),
          quantity: 0, // يبدأ بصفر - المستخدم يحدد كم يريد أن يأخذ
          maxQuantity: variant.quantity // الحد الأقصى المتاح
        }))
        
        setFromColors(fromColorsList)
        
        // Initialize "to" colors with all available product colors starting at 0
        const toColorsList: ColorQuantity[] = productColors.map(color => ({
          colorName: color.name,
          color: color.color,
          quantity: 0
        }))
        
        setToColors(toColorsList)
      }
    }
  }, [selectedBranchId, availableBranches, productColors])

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedBranchId(null)
      setFromColors([])
      setToColors([])
    }
  }, [isOpen])

  // Helper function to get color hex
  const getColorHex = (colorName: string): string => {
    const color = productColors.find(c => c.name === colorName)
    return color?.color || '#6B7280'
  }

  // Calculate totals
  const getTotalFrom = () => fromColors.reduce((sum, color) => sum + color.quantity, 0)
  const getTotalTo = () => toColors.reduce((sum, color) => sum + color.quantity, 0)
  const isBalanced = () => getTotalFrom() === getTotalTo()

  // Update "from" color quantity
  const updateFromColorQuantity = (index: number, newQuantity: number) => {
    const newFromColors = [...fromColors]
    const maxQuantity = newFromColors[index].maxQuantity || 0
    
    // Ensure quantity doesn't exceed max available or go below 0
    const clampedQuantity = Math.max(0, Math.min(newQuantity, maxQuantity))
    newFromColors[index].quantity = clampedQuantity
    
    setFromColors(newFromColors)
  }


  // Update "to" color quantity
  const updateToColorQuantity = (index: number, newQuantity: number) => {
    const newToColors = [...toColors]
    // Ensure quantity doesn't go below 0
    const clampedQuantity = Math.max(0, newQuantity)
    newToColors[index].quantity = clampedQuantity
    setToColors(newToColors)
  }

  // Check if changes can be saved
  const canSave = () => {
    const hasToColors = toColors.some(color => color.quantity > 0)
    return selectedBranchId && isBalanced() && hasToColors
  }

  const handleSave = async () => {
    if (!selectedBranchId || !canSave()) return

    setIsSaving(true)
    try {
      const selectedBranch = availableBranches.find(b => b.id === selectedBranchId)
      if (!selectedBranch) return

      // Step 1: Update existing variant quantities by reducing based on "from" selection
      for (const fromColor of fromColors) {
        if (fromColor.quantity > 0) {
          // Get the color definition ID from product_color_shape_definitions
          const { data: colorDef, error: defError } = await supabase
            .from('product_color_shape_definitions')
            .select('id')
            .eq('product_id', product.id)
            .eq('name', fromColor.colorName)
            .eq('variant_type', 'color')
            .single()

          if (defError || !colorDef) {
            console.error('Error getting color definition:', defError)
            throw new Error(`لم يتم العثور على تعريف اللون: ${fromColor.colorName}`)
          }

          // Get current quantity from product_variant_quantities
          const { data: currentQty, error: qtyGetError } = await supabase
            .from('product_variant_quantities')
            .select('quantity')
            .eq('variant_definition_id', colorDef.id)
            .eq('branch_id', selectedBranchId)
            .single()

          if (qtyGetError && qtyGetError.code !== 'PGRST116') {
            console.error('Error getting current quantity:', qtyGetError)
            throw qtyGetError
          }

          const currentQuantity = currentQty?.quantity || 0
          const newQuantity = Math.max(0, currentQuantity - fromColor.quantity)

          if (newQuantity <= 0) {
            // Delete quantity entry if it becomes 0
            const { error: deleteError } = await supabase
              .from('product_variant_quantities')
              .delete()
              .eq('variant_definition_id', colorDef.id)
              .eq('branch_id', selectedBranchId)

            if (deleteError) {
              console.error('Error deleting variant quantity:', deleteError)
              throw deleteError
            }
          } else {
            // Update quantity
            const { error: updateError } = await supabase
              .from('product_variant_quantities')
              .update({
                quantity: newQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('variant_definition_id', colorDef.id)
              .eq('branch_id', selectedBranchId)

            if (updateError) {
              console.error('Error updating variant quantity:', updateError)
              throw updateError
            }
          }
        }
      }

      // Step 2: Add or update variant quantities based on "to" colors (only colors with quantity > 0)
      for (const toColor of toColors.filter(color => color.quantity > 0)) {
        const colorData = productColors.find(c => c.name === toColor.colorName)

        // Get the color definition ID from product_color_shape_definitions
        const { data: colorDef, error: defError } = await supabase
          .from('product_color_shape_definitions')
          .select('id')
          .eq('product_id', product.id)
          .eq('name', toColor.colorName)
          .eq('variant_type', 'color')
          .single()

        if (defError || !colorDef) {
          console.error('Error getting color definition:', defError)
          throw new Error(`لم يتم العثور على تعريف اللون: ${toColor.colorName}`)
        }

        // Get current quantity from product_variant_quantities
        const { data: currentQty, error: qtyGetError } = await supabase
          .from('product_variant_quantities')
          .select('quantity')
          .eq('variant_definition_id', colorDef.id)
          .eq('branch_id', selectedBranchId)
          .single()

        if (qtyGetError && qtyGetError.code !== 'PGRST116') {
          console.error('Error getting current quantity:', qtyGetError)
          throw qtyGetError
        }

        const currentQuantity = currentQty?.quantity || 0
        const newQuantity = currentQuantity + toColor.quantity

        // Upsert the new quantity
        const { error: upsertError } = await supabase
          .from('product_variant_quantities')
          .upsert({
            variant_definition_id: colorDef.id,
            branch_id: selectedBranchId,
            quantity: newQuantity,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'variant_definition_id,branch_id'
          })

        if (upsertError) {
          console.error('Error upserting variant quantity:', upsertError)
          throw upsertError
        }
      }

      console.log('Color change completed successfully!')
      onColorChangeComplete()
    } catch (error) {
      console.error('Error saving color changes:', error)
      
      let errorMessage = 'حدث خطأ أثناء حفظ تغيير الألوان'
      if (error && typeof error === 'object') {
        const err = error as any
        if (err.message) {
          errorMessage = `خطأ في قاعدة البيانات: ${err.message}`
        }
      }
      
      alert(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-5xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
          
          {/* Header */}
          <div className="sticky top-0 bg-[#2B3544] px-8 py-6 border-b border-[#4A5568] flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center">
                <ArrowPathIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">تغيير ألوان المنتج</h2>
                <p className="text-blue-400 font-medium">{product.name}</p>
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
          <div className="p-8">
            {!selectedBranchId ? (
              /* Branch Selection Step */
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <BuildingStorefrontIcon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">اختر الفرع المراد تغيير ألوانه</h3>
                </div>

                {availableBranches.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TagIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-lg mb-2">لا توجد ألوان محددة للتغيير</p>
                    <p className="text-gray-500 text-sm">يجب تحديد الألوان أولاً قبل التمكن من تغييرها</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {availableBranches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => setSelectedBranchId(branch.id)}
                        className="bg-[#374151] hover:bg-[#434E61] border border-[#4A5568] rounded-xl p-6 text-right transition-colors group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                            <BuildingStorefrontIcon className="h-6 w-6 text-orange-400" />
                          </div>
                          <h4 className="text-white font-semibold text-lg">{branch.name}</h4>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-400 font-bold text-xl">{branch.colorVariants.length}</span>
                            <span className="text-gray-400">عدد الألوان المحددة</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-green-400 font-medium">
                              {branch.colorVariants.reduce((sum, v) => sum + v.quantity, 0)}
                            </span>
                            <span className="text-gray-400">إجمالي الكميات</span>
                          </div>

                          {/* Show existing colors */}
                          <div className="pt-2 border-t border-gray-600/50">
                            <p className="text-gray-400 text-sm mb-2">الألوان الحالية:</p>
                            <div className="flex flex-wrap gap-1">
                              {branch.colorVariants.map((variant, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-600 text-white"
                                >
                                  <div 
                                    className="w-3 h-3 rounded-full border border-white/30 mr-1"
                                    style={{ backgroundColor: getColorHex(variant.name) }}
                                  />
                                  {variant.name} ({variant.quantity})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Color Change Interface */
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-600/20 rounded-lg flex items-center justify-center">
                      <ArrowPathIcon className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">الألوان الحالية المتاحة للتغيير</h3>
                      <p className="text-gray-400 text-sm">
                        الفرع: {availableBranches.find(b => b.id === selectedBranchId)?.name}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedBranchId(null)
                      setFromColors([])
                      setToColors([])
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded transition-colors"
                  >
                    تغيير الفرع
                  </button>
                </div>

                {/* Two Column Layout: From and To */}
                <div className="grid grid-cols-2 gap-6">
                  
                  {/* FROM Section */}
                  <div className="space-y-4">
                    <div className="bg-[#374151] rounded-lg p-4 border border-[#4A5568]">
                      <h4 className="text-white font-medium mb-4 text-center">من</h4>
                      <div className="text-center mb-4">
                        <div className="text-purple-400 text-2xl font-bold">
                          {getTotalFrom()}
                        </div>
                        <div className="text-gray-400 text-sm">الكمية</div>
                        <div className="text-red-400 text-xs mt-1">
                          يجب أن يساوي {getTotalTo()}
                        </div>
                      </div>
                      
                      {/* From Colors List */}
                      <div className="space-y-3">
                        {fromColors.map((color, index) => (
                          <div key={index} className="bg-[#2B3544] rounded-lg p-3 border border-gray-600">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-6 h-6 rounded-full border border-gray-500"
                                  style={{ backgroundColor: color.color }}
                                />
                                <span className="text-white font-medium">{color.colorName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateFromColorQuantity(index, color.quantity - 1)}
                                  disabled={color.quantity <= 0}
                                  className="w-6 h-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center text-sm"
                                >
                                  <MinusIcon className="h-3 w-3" />
                                </button>
                                <span className="text-white font-medium w-8 text-center">{color.quantity}</span>
                                <button
                                  onClick={() => updateFromColorQuantity(index, color.quantity + 1)}
                                  disabled={color.quantity >= (color.maxQuantity || 0)}
                                  className="w-6 h-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center text-sm"
                                >
                                  <PlusIcon className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-right text-xs text-gray-400 mt-1">
                              متاح: {color.maxQuantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* TO Section */}
                  <div className="space-y-4">
                    <div className="bg-[#374151] rounded-lg p-4 border border-[#4A5568]">
                      <h4 className="text-white font-medium mb-4 text-center">تغيير إلى</h4>
                      
                      <div className="text-center mb-4">
                        <div className={`text-2xl font-bold ${
                          isBalanced() ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {getTotalTo()}
                        </div>
                        <div className="text-gray-400 text-sm">الكمية</div>
                        {!isBalanced() && (
                          <div className="text-red-400 text-xs mt-1">
                            يجب أن تساوي {getTotalFrom()}
                          </div>
                        )}
                      </div>
                      
                      {/* To Colors List */}
                      <div className="space-y-3">
                        {toColors.map((color, index) => (
                          <div key={index} className="bg-[#2B3544] rounded-lg p-3 border border-gray-600">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-6 h-6 rounded-full border border-gray-500"
                                  style={{ backgroundColor: color.color }}
                                />
                                <span className="text-white font-medium">{color.colorName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateToColorQuantity(index, color.quantity - 1)}
                                  disabled={color.quantity <= 0}
                                  className="w-6 h-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center text-sm"
                                >
                                  <MinusIcon className="h-3 w-3" />
                                </button>
                                <span className="text-white font-medium w-8 text-center">{color.quantity}</span>
                                <button
                                  onClick={() => updateToColorQuantity(index, color.quantity + 1)}
                                  className="w-6 h-6 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center text-sm"
                                >
                                  <PlusIcon className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Status */}
                <div className={`mt-6 p-4 rounded-lg border ${
                  isBalanced() 
                    ? 'bg-green-600/20 border-green-500/30' 
                    : 'bg-red-600/20 border-red-500/30'
                }`}>
                  <div className="text-center">
                    {isBalanced() ? (
                      <p className="text-green-400 font-medium">
                        ✅ الكميات متوازنة - يمكن الحفظ
                      </p>
                    ) : (
                      <p className="text-red-400 font-medium">
                        ⚠️ الكميات غير متوازنة - من: {getTotalFrom()}, إلى: {getTotalTo()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-[#4A5568]">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 text-gray-300 hover:text-white bg-transparent hover:bg-gray-600/20 border border-gray-600 hover:border-gray-500 rounded transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!canSave() || isSaving}
                    className={`px-6 py-2 rounded transition-colors flex items-center gap-2 ${
                      canSave() && !isSaving
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-4 w-4" />
                        حفظ التغييرات
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}