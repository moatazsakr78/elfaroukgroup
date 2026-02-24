'use client'

import React, { useState } from 'react'
import { XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { useCurrentBranch } from '@/lib/contexts/CurrentBranchContext'

interface TransferQuantityModalProps {
  isOpen: boolean
  onClose: () => void
  product: any | null
  branches: any[]
  onConfirm: (quantity: number, reason: string, fromBranchId: string, toBranchId: string) => void
}

export default function TransferQuantityModal({
  isOpen,
  onClose,
  product,
  branches,
  onConfirm
}: TransferQuantityModalProps) {
  const { currentBranch } = useCurrentBranch()
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [toBranchId, setToBranchId] = useState('')

  // Get branch info
  const toBranch = branches.find(b => b.id === toBranchId)
  const fromCurrentQuantity = currentBranch ? (product?.inventoryData?.[currentBranch.id]?.quantity || 0) : 0
  const toCurrentQuantity = toBranch ? (product?.inventoryData?.[toBranchId]?.quantity || 0) : 0

  // Filter destination branches (exclude current branch)
  const destinationBranches = branches.filter(b => b.id !== currentBranch?.id)

  // Clear destination if it matches current branch
  React.useEffect(() => {
    if (toBranchId && toBranchId === currentBranch?.id) {
      setToBranchId('')
    }
  }, [currentBranch?.id, toBranchId])

  if (!isOpen || !product) return null

  const numQuantity = parseInt(quantity) || 0
  const fromResult = fromCurrentQuantity - numQuantity
  const toResult = toCurrentQuantity + numQuantity
  const isValid = currentBranch?.id && toBranchId && currentBranch.id !== toBranchId && numQuantity > 0

  const handleSubmit = () => {
    if (!isValid || !currentBranch?.id) return
    onConfirm(numQuantity, reason, currentBranch.id, toBranchId)
    setQuantity('')
    setReason('')
    setToBranchId('')
    onClose()
  }

  const handleClose = () => {
    setQuantity('')
    setReason('')
    setToBranchId('')
    onClose()
  }

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
              <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                <ArrowsRightLeftIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">تحويل كمية</h2>
                <p className="text-sm text-purple-400">{product.name}</p>
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
          <div className="p-6 space-y-5">

            {/* Source Branch */}
            {currentBranch && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  من فرع (المصدر)
                </label>
                <div className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white">
                  {currentBranch.name}
                </div>
                <div className="mt-2 flex justify-between items-center text-sm px-1">
                  <span className="text-gray-400">الكمية الحالية</span>
                  <span className={`font-bold ${
                    fromCurrentQuantity < 0 ? 'text-red-400' :
                    fromCurrentQuantity === 0 ? 'text-gray-400' : 'text-green-400'
                  }`}>
                    {fromCurrentQuantity}
                  </span>
                </div>
              </div>
            )}

            {/* Arrow separator */}
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-purple-600/20 rounded-full flex items-center justify-center">
                <ArrowsRightLeftIcon className="h-4 w-4 text-purple-400" />
              </div>
            </div>

            {/* Destination Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                إلى فرع (الوجهة)
              </label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">اختر فرع الوجهة...</option>
                {destinationBranches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {toBranchId && (
                <div className="mt-2 flex justify-between items-center text-sm px-1">
                  <span className="text-gray-400">الكمية الحالية</span>
                  <span className={`font-bold ${
                    toCurrentQuantity < 0 ? 'text-red-400' :
                    toCurrentQuantity === 0 ? 'text-gray-400' : 'text-green-400'
                  }`}>
                    {toCurrentQuantity}
                  </span>
                </div>
              )}
            </div>

            {/* Transfer Quantity Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                كمية التحويل
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="أدخل الكمية المراد تحويلها..."
                min="1"
                autoFocus
              />
            </div>

            {/* Result Preview */}
            {quantity && numQuantity > 0 && currentBranch && toBranchId && (
              <div className="space-y-2">
                {/* Source result */}
                <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-red-400 text-sm">{currentBranch.name} (المصدر)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">{fromCurrentQuantity}</span>
                      <span className="text-gray-500">←</span>
                      <span className={`font-bold ${fromResult < 0 ? 'text-red-400' : 'text-red-300'}`}>
                        {fromResult}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Destination result */}
                <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-green-400 text-sm">{toBranch?.name} (الوجهة)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">{toCurrentQuantity}</span>
                      <span className="text-gray-500">←</span>
                      <span className="text-green-300 font-bold">
                        {toResult}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                السبب (اختياري)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-[#374151] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="اكتب سبب التحويل..."
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
              disabled={!isValid}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              تأكيد التحويل
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
