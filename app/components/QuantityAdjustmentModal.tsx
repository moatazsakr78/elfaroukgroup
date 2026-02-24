'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon, PencilIcon, MinusIcon } from '@heroicons/react/24/outline'
import { useCurrentBranch } from '@/lib/contexts/CurrentBranchContext'

interface QuantityAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  product: any | null
  mode: 'add' | 'edit' | 'subtract'
  branches: any[]
  onConfirm: (newQuantity: number, reason: string, branchId: string) => void
}

export default function QuantityAdjustmentModal({
  isOpen,
  onClose,
  product,
  mode,
  branches,
  onConfirm
}: QuantityAdjustmentModalProps) {
  const { currentBranch } = useCurrentBranch()
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')

  // Get current branch info
  const currentQuantity = currentBranch ? (product?.inventoryData?.[currentBranch.id]?.quantity || 0) : 0

  if (!isOpen || !product) return null

  const handleSubmit = () => {
    if (!currentBranch?.id) return

    const numQuantity = parseInt(quantity) || 0

    if (mode === 'add') {
      const newQuantity = currentQuantity + numQuantity
      onConfirm(newQuantity, reason, currentBranch.id)
    } else if (mode === 'subtract') {
      const newQuantity = currentQuantity - numQuantity
      onConfirm(newQuantity, reason, currentBranch.id)
    } else {
      onConfirm(numQuantity, reason, currentBranch.id)
    }

    setQuantity('')
    setReason('')
    onClose()
  }

  const handleClose = () => {
    setQuantity('')
    setReason('')
    onClose()
  }

  const isAddMode = mode === 'add'
  const isSubtractMode = mode === 'subtract'
  const title = isAddMode ? 'إضافة كمية' : isSubtractMode ? 'خصم كمية' : 'تعديل الكمية'
  const IconComponent = isAddMode ? PlusIcon : isSubtractMode ? MinusIcon : PencilIcon
  const iconBg = isSubtractMode ? 'bg-red-600' : 'bg-blue-600'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#4A5568] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${iconBg} rounded-full flex items-center justify-center`}>
                <IconComponent className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <p className="text-sm text-blue-400">{product.name}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            
            {/* Current Quantity Info */}
            {currentBranch && (
              <div className="bg-[#374151] rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">الفرع</span>
                  <span className="text-white font-medium">{currentBranch.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">الكمية الحالية</span>
                  <span className={`font-bold text-lg ${
                    currentQuantity < 0 ? 'text-red-400' :
                    currentQuantity === 0 ? 'text-gray-400' : 'text-green-400'
                  }`}>
                    {currentQuantity}
                  </span>
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isAddMode ? 'الكمية المراد إضافتها' : isSubtractMode ? 'الكمية المراد خصمها' : 'الكمية الجديدة'}
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={isAddMode ? "أدخل الكمية المراد إضافتها..." : isSubtractMode ? "أدخل الكمية المراد خصمها..." : "أدخل الكمية الجديدة..."}
                min={mode === 'edit' ? "-999999" : undefined}
                autoFocus
              />
            </div>

            {/* Result Preview */}
            {quantity && (() => {
              const numQ = parseInt(quantity) || 0
              const result = isAddMode ? currentQuantity + numQ : isSubtractMode ? currentQuantity - numQ : numQ
              const previewBg = isSubtractMode ? 'bg-red-600/10 border-red-600/20' : 'bg-blue-600/10 border-blue-600/20'
              const previewText = isSubtractMode ? 'text-red-400' : 'text-blue-400'
              return (
                <div className={`${previewBg} border rounded-lg p-4`}>
                  <div className="flex justify-between items-center">
                    <span className={previewText}>النتيجة النهائية</span>
                    <span className={`${previewText} font-bold text-lg`}>
                      {result}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                السبب (اختياري)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="اكتب سبب التعديل..."
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#4A5568] flex gap-3 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-lg transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={!quantity}
              className={`px-6 py-2 ${isSubtractMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium`}
            >
              تأكيد {isAddMode ? 'الإضافة' : isSubtractMode ? 'الخصم' : 'التعديل'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}