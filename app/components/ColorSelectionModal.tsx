'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { XMarkIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import { useCurrency } from '../../lib/hooks/useCurrency'

interface ColorSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  product: any
  onAddToCart: (selections: any, totalQuantity: number, purchasePrice?: number) => void
  hasRequiredForCart?: boolean
  selectedBranchId?: string
  isPurchaseMode?: boolean
  isTransferMode?: boolean
  transferFromLocation?: {
    id: number
    name: string
    type: 'branch' | 'warehouse'
  }
}

export default function ColorSelectionModal({
  isOpen,
  onClose,
  product,
  onAddToCart,
  hasRequiredForCart = true,
  selectedBranchId,
  isPurchaseMode = false,
  isTransferMode = false,
  transferFromLocation
}: ColorSelectionModalProps) {
  const [selections, setSelections] = useState<{[key: string]: number}>({})
  const [manualQuantity, setManualQuantity] = useState(1) // للمنتجات بدون ألوان
  const [editingColorQuantity, setEditingColorQuantity] = useState<string | null>(null)

  // Reference to the quantity input for auto-focus
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const [tempColorQuantities, setTempColorQuantities] = useState<{[key: string]: string}>({})

  // Purchase mode specific state
  const [purchasePrice, setPurchasePrice] = useState(product?.cost_price || product?.price || 0)
  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [tempPrice, setTempPrice] = useState('')

  // Use dynamic currency from system settings
  const { formatPrice, getCurrentCurrency } = useCurrency()
  const currentCurrency = getCurrentCurrency('system')

  // Reset purchase price when product changes
  useEffect(() => {
    if (product && isPurchaseMode) {
      const initialPrice = product.cost_price || product.price || 0
      setPurchasePrice(initialPrice)
      setTempPrice(initialPrice.toString())
    }
  }, [product, isPurchaseMode])

  // منطق استخراج الألوان المتاحة
  const getProductColors = () => {
    if (!product || isPurchaseMode) return []

    const colors: any[] = []
    const unspecifiedVariants: any[] = []
    const specifiedColors: any[] = []

    // استخراج الألوان من وصف المنتج (JSON فقط)
    if (product.description) {
      try {
        // تنظيف النص قبل parsing
        let cleanedDescription = product.description.trim()
        
        // التحقق من أن النص هو JSON صحيح بالتحقق من البداية والنهاية
        const isValidJSON = (cleanedDescription.startsWith('{') && cleanedDescription.endsWith('}')) || 
                           (cleanedDescription.startsWith('[') && cleanedDescription.endsWith(']'))
        
        if (isValidJSON) {
          // إزالة أي أحرف غير صالحة في JSON
          cleanedDescription = cleanedDescription.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
          
          const descriptionData = JSON.parse(cleanedDescription)
          if (descriptionData.colors && Array.isArray(descriptionData.colors)) {
            let totalBranchQuantity = 0
            if (product.inventoryData && selectedBranchId && product.inventoryData[selectedBranchId]) {
              totalBranchQuantity = product.inventoryData[selectedBranchId]?.quantity || 0
            }

            const quantityPerColor = descriptionData.colors.length > 0
              ? Math.floor(totalBranchQuantity / descriptionData.colors.length)
              : totalBranchQuantity

            descriptionData.colors.forEach((color: any, index: number) => {
              let colorImage = color.image || null

              if (!colorImage && product.video_url) {
                try {
                  const cleanedVideoUrl = product.video_url.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
                  if ((cleanedVideoUrl.startsWith('{') && cleanedVideoUrl.endsWith('}')) || 
                      (cleanedVideoUrl.startsWith('[') && cleanedVideoUrl.endsWith(']'))) {
                    const additionalImages = JSON.parse(cleanedVideoUrl)
                    if (Array.isArray(additionalImages) && additionalImages[index]) {
                      colorImage = additionalImages[index]
                    }
                  }
                } catch (e) {
                  // تجاهل الخطأ بصمت - video_url ليس JSON صالح
                }
              }

              specifiedColors.push({
                name: color.name,
                color: color.color || '#6B7280',
                availableQuantity: quantityPerColor,
                image: colorImage
              })
            })
          }
        }
        // إذا لم يكن JSON صالح، لا نعرض أي تحذير لأن الوصف قد يكون نص عادي
      } catch (e) {
        // تجاهل الخطأ بصمت - الوصف ليس JSON صالح، وهذا أمر طبيعي
      }
    }

    // استخراج الألوان من بيانات المتغيرات
    const effectiveBranchId = isTransferMode && transferFromLocation
      ? (transferFromLocation.type === 'branch' ? transferFromLocation.id.toString() : null)
      : selectedBranchId

    if (product.variantsData && effectiveBranchId && product.variantsData[effectiveBranchId]) {
      product.variantsData[effectiveBranchId].forEach((variant: any) => {
        if (variant.variant_type === 'color') {
          if (variant.name === 'غير محدد') {
            unspecifiedVariants.push(variant)
          } else {
            const existingColor = specifiedColors.find(c => c.name === variant.name)
            if (!existingColor) {
              let colorValue = '#6B7280'

              // استخراج اللون من JSON
              try {
                if (variant.value && typeof variant.value === 'string' && variant.value.trim().startsWith('{')) {
                  // تنظيف النص قبل parsing
                  const cleanedValue = variant.value.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
                  const valueData = JSON.parse(cleanedValue)
                  if (valueData.color) colorValue = valueData.color
                }
              } catch (e) {
                console.warn('Failed to parse variant value JSON:', e, 'Value:', variant.value)
              }

              // خريطة الألوان العربية
              const colorMapping: { [key: string]: string } = {
                'أسود': '#000000', 'أبيض': '#FFFFFF', 'أحمر': '#FF0000',
                'أزرق': '#0000FF', 'أخضر': '#008000', 'أصفر': '#FFFF00',
                'برتقالي': '#FFA500', 'بنفسجي': '#800080', 'وردي': '#FFC0CB',
                'بني': '#A52A2A', 'رمادي': '#808080', 'فضي': '#C0C0C0',
                'ذهبي': '#FFD700', 'كاشمير': '#D2B48C', 'كحلي': '#000080'
              }

              if (colorMapping[variant.name]) colorValue = colorMapping[variant.name]

              let imageUrl = variant.image_url || null

              specifiedColors.push({
                name: variant.name,
                color: colorValue,
                availableQuantity: variant.quantity || 0,
                image: imageUrl
              })
            }
          }
        }
      })
    }

    colors.push(...specifiedColors)

    // إضافة "غير محدد الكلي" إذا كانت هناك كمية متاحة
    if (unspecifiedVariants.length > 0 && specifiedColors.length > 0) {
      const totalUnspecifiedQuantity = unspecifiedVariants.reduce((sum, v) => sum + v.quantity, 0)

      if (totalUnspecifiedQuantity > 0) {
        colors.push({
          name: 'غير محدد الكلي',
          color: '#6B7280',
          availableQuantity: totalUnspecifiedQuantity,
          image: null
        })
      }
    }

    return colors
  }

  const colors = getProductColors()

  // حساب الكمية الإجمالية: إذا كان هناك ألوان، نحسب من selections، وإلا نستخدم manualQuantity
  const totalQuantity = colors.length > 0
    ? Object.values(selections).reduce((sum, qty) => sum + qty, 0)
    : manualQuantity

  // دوال التعامل مع الكميات
  const handleQuantityChange = (colorName: string, change: number) => {
    setSelections(prev => {
      const current = prev[colorName] || 0
      const color = colors.find(c => c.name === colorName)
      const maxAvailable = color?.availableQuantity || 0

      let newValue = Math.max(0, current + change)

      if (newValue > maxAvailable) {
        newValue = maxAvailable
      }

      if (newValue === 0) {
        const { [colorName]: removed, ...rest } = prev
        return rest
      }

      return { ...prev, [colorName]: newValue }
    })
  }

  // دالة لتغيير الكمية اليدوية (للمنتجات بدون ألوان)
  const handleManualQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, manualQuantity + change)
    setManualQuantity(newQuantity)
  }

  const selectedQuantity = Object.values(selections).reduce((sum, qty) => sum + qty, 0)
  const totalPrice = isTransferMode ? 0 : totalQuantity * (isPurchaseMode ? purchasePrice : (product?.price || 0))

  // تحقق من صحة البيانات
  const getValidationInfo = () => {
    if (colors.length === 0) {
      return { isValid: true, message: '' }
    }

    if (selectedQuantity > totalQuantity) {
      return {
        isValid: false,
        message: 'الكمية المحددة للألوان أكبر من الكمية المطلوبة'
      }
    }

    return { isValid: true, message: '' }
  }

  const validationInfo = getValidationInfo()

  const handleAddToCart = useCallback(() => {
    if (totalQuantity > 0 && validationInfo.isValid) {
      if (isPurchaseMode) {
        onAddToCart(selections, totalQuantity, purchasePrice)
      } else {
        onAddToCart(selections, totalQuantity)
      }
      onClose()
      setSelections({})
      setManualQuantity(1) // إعادة تعيين الكمية اليدوية
    }
  }, [totalQuantity, validationInfo.isValid, isPurchaseMode, onAddToCart, selections, purchasePrice, onClose])

  // Enter key shortcut to add to cart
  useEffect(() => {
    if (!isOpen || !product) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleAddToCart()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, product, handleAddToCart])

  // Auto-focus quantity input when modal opens (for products without colors)
  useEffect(() => {
    if (isOpen && product && quantityInputRef.current) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        quantityInputRef.current?.focus()
        quantityInputRef.current?.select()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, product])

  // Early return AFTER all hooks are called
  if (!isOpen || !product) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-lg max-h-[90vh] overflow-hidden pointer-events-auto relative transform transition-transform duration-200 modal-container">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🎨</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{product.name}</h2>
                <p className={`text-sm ${isTransferMode ? 'text-orange-400' : 'text-blue-400'}`}>
                  {isTransferMode
                    ? `وضع النقل - من: ${transferFromLocation?.name || 'غير محدد'}`
                    : isPurchaseMode
                      ? 'وضع الشراء'
                      : formatPrice(product.price || 0, 'system')
                  }
                </p>
              </div>
            </div>
            <button onClick={onClose}>
              <XMarkIcon className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide relative modal-content">

            {/* Total Quantity Selector */}
            <div className="bg-[#374151] rounded-xl p-4 border border-[#4A5568]">
              <label className="text-gray-300 text-sm mb-3 block">الكمية الإجمالية</label>
              <div className="flex items-center justify-between gap-4">

                {/* Product Image */}
                <div className="w-20 h-20 bg-[#2B3544] rounded-lg flex items-center justify-center overflow-hidden border border-[#4A5568] flex-shrink-0 relative">
                  {product.main_image_url ? (
                    <img src={product.main_image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                      <span className="text-lg">📦</span>
                    </div>
                  )}
                </div>

                {/* Quantity Controls - Different based on colors */}
                {colors.length > 0 ? (
                  /* Read-only when colors exist */
                  <div className="flex items-center gap-4 flex-1 justify-center relative">
                    <div className="bg-[#2B3544] text-white font-bold text-xl text-center rounded-lg px-4 py-2 min-w-[80px] border-2 border-gray-600">
                      {totalQuantity}
                    </div>
                  </div>
                ) : (
                  /* Editable with buttons when no colors */
                  <div className="flex items-center gap-4 flex-1 justify-center relative">
                    <button
                      onClick={() => handleManualQuantityChange(-1)}
                      className="w-8 h-8 bg-[#374151] hover:bg-[#4A5568] rounded-lg flex items-center justify-center transition-colors duration-150 flex-shrink-0"
                    >
                      <MinusIcon className="h-4 w-4 text-white" />
                    </button>
                    <input
                      ref={quantityInputRef}
                      type="text"
                      value={manualQuantity}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '' || /^\d+$/.test(value)) {
                          const num = parseInt(value) || 1
                          if (num >= 1 && num <= 9999) {
                            setManualQuantity(num)
                          }
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="bg-[#2B3544] text-white font-bold text-lg text-center rounded-lg px-4 py-2 w-[70px] outline-none border-2 border-transparent focus:border-blue-500 hover:bg-[#374151] transition-all cursor-pointer"
                      placeholder="1"
                    />
                    <button
                      onClick={() => handleManualQuantityChange(1)}
                      className="w-8 h-8 bg-[#374151] hover:bg-[#4A5568] rounded-lg flex items-center justify-center transition-colors duration-150 flex-shrink-0"
                    >
                      <PlusIcon className="h-4 w-4 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {!isTransferMode && (
                <div className="text-center mt-3">
                  <span className="text-blue-400 font-bold text-lg">{formatPrice(totalPrice, 'system')}</span>
                </div>
              )}
            </div>

            {/* Color Selection */}
            {colors.length > 0 && (
              <div>
                <h3 className="text-white font-medium mb-3">اختيار الألوان</h3>

                {!validationInfo.isValid && (
                  <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{validationInfo.message}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {colors.map((color) => (
                    <div key={color.name} className="bg-[#374151] rounded-xl p-4 border border-[#4A5568] relative">

                      {/* Color Display */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-[#2B3544] rounded-lg flex items-center justify-center overflow-hidden border border-[#4A5568] flex-shrink-0 relative">
                          {color.image ? (
                            <img src={color.image} alt={color.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full rounded-lg flex items-center justify-center relative" style={{ backgroundColor: color.color }}>
                              {color.name === 'غير محدد الكلي' ? (
                                <span className="text-white text-lg font-bold">؟</span>
                              ) : (
                                <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: color.color }}></div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0" style={{ backgroundColor: color.color }} />
                            <span className="text-white font-medium text-sm truncate">{color.name}</span>
                          </div>
                          <p className="text-gray-400 text-xs">متوفر: {color.availableQuantity}</p>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between relative">
                        <button 
                          onClick={() => handleQuantityChange(color.name, -1)} 
                          disabled={!selections[color.name]}
                          className="w-8 h-8 bg-[#2B3544] hover:bg-[#4A5568] disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors duration-150 flex-shrink-0"
                        >
                          <MinusIcon className="h-4 w-4 text-white" />
                        </button>

                        <div className="bg-[#2B3544] rounded-lg px-3 py-2 min-w-[50px] text-center relative mx-2">
                          <span className="text-white font-bold">{selections[color.name] || 0}</span>
                        </div>

                        <button 
                          onClick={() => handleQuantityChange(color.name, 1)} 
                          disabled={(selections[color.name] || 0) >= color.availableQuantity}
                          className="w-8 h-8 bg-[#2B3544] hover:bg-[#4A5568] disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors duration-150 flex-shrink-0"
                        >
                          <PlusIcon className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {colors.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-400">
                  {isPurchaseMode
                    ? 'في وضع الشراء، يتم تخزين الكمية كـ "غير محدد" بدون تحديد ألوان'
                    : 'لا توجد ألوان متاحة لهذا المنتج'
                  }
                </p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#4A5568] relative bg-[#2B3544]">
            <div className="flex gap-3">
              <button 
                onClick={onClose} 
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors duration-150 relative"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddToCart}
                disabled={totalQuantity === 0 || !validationInfo.isValid}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors duration-150 flex items-center justify-center gap-2 relative ${
                  totalQuantity === 0 || !validationInfo.isValid
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : isTransferMode
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : isPurchaseMode
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                <ShoppingCartIcon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">
                  {!validationInfo.isValid
                    ? 'غير متاح للإضافة'
                    : isTransferMode
                      ? `إضافة للنقل (${totalQuantity}) [Enter]`
                      : isPurchaseMode
                        ? `إضافة للشراء (${totalQuantity}) [Enter]`
                        : `إضافة للسلة (${totalQuantity}) [Enter]`
                  }
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        /* ثبات النافذة ومنع التحرك غير المرغوب */
        .modal-container {
          will-change: auto;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
        
        /* ثبات العناصر الداخلية */
        .modal-content * {
          position: relative;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
      `}</style>
    </>
  )
}
