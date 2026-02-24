'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import { uploadCategoryImage } from '../lib/supabase/storage'
import { ArrowRightIcon, PhotoIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useActivityLogger } from "@/app/lib/hooks/useActivityLogger"

interface Category {
  id: string
  name: string
  name_en: string | null
  parent_id: string | null
  image_url: string | null
  is_active: boolean | null
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

interface CategorySidebarProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  onCategoryCreated: () => void
  editCategory?: Category | null
  isEditing?: boolean
  selectedCategory?: Category | null
}

export default function CategorySidebar({ isOpen, onClose, categories, onCategoryCreated, editCategory, isEditing, selectedCategory }: CategorySidebarProps) {
  const activityLog = useActivityLogger()
  const [activeTab, setActiveTab] = useState('details')
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    imageUrl: '',
    imageFile: null as File | null
  })

  // Pre-fill form data when editing or auto-select parent
  useEffect(() => {
    if (isEditing && editCategory) {
      setFormData({
        name: editCategory.name || '',
        parentId: editCategory.parent_id || '',
        imageUrl: editCategory.image_url || '',
        imageFile: null
      })
    } else if (!isEditing) {
      // Auto-select parent category based on current selection
      let defaultParentId = ''
      
      if (selectedCategory) {
        // If a category is selected, use it as parent
        defaultParentId = selectedCategory.id
      } else {
        // If no category is selected, find "منتجات" category
        const productsCategory = categories.find(cat => cat.name === 'منتجات' && cat.is_active)
        if (productsCategory) {
          defaultParentId = productsCategory.id
        }
      }
      
      setFormData({
        name: '',
        parentId: defaultParentId,
        imageUrl: '',
        imageFile: null
      })
    }
  }, [isEditing, editCategory, selectedCategory, categories, isOpen])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('حجم الصورة يجب أن يكون أقل من 5 ميجابايت')
      return
    }

    setIsUploading(true)
    try {
      const imageUrl = await uploadCategoryImage(file)
      setFormData(prev => ({
        ...prev,
        imageUrl,
        imageFile: file
      }))
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('حدث خطأ أثناء رفع الصورة')
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleImageUpload(files[0])
    }
  }

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      imageUrl: '',
      imageFile: null
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.parentId) return
    
    setIsSaving(true)
    try {
      if (isEditing && editCategory) {
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            parent_id: formData.parentId || null,
            image_url: formData.imageUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editCategory.id)
        
        if (error) throw error
        activityLog({ entityType: 'category', actionType: 'update', entityId: editCategory!.id, entityName: formData.name })
      } else {
        // Create new category
        const { error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            parent_id: formData.parentId || null,
            image_url: formData.imageUrl || null,
            is_active: true,
            sort_order: 0
          })
        
        if (error) throw error
        activityLog({ entityType: 'category', actionType: 'create', entityName: formData.name })
      }

      // Reset form and close
      setFormData({
        name: '',
        parentId: '',
        imageUrl: '',
        imageFile: null
      })
      onCategoryCreated()
      onClose()
    } catch (error) {
      console.error('Error creating category:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: '',
      parentId: '',
      imageUrl: '',
      imageFile: null
    })
    onClose()
  }

  const handleClearFields = () => {
    // Instant clearing without confirmation
    setFormData({
      name: '',
      parentId: '',
      imageUrl: '',
      imageFile: null
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
          

          {/* Category Name Field */}
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
                    ? categories.find(cat => cat.id === formData.parentId)?.name || '-- اختر المجموعة الرئيسية (مطلوب) --'
                    : '-- اختر المجموعة الرئيسية (مطلوب) --'
                  }
                </span>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#2B3441] border border-[#4A5568] rounded shadow-lg z-10 max-h-48 overflow-y-auto scrollbar-hide">
                  {categories
                    .filter(cat => cat.is_active)
                    .map(category => {
                      const isRootProducts = category.name === 'منتجات' && !category.parent_id
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleParentSelect(category.id, category.name)}
                          className={`w-full px-3 py-2 text-right hover:bg-[#374151] transition-colors ${
                            isRootProducts 
                              ? 'font-medium text-blue-400 cursor-default' 
                              : 'text-white'
                          }`}
                          disabled={false}
                        >
                          {category.name}{isRootProducts ? ' (افتراضي)' : ''}
                        </button>
                      )
                    })
                  }
                </div>
              )}
            </div>
          </div>

          {/* Category Image Field - Drag & Drop */}
          <div className="space-y-2">
            <label className="block text-white text-sm font-medium text-right">
              صورة المجموعة
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="category-image"
              />
              
              {!formData.imageUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-center w-full px-4 py-8 bg-[#2B3441] border-2 border-dashed rounded cursor-pointer transition-all ${
                    isDragOver 
                      ? 'border-[#5DADE2] bg-[#5DADE2]/10' 
                      : 'border-[#4A5568] hover:border-gray-500'
                  }`}
                >
                  <div className="text-center">
                    {isUploading ? (
                      <>
                        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span className="text-blue-400 text-sm">جاري الرفع...</span>
                      </>
                    ) : (
                      <>
                        <PhotoIcon className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                        <span className="text-gray-400 text-sm">
                          {isDragOver ? 'اتركها هنا' : 'اسحب الصورة هنا أو انقر للاختيار'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF - حتى 5MB</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={formData.imageUrl}
                    alt="صورة المجموعة"
                    className="w-full h-32 object-cover rounded border border-[#4A5568]"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {formData.imageFile?.name || 'صورة مرفوعة'}
                  </div>
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

          {/* Empty spacer area with same height as the tab navigation section - only on mobile/tablet */}
          <div className="h-14 bg-[#3A4553] md:hidden"></div>
        </div>
      </div>
    </>
  )
}