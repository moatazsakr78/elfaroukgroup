'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'

interface SafeItem {
  id: string
  name: string
  parent_id: string | null
  safe_type: string | null
}

interface AddSafeModalProps {
  isOpen: boolean
  onClose: () => void
  onSafeAdded: () => void
  parentSafe?: SafeItem | null
}

export default function AddSafeModal({ isOpen, onClose, onSafeAdded, parentSafe }: AddSafeModalProps) {
  const [safeName, setSafeName] = useState('')
  const [initialBalance, setInitialBalance] = useState<string>('0')
  const [supportsDrawers, setSupportsDrawers] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isSubSafe = !!parentSafe

  const handleSave = async () => {
    if (!safeName.trim()) return

    setIsLoading(true)
    try {
      const balance = parseFloat(initialBalance) || 0
      const { data: newRecord, error } = await supabase
        .from('records')
        .insert({
          name: safeName.trim(),
          is_primary: false,
          is_active: true,
          initial_balance: balance,
          parent_id: parentSafe?.id || null,
          safe_type: isSubSafe ? 'sub' : 'main',
          supports_drawers: isSubSafe ? false : supportsDrawers
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating safe:', error)
        return
      }

      // Create cash_drawer for the new safe
      if (newRecord?.id) {
        const { error: drawerError } = await supabase
          .from('cash_drawers')
          .insert({
            record_id: newRecord.id,
            current_balance: balance
          })
        if (drawerError) {
          console.error('Error creating cash drawer:', drawerError)
        }
      }

      onSafeAdded()
      handleClose()
    } catch (error) {
      console.error('Error creating safe:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setSafeName('')
    setInitialBalance('0')
    setSupportsDrawers(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-pos-darker rounded-lg p-6 w-96 max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {parentSafe ? `إضافة درج في "${parentSafe.name}"` : 'إضافة خزنة جديدة'}
          </h2>
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
              {isSubSafe ? 'اسم الدرج' : 'اسم الخزنة'}
            </label>
            <input
              type="text"
              value={safeName}
              onChange={(e) => setSafeName(e.target.value)}
              placeholder={isSubSafe ? 'مثال: كاشير 1...' : 'أدخل اسم الخزنة...'}
              className="w-full bg-gray-700 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Supports Drawers Toggle - only when creating main safe */}
          {!isSubSafe && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsDrawers}
                  onChange={(e) => setSupportsDrawers(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  disabled={isLoading}
                />
                <span className="text-sm font-medium text-gray-300">تدعم الأدراج</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 mr-8">يمكنك إضافة أدراج داخل الخزنة لاحقاً</p>
            </div>
          )}

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
