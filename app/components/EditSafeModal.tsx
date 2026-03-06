'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'
import { useFormatPrice } from '@/lib/hooks/useCurrency'

interface EditSafeModalProps {
  isOpen: boolean
  onClose: () => void
  onSafeUpdated: () => void
  safe: any
  currentBalance?: number
}

interface ChildDrawer {
  id: string
  name: string
  balance: number
}

export default function EditSafeModal({ isOpen, onClose, onSafeUpdated, safe, currentBalance = 0 }: EditSafeModalProps) {
  const formatPrice = useFormatPrice()
  const [safeName, setSafeName] = useState('')
  const [supportsDrawers, setSupportsDrawers] = useState(false)
  const [originalSupportsDrawers, setOriginalSupportsDrawers] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Enable drawers flow
  const [firstDrawerName, setFirstDrawerName] = useState('درج 1')

  // Disable drawers flow
  const [childDrawers, setChildDrawers] = useState<ChildDrawer[]>([])
  const [totalDrawerBalance, setTotalDrawerBalance] = useState(0)
  const [disableConfirmText, setDisableConfirmText] = useState('')
  const [step, setStep] = useState<'edit' | 'confirm-disable'>('edit')

  useEffect(() => {
    if (safe) {
      setSafeName(safe.name || '')
      setSupportsDrawers(safe.supports_drawers || false)
      setOriginalSupportsDrawers(safe.supports_drawers || false)
      setFirstDrawerName('درج 1')
      setDisableConfirmText('')
      setStep('edit')
      setChildDrawers([])
      setTotalDrawerBalance(0)
    }
  }, [safe])

  const isEnablingDrawers = supportsDrawers && !originalSupportsDrawers
  const isDisablingDrawers = !supportsDrawers && originalSupportsDrawers

  const handleDrawerToggle = async (checked: boolean) => {
    setSupportsDrawers(checked)

    if (!checked && originalSupportsDrawers) {
      // User wants to disable drawers — fetch child drawer details
      try {
        const { data: children } = await supabase
          .from('records')
          .select('id, name')
          .eq('parent_id', safe.id)
          .eq('safe_type', 'sub')

        if (children && children.length > 0) {
          const drawersWithBalances: ChildDrawer[] = []
          let total = 0

          for (const child of children) {
            const { data: drawer } = await supabase
              .from('cash_drawers')
              .select('current_balance')
              .eq('record_id', child.id)
              .single()

            const balance = drawer?.current_balance || 0
            total += balance
            drawersWithBalances.push({ id: child.id, name: child.name, balance })
          }

          setChildDrawers(drawersWithBalances)
          setTotalDrawerBalance(total)
          setStep('confirm-disable')
        }
      } catch (error) {
        console.error('Error fetching child drawers:', error)
      }
    }
  }

  const handleSave = async () => {
    if (!safeName.trim() || !safe?.id) return

    setIsLoading(true)
    try {
      if (isEnablingDrawers) {
        // Call RPC to enable drawers atomically
        const { data, error } = await supabase.rpc('enable_drawers_on_safe' as any, {
          p_safe_id: safe.id,
          p_drawer_name: firstDrawerName.trim() || 'درج 1'
        })

        if (error) {
          console.error('Error enabling drawers:', error)
          alert('حدث خطأ أثناء تفعيل الأدراج: ' + error.message)
          return
        }

        if (data && !data.success) {
          alert(data.error || 'حدث خطأ غير متوقع')
          return
        }

        // Update name if changed
        if (safeName.trim() !== safe.name) {
          await supabase
            .from('records')
            .update({ name: safeName.trim(), updated_at: new Date().toISOString() })
            .eq('id', safe.id)
        }
      } else {
        // Normal save (name change only, no drawer state change)
        const { error } = await supabase
          .from('records')
          .update({
            name: safeName.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', safe.id)

        if (error) {
          console.error('Error updating safe:', error)
          return
        }
      }

      onSafeUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating safe:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmDisable = async () => {
    if (!safe?.id || disableConfirmText.trim() !== safe.name.trim()) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('disable_drawers_on_safe' as any, {
        p_safe_id: safe.id
      })

      if (error) {
        console.error('Error disabling drawers:', error)
        alert('حدث خطأ أثناء إزالة الأدراج: ' + error.message)
        return
      }

      if (data && !data.success) {
        alert(data.error || 'حدث خطأ غير متوقع')
        return
      }

      // Update name if changed
      if (safeName.trim() !== safe.name) {
        await supabase
          .from('records')
          .update({ name: safeName.trim(), updated_at: new Date().toISOString() })
          .eq('id', safe.id)
      }

      onSafeUpdated()
      onClose()
    } catch (error) {
      console.error('Error disabling drawers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setSafeName(safe?.name || '')
    setSupportsDrawers(safe?.supports_drawers || false)
    setOriginalSupportsDrawers(safe?.supports_drawers || false)
    setFirstDrawerName('درج 1')
    setDisableConfirmText('')
    setStep('edit')
    setChildDrawers([])
    onClose()
  }

  const handleBackToEdit = () => {
    setSupportsDrawers(true)
    setDisableConfirmText('')
    setStep('edit')
  }

  if (!isOpen) return null

  // Confirmation step for disabling drawers
  if (step === 'confirm-disable') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
        <div className="bg-pos-darker rounded-lg p-6 w-[480px] max-w-lg mx-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">إزالة الأدراج</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Warning */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-400 font-bold text-sm mb-1">تحذير: إزالة جميع الأدراج</h3>
                <p className="text-red-300/80 text-sm">
                  سيتم دمج جميع الأدراج في الخزنة الرئيسية. لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
            </div>
          </div>

          {/* Drawer list */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">الأدراج التي سيتم إزالتها:</h4>
            <div className="space-y-2">
              {childDrawers.map((drawer) => (
                <div key={drawer.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-200">{drawer.name}</span>
                  <span className="text-sm text-gray-400">{formatPrice(drawer.balance)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-600">
              <span className="text-sm font-medium text-gray-200">إجمالي الرصيد المُدمج</span>
              <span className="text-sm font-bold text-blue-400">{formatPrice(totalDrawerBalance)}</span>
            </div>
          </div>

          {/* What will happen */}
          <div className="bg-gray-700/30 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">ما سيحدث:</h4>
            <ul className="space-y-1.5 text-xs text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <span>نقل جميع المعاملات والمبيعات إلى الخزنة الرئيسية</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <span>دمج أرصدة الأدراج في رصيد الخزنة</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <span>حذف الأدراج نهائياً</span>
              </li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              اكتب اسم الخزنة <span className="text-red-400 font-bold">"{safe?.name}"</span> للتأكيد
            </label>
            <input
              type="text"
              value={disableConfirmText}
              onChange={(e) => setDisableConfirmText(e.target.value)}
              placeholder={safe?.name || ''}
              className="w-full bg-gray-700 text-white placeholder-gray-500 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleBackToEdit}
              className="px-4 py-2 text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              disabled={isLoading}
            >
              رجوع
            </button>
            <button
              onClick={handleConfirmDisable}
              disabled={disableConfirmText.trim() !== safe?.name?.trim() || isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'جاري الإزالة...' : 'تأكيد الإزالة'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Normal edit step
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
                  onChange={(e) => handleDrawerToggle(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  disabled={isLoading}
                />
                <span className="text-sm font-medium text-gray-300">تدعم الأدراج</span>
              </label>
            </div>
          )}

          {/* Enable drawers: first drawer name + balance info */}
          {isEnablingDrawers && safe?.safe_type !== 'sub' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  اسم الدرج الأول
                </label>
                <input
                  type="text"
                  value={firstDrawerName}
                  onChange={(e) => setFirstDrawerName(e.target.value)}
                  placeholder="درج 1"
                  className="w-full bg-gray-700 text-white placeholder-gray-400 px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-blue-300/80">
                سيتم نقل رصيد الخزنة ({formatPrice(currentBalance)}) إلى الدرج الجديد
              </p>
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
            className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isEnablingDrawers
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading
              ? 'جاري الحفظ...'
              : isEnablingDrawers
                ? 'تفعيل الأدراج وحفظ'
                : 'حفظ التغييرات'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
