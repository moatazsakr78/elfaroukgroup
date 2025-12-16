'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'

interface AddSafeModalProps {
  isOpen: boolean
  onClose: () => void
  onSafeAdded: () => void
}

export default function AddSafeModal({ isOpen, onClose, onSafeAdded }: AddSafeModalProps) {
  const [safeName, setSafeName] = useState('')
  const [initialBalance, setInitialBalance] = useState<string>('0')
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    if (!safeName.trim()) return

    setIsLoading(true)
    try {
      const balance = parseFloat(initialBalance) || 0
      const { error } = await supabase
        .from('records')
        .insert({
          name: safeName.trim(),
          is_primary: false,
          is_active: true,
          initial_balance: balance
        })

      if (error) {
        console.error('Error creating safe:', error)
        return
      }

      onSafeAdded()
      setSafeName('')
      onClose()
    } catch (error) {
      console.error('Error creating safe:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setSafeName('')
    setInitialBalance('0')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-pos-darker rounded-lg p-6 w-96 max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">إضافة خزنة جديدة</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              اسم الخزنة
            </label>
            <input
              type="text"
              value={safeName}
              onChange={(e) => setSafeName(e.target.value)}
              placeholder="أدخل اسم الخزنة..."
              className="w-full bg-gray-700 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              الرصيد الافتتاحي
            </label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full bg-gray-700 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
              dir="ltr"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">يمكنك تركه صفر إذا كانت الخزنة فارغة</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            disabled={isLoading}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={!safeName.trim() || isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}
