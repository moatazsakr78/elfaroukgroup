'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import { useActivityLogger } from "@/app/lib/hooks/useActivityLogger"
import { ArrowRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface CustomerGroup {
  id: string
  name: string
  parent_id: string | null
  is_active: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

interface CustomerGroupSidebarProps {
  isOpen: boolean
  onClose: () => void
  customerGroups: CustomerGroup[]
  onGroupCreated: () => void
  editGroup?: CustomerGroup | null
  isEditing?: boolean
  selectedGroup?: CustomerGroup | null
}

export default function CustomerGroupSidebar({ isOpen, onClose, customerGroups, onGroupCreated, editGroup, isEditing, selectedGroup }: CustomerGroupSidebarProps) {
  const activityLog = useActivityLogger()
  const [activeTab, setActiveTab] = useState('details')
  const [formData, setFormData] = useState({
    name: '',
    parentId: ''
  })

  // Pre-fill form data when editing or auto-select parent
  useEffect(() => {
    if (isEditing && editGroup) {
      setFormData({
        name: editGroup.name || '',
        parentId: editGroup.parent_id || ''
      })
    } else if (!isEditing) {
      // Auto-select parent group based on current selection
      let defaultParentId = ''
      
      if (selectedGroup) {
        // If a group is selected, use it as parent
        defaultParentId = selectedGroup.id
      } else {
        // If no group is selected, find "عملاء" group
        const customersGroup = customerGroups.find(group => group.name === 'عملاء' && group.is_active)
        if (customersGroup) {
          defaultParentId = customersGroup.id
        }
      }
      
      setFormData({
        name: '',
        parentId: defaultParentId
      })
    }
  }, [isEditing, editGroup, selectedGroup, customerGroups, isOpen])

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const tabs = [
    { id: 'details', label: 'تفاصيل المجموعة', active: true }
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleParentSelect = (parentId: string, parentName: string) => {
    setFormData(prev => ({
      ...prev,
      parentId
    }))
    setIsDropdownOpen(false)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.parentId) return
    
    setIsSaving(true)
    try {
      if (isEditing && editGroup) {
        // Update existing group
        const { error } = await supabase
          .from('customer_groups')
          .update({
            name: formData.name.trim(),
            parent_id: formData.parentId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editGroup.id)

        if (error) throw error
        activityLog({ entityType: 'category', actionType: 'update', entityId: editGroup!.id, entityName: formData.name, description: 'عدّل مجموعة عملاء: ' + formData.name })
      } else {
        // Create new group
        const { error } = await supabase
          .from('customer_groups')
          .insert({
            name: formData.name.trim(),
            parent_id: formData.parentId || null,
            is_active: true,
            sort_order: 0
          })

        if (error) throw error
        activityLog({ entityType: 'category', actionType: 'create', entityName: formData.name, description: 'أضاف مجموعة عملاء: ' + formData.name })
      }
      
      // Reset form and close
      setFormData({
        name: '',
        parentId: ''
      })
      onGroupCreated()
      onClose()
    } catch (error) {
      console.error('Error creating customer group:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: '',
      parentId: ''
    })
    onClose()
  }

  const handleClearFields = () => {
    // Instant clearing without confirmation
    setFormData({
      name: '',
      parentId: ''
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

      {/* Sidebar - starts below header with exact dark theme colors */}
      <div className={`fixed top-12 right-0 h-[calc(100vh-3rem)] w-96 bg-[#3A4553] z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } shadow-2xl`}>
        
        {/* Header - dark gray header matching design */}
        <div className="bg-[#3A4553] px-4 py-3 flex items-center justify-start border-b border-[#4A5568]">
          <h2 className="text-white text-lg font-medium flex-1 text-right">{isEditing ? 'تعديل المجموعة' : 'مجموعة جديدة'}</h2>
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

        {/* Content Area */}
        <div className="p-6 space-y-6 h-[calc(100%-180px)] overflow-y-auto scrollbar-hide">
          
          {/* Group Name Field */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              اسم المجموعة *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="أدخل اسم المجموعة"
              className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] text-right text-sm"
            />
          </div>

          {/* Parent Group Field - Dropdown */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              المجموعة *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 bg-[#2B3441] border border-[#4A5568] rounded text-white text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#5DADE2] focus:border-[#5DADE2] flex items-center justify-between"
              >
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                <span className={formData.parentId ? 'text-white' : 'text-gray-400'}>
                  {formData.parentId 
                    ? customerGroups.find(group => group.id === formData.parentId)?.name || '-- اختر المجموعة الرئيسية (مطلوب) --'
                    : '-- اختر المجموعة الرئيسية (مطلوب) --'
                  }
                </span>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2B3441] border border-[#4A5568] rounded shadow-lg z-10 max-h-48 overflow-y-auto scrollbar-hide">
                  {customerGroups
                    .filter(group => group.is_active)
                    .map(group => {
                      const isRootCustomers = group.name === 'عملاء' && !group.parent_id
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => handleParentSelect(group.id, group.name)}
                          className={`w-full px-3 py-2 text-right hover:bg-[#374151] transition-colors ${
                            isRootCustomers 
                              ? 'font-medium text-blue-400 cursor-default' 
                              : 'text-white'
                          }`}
                          disabled={false}
                        >
                          {group.name}{isRootCustomers ? ' (افتراضي)' : ''}
                        </button>
                      )
                    })
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - exact design match */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#3A4553] border-t border-[#4A5568]">
          <div className="flex gap-2">
            {/* Clear Cells Button - matching reference design */}
            <button
              onClick={handleClearFields}
              className="bg-transparent hover:bg-[#EF4444]/10 text-[#EF4444] px-4 py-2 rounded-md border border-[#EF4444] hover:border-[#DC2626] hover:text-[#DC2626] text-sm font-medium transition-all duration-200"
            >
              تصفية الخلايا
            </button>
            
            <div className="flex-1"></div>
            
            {/* Cancel and Save buttons - exact styling */}
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500 px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim() || !formData.parentId || isSaving}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2 ${
                  !formData.name.trim() || !formData.parentId || isSaving
                    ? 'bg-gray-600 text-gray-400 border border-gray-600 cursor-not-allowed'
                    : 'bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500'
                }`}
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isSaving ? 'حفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}