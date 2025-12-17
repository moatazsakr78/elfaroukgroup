'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, TruckIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase/client'

interface SupplierSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (supplier: any) => void
  selectedSupplier: any
  isPurchaseMode?: boolean // لتمييز أن هذا لوضع الشراء
}

export default function SupplierSelectionModal({ isOpen, onClose, onSelect, selectedSupplier, isPurchaseMode = false }: SupplierSelectionModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSuppliers()
    }
  }, [isOpen])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone?.includes(searchTerm) ||
    supplier.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSupplierSelect = (supplier: any) => {
    onSelect(supplier)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#2B3544] rounded-2xl shadow-2xl border border-[#4A5568] w-full max-w-2xl max-h-[80vh] overflow-hidden">
          
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${isPurchaseMode ? 'border-blue-600/50 bg-gradient-to-r from-blue-900/30 to-blue-800/20' : 'border-[#4A5568]'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPurchaseMode ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-green-500 to-blue-500'}`}>
                <TruckIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{isPurchaseMode ? 'اختيار مورد للشراء' : 'اختيار المورد'}</h2>
                <p className="text-gray-400 text-sm">{isPurchaseMode ? 'اختر المورد لبدء فاتورة شراء جديدة' : 'اختر المورد للفاتورة'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/30 rounded-full transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-6 border-b border-[#4A5568]">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="البحث في الموردين..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#374151] border border-[#4A5568] rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="text-gray-400 mr-3">جاري التحميل...</span>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-8">
                <TruckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">لا توجد موردين</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    onClick={() => handleSupplierSelect(supplier)}
                    className={`bg-[#374151] rounded-xl p-4 border cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-500/5 ${
                      selectedSupplier?.id === supplier.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[#4A5568]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <TruckIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{supplier.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                            {supplier.phone && (
                              <span>{supplier.phone}</span>
                            )}
                            {supplier.address && (
                              <span>{supplier.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <div className="text-blue-400 font-bold">
                          {supplier.account_balance ? `${parseFloat(supplier.account_balance).toFixed(2)} جنيه` : '0.00 جنيه'}
                        </div>
                        <div className="text-xs text-gray-400">الرصيد</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#4A5568]">
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
            >
              إغلاق
            </button>
          </div>

        </div>
      </div>
    </>
  )
}