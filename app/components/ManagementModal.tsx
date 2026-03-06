'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import DeleteConfirmationModal from './DeleteConfirmationModal'
import { 
  ArrowRightIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  BuildingStorefrontIcon, 
  BuildingOffice2Icon,
  PhoneIcon,
  MapPinIcon,
  SwatchIcon
} from '@heroicons/react/24/outline'

interface Branch {
  id: string
  name: string
  name_en: string | null
  address: string
  phone: string
  manager_id: string | null
  allow_variants: boolean
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface Warehouse {
  id: string
  name: string
  name_en: string | null
  address: string
  phone: string
  manager_id: string | null
  allow_variants: boolean
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface ManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onEditBranch?: (branch: Branch) => void
  onEditWarehouse?: (warehouse: Warehouse) => void
}

export default function ManagementModal({ isOpen, onClose, onEditBranch, onEditWarehouse }: ManagementModalProps) {
  const [activeTab, setActiveTab] = useState('management')
  const [branches, setBranches] = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  
  // Delete confirmation state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    type: '' as 'branch' | 'warehouse' | '',
    item: null as Branch | Warehouse | null,
    isDeleting: false
  })

  const tabs = [
    { id: 'management', label: 'إدارة الفروع والمخازن', active: true }
  ]

  // Fetch branches from database
  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setBranches(data || [])
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  // Fetch warehouses from database
  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setWarehouses(data || [])
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  // Fetch both branches and warehouses
  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchBranches(), fetchWarehouses()])
    } finally {
      setLoading(false)
    }
  }

  // Refresh data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  // Set up real-time subscription
  useEffect(() => {
    // Always fetch data when component mounts
    fetchData()

    // Create unique channel names with timestamp to avoid conflicts
    const channelId = Date.now()
    
    const branchesChannel = supabase
      .channel(`branches-realtime-${channelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'elfaroukgroup',
        table: 'branches'
      }, (payload) => {
        console.log('Branch realtime update:', payload)
        if (payload.eventType === 'INSERT') {
          setBranches(prev => [payload.new as Branch, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setBranches(prev => prev.map(branch => 
            branch.id === payload.new.id ? payload.new as Branch : branch
          ))
        } else if (payload.eventType === 'DELETE') {
          setBranches(prev => prev.filter(branch => branch.id !== payload.old.id))
        }
      })
      .subscribe((status) => {
        console.log('Branches subscription status:', status)
      })

    const warehousesChannel = supabase
      .channel(`warehouses-realtime-${channelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'elfaroukgroup',
        table: 'warehouses'
      }, (payload) => {
        console.log('Warehouse realtime update:', payload)
        if (payload.eventType === 'INSERT') {
          setWarehouses(prev => [payload.new as Warehouse, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setWarehouses(prev => prev.map(warehouse => 
            warehouse.id === payload.new.id ? payload.new as Warehouse : warehouse
          ))
        } else if (payload.eventType === 'DELETE') {
          setWarehouses(prev => prev.filter(warehouse => warehouse.id !== payload.old.id))
        }
      })
      .subscribe((status) => {
        console.log('Warehouses subscription status:', status)
      })

    return () => {
      console.log('Cleaning up realtime subscriptions')
      supabase.removeChannel(branchesChannel)
      supabase.removeChannel(warehousesChannel)
    }
  }, [])

  const handleEditBranch = (branch: Branch) => {
    if (onEditBranch) {
      onEditBranch(branch)
    }
  }

  const handleEditWarehouse = (warehouse: Warehouse) => {
    if (onEditWarehouse) {
      onEditWarehouse(warehouse)
    }
  }

  const handleDeleteBranchClick = (branch: Branch) => {
    setDeleteConfirmModal({
      isOpen: true,
      type: 'branch',
      item: branch,
      isDeleting: false
    })
  }

  const handleDeleteWarehouseClick = (warehouse: Warehouse) => {
    setDeleteConfirmModal({
      isOpen: true,
      type: 'warehouse',
      item: warehouse,
      isDeleting: false
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmModal.item) return
    
    setDeleteConfirmModal(prev => ({ ...prev, isDeleting: true }))
    
    try {
      if (deleteConfirmModal.type === 'branch') {
        const { error } = await supabase
          .from('branches')
          .delete()
          .eq('id', deleteConfirmModal.item.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('warehouses')
          .delete()
          .eq('id', deleteConfirmModal.item.id)
        
        if (error) throw error
      }
      
      // Close modal on success
      setDeleteConfirmModal({
        isOpen: false,
        type: '',
        item: null,
        isDeleting: false
      })
    } catch (error) {
      console.error(`Error deleting ${deleteConfirmModal.type}:`, error)
      // Reset deleting state on error
      setDeleteConfirmModal(prev => ({ ...prev, isDeleting: false }))
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmModal({
      isOpen: false,
      type: '',
      item: null,
      isDeleting: false
    })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40"
          onClick={onClose}
        />
      )}

      {/* Modal - wider than other modals to accommodate table */}
      <div className={`fixed top-12 right-0 h-[calc(100vh-3rem)] w-[800px] bg-[#3A4553] z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } shadow-2xl flex flex-col`}>
        
        {/* Header - dark gray header matching design */}
        <div className="bg-[#3A4553] px-4 py-3 flex items-center justify-start border-b border-[#4A5568]">
          <h2 className="text-white text-lg font-medium flex-1 text-right">إدارة</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors ml-4"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation Bar - matching reference design */}
        <div className="bg-[#3A4553] border-b border-[#4A5568]">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#5DADE2]' // Light blue text for selected
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {tab.label}
                {/* Light blue underline for active tab */}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5DADE2]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area - Card Grid Layout */}
        <div className="flex-1 bg-[#2B3544] overflow-y-auto overflow-x-hidden p-6 scrollbar-hide">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5DADE2]"></div>
              </div>
            ) : (branches.length > 0 || warehouses.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Display branches */}
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="bg-[#374151] border border-[#4A5568] rounded-lg p-6 hover:border-[#5DADE2] transition-all duration-300 hover:shadow-lg relative group"
                  >
                    {/* Card Header with Icon and Type */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-blue-600/20 text-blue-400">
                          <BuildingStorefrontIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-white text-lg font-semibold">{branch.name}</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-600/30">
                            فرع
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditBranch(branch)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBranchClick(branch)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="space-y-3">
                      {/* Address */}
                      <div className="flex items-start gap-3">
                        <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-gray-400 text-xs font-medium mb-1">العنوان</div>
                          <div className="text-gray-200 text-sm">{branch.address}</div>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-3">
                        <PhoneIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-gray-400 text-xs font-medium mb-1">الهاتف</div>
                          <div className="text-gray-200 text-sm font-mono">{branch.phone}</div>
                        </div>
                      </div>

                      {/* Shapes & Colors Permission */}
                      <div className="flex items-center gap-3">
                        <SwatchIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-gray-400 text-xs font-medium mb-1">الأشكال والألوان</div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            branch.allow_variants 
                              ? 'bg-green-600/20 text-green-300 border border-green-600/30' 
                              : 'bg-red-600/20 text-red-300 border border-red-600/30'
                          }`}>
                            {branch.allow_variants ? 'مسموح' : 'غير مسموح'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Subtle border glow effect on hover */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#5DADE2]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                ))}
                
                {/* Display warehouses */}
                {warehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className="bg-[#374151] border border-[#4A5568] rounded-lg p-6 hover:border-[#5DADE2] transition-all duration-300 hover:shadow-lg relative group"
                  >
                    {/* Card Header with Icon and Type */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-green-600/20 text-green-400">
                          <BuildingOffice2Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-white text-lg font-semibold">{warehouse.name}</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-300 border border-green-600/30">
                            مخزن
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditWarehouse(warehouse)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWarehouseClick(warehouse)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="space-y-3">
                      {/* Address */}
                      <div className="flex items-start gap-3">
                        <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-gray-400 text-xs font-medium mb-1">العنوان</div>
                          <div className="text-gray-200 text-sm">{warehouse.address}</div>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-3">
                        <PhoneIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-gray-400 text-xs font-medium mb-1">الهاتف</div>
                          <div className="text-gray-200 text-sm font-mono">{warehouse.phone}</div>
                        </div>
                      </div>

                      {/* Shapes & Colors Permission */}
                      <div className="flex items-center gap-3">
                        <SwatchIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-gray-400 text-xs font-medium mb-1">الأشكال والألوان</div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            warehouse.allow_variants 
                              ? 'bg-green-600/20 text-green-300 border border-green-600/30' 
                              : 'bg-red-600/20 text-red-300 border border-red-600/30'
                          }`}>
                            {warehouse.allow_variants ? 'مسموح' : 'غير مسموح'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Subtle border glow effect on hover */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#5DADE2]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BuildingStorefrontIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="text-gray-300 text-lg font-medium mb-2">لا توجد فروع أو مخازن</div>
                  <div className="text-gray-500 text-sm max-w-md">
                    استخدم أزرار &quot;إضافة فرع&quot; أو &quot;إضافة مخزن&quot; لإضافة موقع جديد وإدارة عملياتك التجارية
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Action Buttons - Close only */}
        <div className="p-4 bg-[#3A4553] border-t border-[#4A5568] flex-shrink-0">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500 px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={deleteConfirmModal.type === 'branch' ? 'حذف الفرع' : 'حذف المخزن'}
        message={deleteConfirmModal.type === 'branch' 
          ? 'هل أنت متأكد من أنك تريد حذف هذا الفرع؟' 
          : 'هل أنت متأكد من أنك تريد حذف هذا المخزن؟'
        }
        itemName={deleteConfirmModal.item?.name || ''}
        isDeleting={deleteConfirmModal.isDeleting}
      />
    </>
  )
}