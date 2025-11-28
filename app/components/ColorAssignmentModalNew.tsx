'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase/client'
import { Product, Branch } from '../lib/hooks/useProducts'
import {
  XMarkIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import Image from 'next/image'

interface ColorAssignmentModalNewProps {
  product: Product
  branches: Branch[]
  isOpen: boolean
  onClose: () => void
  onAssignmentComplete: () => void
}

interface VariantDefinition {
  id: string
  product_id: string
  variant_type: 'color' | 'shape'
  name: string | null
  color_hex: string | null
  image_url: string | null
  barcode: string | null
  sort_order: number
}

interface QuantityData {
  [variantId: string]: {
    [branchId: string]: number
  }
}

export default function ColorAssignmentModalNew({
  product,
  branches,
  isOpen,
  onClose,
  onAssignmentComplete
}: ColorAssignmentModalNewProps) {
  const [activeTab, setActiveTab] = useState<'colors' | 'shapes' | 'quantities'>('colors')
  const [definitions, setDefinitions] = useState<VariantDefinition[]>([])
  const [quantities, setQuantities] = useState<QuantityData>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form states for adding/editing
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    color_hex: '#000000',
    image_file: null as File | null,
    image_preview: '',
    barcode: ''
  })

  // Image upload state
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Selected branch for quantities
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')

  // Load definitions and quantities when modal opens
  useEffect(() => {
    if (isOpen && product) {
      if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id)
      }
      loadDefinitionsAndQuantities()
    }
  }, [isOpen, product, activeTab])

  // Reload quantities when branch changes
  useEffect(() => {
    if (isOpen && selectedBranchId && activeTab === 'quantities') {
      loadQuantitiesForBranch()
    }
  }, [selectedBranchId, activeTab])

  const loadDefinitionsAndQuantities = async () => {
    setIsLoading(true)
    try {
      // Determine variant type based on active tab
      const variantType = activeTab === 'quantities' ? null : activeTab === 'colors' ? 'color' : 'shape'

      // Load variant definitions
      let query = supabase
        .from('product_color_shape_definitions')
        .select('*')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true })

      if (variantType) {
        query = query.eq('variant_type', variantType)
      }

      const { data: defs, error: defsError } = await query

      if (defsError) throw defsError
      setDefinitions(defs || [])

      // Load quantities if in quantities tab
      if (activeTab === 'quantities' && defs && defs.length > 0) {
        const variantIds = defs.map(d => d.id)
        const { data: qtys, error: qtysError } = await supabase
          .from('product_variant_quantities')
          .select('*')
          .in('variant_definition_id', variantIds)

        if (qtysError) throw qtysError

        // Organize quantities
        const qtyData: QuantityData = {}
        defs.forEach(def => {
          qtyData[def.id] = {}
          branches.forEach(branch => {
            qtyData[def.id][branch.id] = 0
          })
        })

        qtys?.forEach(qty => {
          if (qtyData[qty.variant_definition_id]) {
            qtyData[qty.variant_definition_id][qty.branch_id] = qty.quantity
          }
        })

        setQuantities(qtyData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      alert('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuantitiesForBranch = async () => {
    if (!selectedBranchId || definitions.length === 0) return

    try {
      const variantIds = definitions.map(d => d.id)
      const { data: qtys, error } = await supabase
        .from('product_variant_quantities')
        .select('*')
        .in('variant_definition_id', variantIds)
        .eq('branch_id', selectedBranchId)

      if (error) throw error

      setQuantities(prev => {
        const updated = { ...prev }
        definitions.forEach(def => {
          const qty = qtys?.find(q => q.variant_definition_id === def.id)
          if (!updated[def.id]) updated[def.id] = {}
          updated[def.id][selectedBranchId] = qty?.quantity || 0
        })
        return updated
      })
    } catch (error) {
      console.error('Error loading quantities:', error)
    }
  }

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData(prev => ({
        ...prev,
        image_file: file,
        image_preview: URL.createObjectURL(file)
      }))
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      setFormData(prev => ({
        ...prev,
        image_file: file,
        image_preview: URL.createObjectURL(file)
      }))
    } else {
      alert('يرجى رفع ملف صورة فقط')
    }
  }

  // Upload image to Supabase Storage
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploadProgress(10)

      // Generate unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `${product.id}/${Date.now()}.${fileExt}`

      setUploadProgress(30)

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      setUploadProgress(70)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      setUploadProgress(100)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('حدث خطأ أثناء رفع الصورة')
      return null
    } finally {
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  // Handle save
  const handleSave = async () => {
    const variantType = activeTab === 'colors' ? 'color' : 'shape'

    // Validation
    if (variantType === 'color' && !formData.name.trim()) {
      alert('يجب إدخال اسم اللون')
      return
    }

    setIsSaving(true)
    try {
      let imageUrl = formData.image_preview

      // Upload image if a new file is selected
      if (formData.image_file) {
        const uploaded = await uploadImage(formData.image_file)
        if (uploaded) {
          imageUrl = uploaded
        } else {
          throw new Error('فشل رفع الصورة')
        }
      }

      const definitionData = {
        product_id: product.id,
        variant_type: variantType,
        name: formData.name.trim() || null,
        color_hex: variantType === 'color' ? formData.color_hex : null,
        image_url: imageUrl || null,
        barcode: variantType === 'color' ? formData.barcode.trim() || null : null,
        sort_order: definitions.length,
        updated_at: new Date().toISOString()
      }

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('product_color_shape_definitions')
          .update(definitionData)
          .eq('id', editingId)

        if (error) throw error
        alert('تم التحديث بنجاح!')
      } else {
        // Insert new
        const { error } = await supabase
          .from('product_color_shape_definitions')
          .insert([definitionData])

        if (error) throw error
        alert('تمت الإضافة بنجاح!')
      }

      // Reset form
      setFormData({
        name: '',
        color_hex: '#000000',
        image_file: null,
        image_preview: '',
        barcode: ''
      })
      setIsAdding(false)
      setEditingId(null)

      // Reload data
      await loadDefinitionsAndQuantities()
    } catch (error) {
      console.error('Error saving:', error)
      alert('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle edit
  const handleEdit = (def: VariantDefinition) => {
    setEditingId(def.id)
    setIsAdding(true)
    setFormData({
      name: def.name || '',
      color_hex: def.color_hex || '#000000',
      image_file: null,
      image_preview: def.image_url || '',
      barcode: def.barcode || ''
    })
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return

    try {
      const { error } = await supabase
        .from('product_color_shape_definitions')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('تم الحذف بنجاح!')
      await loadDefinitionsAndQuantities()
    } catch (error) {
      console.error('Error deleting:', error)
      alert('حدث خطأ أثناء الحذف')
    }
  }

  // Handle quantity change
  const handleQuantityChange = (variantId: string, branchId: string, value: string) => {
    const numValue = parseInt(value) || 0
    setQuantities(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [branchId]: numValue
      }
    }))
  }

  // Save quantities
  const handleSaveQuantities = async () => {
    if (!selectedBranchId) {
      alert('يرجى اختيار فرع')
      return
    }

    setIsSaving(true)
    try {
      const upsertData = definitions.map(def => ({
        variant_definition_id: def.id,
        branch_id: selectedBranchId,
        quantity: quantities[def.id]?.[selectedBranchId] || 0,
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('product_variant_quantities')
        .upsert(upsertData, {
          onConflict: 'variant_definition_id,branch_id'
        })

      if (error) throw error

      alert('تم حفظ الكميات بنجاح!')
      onAssignmentComplete()
    } catch (error) {
      console.error('Error saving quantities:', error)
      alert('حدث خطأ أثناء الحفظ')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedBranch = branches.find(b => b.id === selectedBranchId)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2B3544] rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#3B4555] text-white px-6 py-4 flex items-center justify-between border-b border-gray-600">
          <div>
            <h2 className="text-xl font-bold">إدارة الألوان والأشكال</h2>
            <p className="text-sm text-gray-300">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-[#374151] border-b border-gray-600 px-6">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('colors'); setIsAdding(false); setEditingId(null); }}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'colors'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              الألوان
            </button>
            <button
              onClick={() => { setActiveTab('shapes'); setIsAdding(false); setEditingId(null); }}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'shapes'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              الأشكال
            </button>
            <button
              onClick={() => { setActiveTab('quantities'); setIsAdding(false); setEditingId(null); }}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'quantities'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              الكميات
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-400 mt-4">جاري التحميل...</p>
            </div>
          ) : activeTab === 'quantities' ? (
            // Quantities Tab
            <div>
              <div className="mb-6 bg-[#374151] p-4 rounded-lg border border-gray-600">
                <label className="block text-gray-300 font-medium mb-2">اختر الفرع:</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-4 py-2 bg-[#2B3544] text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {definitions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="font-medium">لا توجد ألوان أو أشكال محددة</p>
                  <p className="text-sm mt-2">يجب أولاً إضافة ألوان أو أشكال من التبويبات السابقة</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {definitions.map((def) => (
                    <div
                      key={def.id}
                      className="bg-[#374151] border border-gray-600 rounded-lg p-4 hover:border-blue-500 transition-colors"
                    >
                      {def.image_url && (
                        <div className="relative w-full h-32 mb-3 bg-gray-700 rounded-lg overflow-hidden">
                          <Image
                            src={def.image_url}
                            alt={def.name || 'Variant'}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.svg'
                            }}
                          />
                        </div>
                      )}

                      <div className="mb-3">
                        {def.name && (
                          <h4 className="font-bold text-white text-center mb-1">{def.name}</h4>
                        )}
                        {def.color_hex && (
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className="w-6 h-6 rounded border border-gray-500"
                              style={{ backgroundColor: def.color_hex }}
                            ></div>
                            <span className="text-xs text-gray-400">{def.color_hex}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 text-center mt-1">
                          {def.variant_type === 'color' ? 'لون' : 'شكل'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1 text-center">
                          الكمية
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={quantities[def.id]?.[selectedBranchId] || 0}
                          onChange={(e) => handleQuantityChange(def.id, selectedBranchId, e.target.value)}
                          className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded-lg text-center text-lg font-bold text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Colors/Shapes Tabs
            <div>
              {!isAdding ? (
                <>
                  <div className="mb-6">
                    <button
                      onClick={() => setIsAdding(true)}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                    >
                      <PlusIcon className="w-5 h-5" />
                      إضافة {activeTab === 'colors' ? 'لون' : 'شكل'} جديد
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {definitions.map((def) => (
                      <div
                        key={def.id}
                        className="bg-[#374151] border border-gray-600 rounded-lg p-4 relative group hover:border-blue-500 transition-colors"
                      >
                        {def.image_url && (
                          <div className="relative w-full h-32 mb-3 bg-gray-700 rounded-lg overflow-hidden">
                            <Image
                              src={def.image_url}
                              alt={def.name || 'Variant'}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-product.svg'
                              }}
                            />
                          </div>
                        )}

                        <div className="text-center">
                          {def.name && (
                            <h4 className="font-bold text-white mb-2">{def.name}</h4>
                          )}
                          {def.color_hex && (
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <div
                                className="w-6 h-6 rounded border border-gray-500"
                                style={{ backgroundColor: def.color_hex }}
                              ></div>
                              <span className="text-xs text-gray-400">{def.color_hex}</span>
                            </div>
                          )}
                          {def.barcode && (
                            <p className="text-xs text-gray-400 font-mono">{def.barcode}</p>
                          )}
                        </div>

                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={() => handleEdit(def)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded-full"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(def.id)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {definitions.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <p className="font-medium">لا توجد {activeTab === 'colors' ? 'ألوان' : 'أشكال'} محددة</p>
                      <p className="text-sm mt-2">اضغط على "إضافة {activeTab === 'colors' ? 'لون' : 'شكل'} جديد" للبدء</p>
                    </div>
                  )}
                </>
              ) : (
                // Add/Edit Form
                <div className="max-w-2xl mx-auto bg-[#374151] p-6 rounded-lg border border-gray-600">
                  <h3 className="text-xl font-bold text-white mb-6">
                    {editingId ? 'تحرير' : 'إضافة'} {activeTab === 'colors' ? 'لون' : 'شكل'}
                  </h3>

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-gray-300 font-medium mb-2">
                        اسم ال{activeTab === 'colors' ? 'لون' : 'شكل'}
                        {activeTab === 'colors' && <span className="text-red-400"> *</span>}
                        {activeTab === 'shapes' && <span className="text-gray-500 text-sm"> (اختياري)</span>}
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-2 bg-[#2B3544] text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`أدخل اسم ال${activeTab === 'colors' ? 'لون' : 'شكل'}`}
                      />
                    </div>

                    {/* Color Hex - Only for colors */}
                    {activeTab === 'colors' && (
                      <div>
                        <label className="block text-gray-300 font-medium mb-2">كود اللون (Hex)</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.color_hex}
                            onChange={(e) => setFormData(prev => ({ ...prev, color_hex: e.target.value }))}
                            className="w-20 h-12 rounded-lg cursor-pointer bg-[#2B3544] border border-gray-600"
                          />
                          <input
                            type="text"
                            value={formData.color_hex}
                            onChange={(e) => setFormData(prev => ({ ...prev, color_hex: e.target.value }))}
                            className="flex-1 px-4 py-2 bg-[#2B3544] text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Image Upload */}
                    <div>
                      <label className="block text-gray-300 font-medium mb-2">صورة ال{activeTab === 'colors' ? 'لون' : 'شكل'}</label>

                      {!formData.image_preview ? (
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                            isDragging
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          <PhotoIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                          <p className="text-gray-300 mb-1">اسحب الصورة هنا أو اضغط للاختيار</p>
                          <p className="text-sm text-gray-500">PNG, JPG, WEBP (حتى 5MB)</p>
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <img
                            src={formData.image_preview}
                            alt="Preview"
                            className="w-full h-64 object-cover rounded-lg border border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, image_file: null, image_preview: '' }))}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="mt-2">
                          <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-400 text-center mt-1">جاري الرفع... {uploadProgress}%</p>
                        </div>
                      )}
                    </div>

                    {/* Barcode - Only for colors */}
                    {activeTab === 'colors' && (
                      <div>
                        <label className="block text-gray-300 font-medium mb-2">الباركود <span className="text-gray-500 text-sm">(اختياري)</span></label>
                        <input
                          type="text"
                          value={formData.barcode}
                          onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                          className="w-full px-4 py-2 bg-[#2B3544] text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                          placeholder="أدخل الباركود"
                        />
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleSave}
                      disabled={isSaving || uploadProgress > 0}
                      className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-600 flex items-center justify-center gap-2 font-medium"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          {editingId ? 'تحديث' : 'حفظ'}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setEditingId(null)
                        setFormData({
                          name: '',
                          color_hex: '#000000',
                          image_file: null,
                          image_preview: '',
                          barcode: ''
                        })
                      }}
                      disabled={isSaving}
                      className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'quantities' && !isLoading && definitions.length > 0 && (
          <div className="border-t border-gray-600 px-6 py-4 bg-[#374151] flex gap-3">
            <button
              onClick={handleSaveQuantities}
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-600 flex items-center justify-center gap-2 font-medium"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <CheckIcon className="w-5 h-5" />
                  حفظ الكميات
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
