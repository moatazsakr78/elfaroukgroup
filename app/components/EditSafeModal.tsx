'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'

interface EditSafeModalProps {
  isOpen: boolean
  onClose: () => void
  onSafeUpdated: () => void
  safe: any
}

export default function EditSafeModal({ isOpen, onClose, onSafeUpdated, safe }: EditSafeModalProps) {
  const [safeName, setSafeName] = useState('')
  const [supportsDrawers, setSupportsDrawers] = useState(false)
  const [hasExistingDrawers, setHasExistingDrawers] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (safe) {
      setSafeName(safe.name || '')
      setSupportsDrawers(safe.supports_drawers || false)
    }
  }, [safe])

  // Check if safe has existing drawers
  useEffect(() => {
    const checkDrawers = async () => {
      if (!safe?.id || safe.safe_type === 'sub') return
      const { count } = await supabase
        .from('records')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', safe.id)
        .eq('safe_type', 'sub')
      setHasExistingDrawers((count || 0) > 0)
    }
    if (isOpen && safe?.id) {
      checkDrawers()
    }
  }, [isOpen, safe?.id, safe?.safe_type])

  const handleSave = async () => {
    if (!safeName.trim() || !safe?.id) return

    // Warn if trying to disable drawers when drawers exist
    if (!supportsDrawers && hasExistingDrawers) {
      alert('لا يمكن تعطيل الأدراج لأن هذه الخزنة تحتوي على أدراج موجودة.\nيجب حذف الأدراج أولاً.')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('records')
        .update({
          name: safeName.trim(),
          supports_drawers: safe.safe_type !== 'sub' ? supportsDrawers : false,
          updated_at: new Date().toISOString()
        })
        .eq('id', safe.id)

      if (error) {
        console.error('Error updating safe:', error)
        return
      }

      onSafeUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating safe:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setSafeName(safe?.name || '')
    setSupportsDrawers(safe?.supports_drawers || false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-pos-darker rounded-lg p-6 w-96 max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            تعديل {safe?.safe_type === 'sub' ? 'الدرج' : 'الخزنة'}
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
              {safe?.safe_type === 'sub' ? 'اسم الدرج' : 'اسم الخزنة'}
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

          {/* Supports Drawers Toggle - only for main safes */}
          {safe?.safe_type !== 'sub' && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsDrawers}
                  onChange={(e) => setSupportsDrawers(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  disabled={isLoading || (hasExistingDrawers && supportsDrawers)}
                />
                <span className="text-sm font-medium text-gray-300">تدعم الأدراج</span>
              </label>
              {hasExistingDrawers && (
                <p className="text-xs text-yellow-400 mt-1 mr-8">هذه الخزنة تحتوي على أدراج - لا يمكن تعطيل هذا الخيار</p>
              )}
            </div>
          )}
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  )
}
