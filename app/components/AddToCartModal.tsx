'use client'

import { useState, useEffect, useCallback } from 'react'
import { XMarkIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import { useCurrency } from '../../lib/hooks/useCurrency'

interface AddToCartModalProps {
  isOpen: boolean
  onClose: () => void
  product: any
  onAddToCart: (product: any, quantity: number, selectedColor?: string) => void
  isTransferMode?: boolean
}

export default function AddToCartModal({ isOpen, onClose, product, onAddToCart, isTransferMode = false }: AddToCartModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)

  // Use dynamic currency from system settings
  const { formatPrice, getCurrentCurrency } = useCurrency()
  const currentCurrency = getCurrentCurrency('system')

  if (!isOpen || !product) return null

  // دالة تغيير الكمية بالأزرار
  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, quantity + change)
    setQuantity(newQuantity)
  }

  const handleAddToCart = useCallback(() => {
    onAddToCart(product, quantity, selectedColor || undefined)
    onClose()
    setQuantity(1)
    setSelectedColor(null)
  }, [onAddToCart, product, quantity, selectedColor, onClose])

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

  // الألوان المتاحة
  const colors = [
    { name: 'أزرق', color: '#3B82F6' },
    { name: 'أحمر', color: '#EF4444' },
    { name: 'أخضر', color: '#10B981' },
    { name: 'أصفر', color: '#F59E0B' },
    { name: 'بنفسجي', color: '#8B5CF6' },
    { name: 'وردي', color: '#EC4899' }
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-md">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#4A5568]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isTransferMode ? 'bg-orange-600' : 'bg-blue-600'}`}>
                <ShoppingCartIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">
                {isTransferMode ? 'إضافة للنقل' : 'إضافة للسلة'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">

            {/* Product Info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#374151] rounded-lg flex items-center justify-center overflow-hidden">
                {product.main_image_url ? (
                  <img
                    src={product.main_image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-lg">😊</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium text-sm">{product.name}</h3>
                {!isTransferMode && (
                  <p className="text-blue-400 font-bold text-lg">{formatPrice(product.price || 0, 'system')}</p>
                )}
                {isTransferMode && (
                  <p className="text-orange-400 font-bold text-sm">وضع النقل</p>
                )}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-3">
              <label className="text-gray-300 text-sm">الكمية</label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  className="w-10 h-10 bg-[#374151] hover:bg-[#4B5563] rounded-full flex items-center justify-center transition-colors"
                >
                  <MinusIcon className="h-4 w-4 text-white" />
                </button>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => {
                    const value = e.target.value
                    console.log('تغيير الكمية:', value)
                    if (value === '' || /^\d+$/.test(value)) {
                      const num = parseInt(value) || 1
                      if (num >= 1 && num <= 9999) {
                        setQuantity(num)
                      }
                    }
                  }}
                  onFocus={(e) => {
                    console.log('تم النقر على حقل الكمية')
                    e.target.select()
                  }}
                  className="bg-red-600 text-white font-bold text-xl text-center rounded-lg px-6 py-3 min-w-[80px] outline-none border-4 border-yellow-400 focus:border-green-500 hover:bg-red-700 transition-all"
                  placeholder="اكتب هنا"
                />
                <button
                  onClick={() => handleQuantityChange(1)}
                  className="w-10 h-10 bg-[#374151] hover:bg-[#4B5563] rounded-full flex items-center justify-center transition-colors"
                >
                  <PlusIcon className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-3">
              <label className="text-gray-300 text-sm">اللون</label>
              <div className="grid grid-cols-3 gap-3">
                {colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.name)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedColor === color.name
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#4A5568] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-600"
                        style={{ backgroundColor: color.color }}
                      />
                      <span className="text-white text-xs">{color.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#4A5568] space-y-3">
            {!isTransferMode && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">المجموع</span>
                <span className="text-white font-bold text-xl">
                  {formatPrice((product.price || 0) * quantity, 'system')}
                </span>
              </div>
            )}
            <button
              onClick={handleAddToCart}
              className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-white ${
                isTransferMode
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <ShoppingCartIcon className="h-5 w-5" />
              {isTransferMode ? 'إضافة للنقل [Enter]' : 'إضافة للسلة [Enter]'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}