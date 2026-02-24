'use client'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
  title?: string
  message?: string
  itemName?: string
  variant?: 'delete' | 'cancel'
  confirmButtonText?: string
  loadingText?: string
  warningText?: string
}

export default function ConfirmDeleteModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting = false,
  title = 'تأكيد الحذف',
  message = 'هل أنت متأكد أنك تريد حذف هذه الفاتورة؟',
  itemName = '',
  variant = 'delete',
  confirmButtonText,
  loadingText,
  warningText
}: ConfirmDeleteModalProps) {
  const isCancel = variant === 'cancel'
  const btnText = confirmButtonText || (isCancel ? 'نعم، الغِ' : 'نعم، احذف')
  const btnLoadingText = loadingText || (isCancel ? 'جاري الإلغاء...' : 'جاري الحذف...')
  const warnText = warningText || (isCancel ? 'تحذير: سيتم إرجاع المخزون وعكس معاملات الخزنة' : 'تحذير: لا يمكن التراجع عن هذا الإجراء')
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center">
        <div className="bg-[#2B3544] border border-gray-600 rounded-lg shadow-xl w-full max-w-md mx-4">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b border-gray-600">
            <ExclamationTriangleIcon className={`h-6 w-6 flex-shrink-0 ${isCancel ? 'text-orange-400' : 'text-red-400'}`} />
            <h3 className="text-lg font-medium text-white text-right flex-1">
              {title}
            </h3>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-300 text-right leading-6">
              {message}
            </p>
            {itemName && (
              <div className={`mt-3 p-3 bg-gray-700/50 rounded border-r-4 ${isCancel ? 'border-orange-500' : 'border-red-500'}`}>
                <p className="text-white text-sm text-right font-medium">
                  {itemName}
                </p>
              </div>
            )}
            <p className={`text-sm text-right mt-4 ${isCancel ? 'text-orange-400' : 'text-red-400'}`}>
              {warnText}
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-600">
            {/* Cancel Button */}
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إلغاء
            </button>
            
            {/* Confirm Delete Button */}
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className={`flex-1 px-4 py-2 text-white rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isCancel ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{btnLoadingText}</span>
                </>
              ) : (
                btnText
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}