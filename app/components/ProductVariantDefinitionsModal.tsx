'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase/client'
import { Product } from '../lib/hooks/useProducts'
import {
  XMarkIcon,
  PlusIcon,
  PhotoIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import Image from 'next/image'

interface ProductVariantDefinitionsModalProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  onDefinitionsUpdated: () => void
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
  created_at: string
  updated_at: string
}

export default function ProductVariantDefinitionsModal({
  product,
  isOpen,
  onClose,
  onDefinitionsUpdated
}: ProductVariantDefinitionsModalProps) {
  const [activeTab, setActiveTab] = useState<'color' | 'shape'>('color')
  const [definitions, setDefinitions] = useState<VariantDefinition[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form state for new definition
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    color_hex: '#000000',
    image_url: '',
    barcode: ''
  })

  // Load definitions when modal opens
  useEffect(() => {
    if (isOpen && product) {
      loadDefinitions()
    }
  }, [isOpen, product, activeTab])

  const loadDefinitions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_color_shape_definitions')
        .select('*')
        .eq('product_id', product.id)
        .eq('variant_type', activeTab)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setDefinitions((data || []) as any)
    } catch (error) {
      console.error('Error loading definitions:', error)
      alert('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddOrUpdate = async () => {
    // Validation
    if (activeTab === 'color' && !formData.name.trim()) {
      alert('يجب إدخال اسم اللون')
      return
    }

    if (!formData.image_url.trim()) {
      alert('يجب إضافة صورة')
      return
    }

    setIsSaving(true)
    try {
      const dataToSave = {
        product_id: product.id,
        variant_type: activeTab,
        name: formData.name.trim() || null,
        color_hex: activeTab === 'color' ? formData.color_hex : null,
        image_url: formData.image_url.trim(),
        barcode: activeTab === 'color' && formData.barcode.trim() ? formData.barcode.trim() : null,
        sort_order: definitions.length,
        updated_at: new Date().toISOString()
      }

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('product_color_shape_definitions')
          .update(dataToSave)
          .eq('id', editingId)

        if (error) throw error
        alert('تم التحديث بنجاح!')
      } else {
        // Insert new
        const { error } = await supabase
          .from('product_color_shape_definitions')
          .insert([dataToSave])

        if (error) throw error
        alert('تم الإضافة بنجاح!')
      }

      // Reset form
      setFormData({
        name: '',
        color_hex: '#000000',
        image_url: '',
        barcode: ''
      })
      setShowAddForm(false)
      setEditingId(null)

      // Reload
      await loadDefinitions()
      onDefinitionsUpdated()
    } catch (error: any) {
      console.error('Error saving definition:', error)
      if (error.code === '23505') {
        alert('هذا اللون/الشكل موجود بالفعل')
      } else {
        alert('حدث خطأ أثناء الحفظ: ' + error.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (definition: VariantDefinition) => {
    setEditingId(definition.id)
    setFormData({
      name: definition.name || '',
      color_hex: definition.color_hex || '#000000',
      image_url: definition.image_url || '',
      barcode: definition.barcode || ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟ سيتم حذف جميع الكميات المرتبطة بهذا اللون/الشكل من جميع الفروع.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('product_color_shape_definitions')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('تم الحذف بنجاح!')
      await loadDefinitions()
      onDefinitionsUpdated()
    } catch (error) {
      console.error('Error deleting definition:', error)
      alert('حدث خطأ أثناء الحذف')
    }
  }

  const cancelForm = () => {
    setShowAddForm(false)
    setEditingId(null)
    setFormData({
      name: '',
      color_hex: '#000000',
      image_url: '',
      barcode: ''
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PhotoIcon className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">إدارة ألوان وأشكال المنتج</h2>
              <p className="text-sm text-blue-100">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('color')}
            className={`flex-1 px-6 py-3 text-center font-medium transition-colors ${
              activeTab === 'color'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
            }`}
          >
            ألوان المنتج
          </button>
          <button
            onClick={() => setActiveTab('shape')}
            className={`flex-1 px-6 py-3 text-center font-medium transition-colors ${
              activeTab === 'shape'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
            }`}
          >
            أشكال المنتج
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mb-4 px-4 py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="font-medium">
                {activeTab === 'color' ? 'إضافة لون جديد' : 'إضافة شكل جديد'}
              </span>
            </button>
          )}

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="mb-6 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                {editingId
                  ? (activeTab === 'color' ? 'تعديل اللون' : 'تعديل الشكل')
                  : (activeTab === 'color' ? 'إضافة لون جديد' : 'إضافة شكل جديد')
                }
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name - Required for colors, optional for shapes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {activeTab === 'color' ? 'اسم اللون *' : 'اسم الشكل (اختياري)'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={activeTab === 'color' ? 'مثال: أحمر، أزرق' : 'مثال: استيتش يضحك (اختياري)'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Color Hex - Only for colors */}
                {activeTab === 'color' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      كود اللون *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.color_hex}
                        onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color_hex}
                        onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {/* Image URL */}
                <div className={activeTab === 'shape' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    رابط الصورة *
                  </label>
                  <input
                    type="text"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.image_url && (
                    <div className="mt-2 relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
                      <Image
                        src={formData.image_url}
                        alt="معاينة"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-product.svg'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Barcode - Only for colors */}
                {activeTab === 'color' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الباركود (اختياري)
                    </label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="مثال: 1234567890123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleAddOrUpdate}
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      {editingId ? 'تحديث' : 'إضافة'}
                    </>
                  )}
                </button>
                <button
                  onClick={cancelForm}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Definitions List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">جاري التحميل...</p>
            </div>
          ) : definitions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PhotoIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>لا توجد {activeTab === 'color' ? 'ألوان' : 'أشكال'} مضافة حتى الآن</p>
              <p className="text-sm mt-2">
                اضغط على الزر أعلاه لإضافة {activeTab === 'color' ? 'لون' : 'شكل'} جديد
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {definitions.map((def) => (
                <div
                  key={def.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  {def.image_url && (
                    <div className="relative w-full h-48 mb-3 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={def.image_url}
                        alt={def.name || 'شكل المنتج'}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-product.svg'
                        }}
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="space-y-2">
                    {def.name && (
                      <h4 className="font-bold text-gray-800">{def.name}</h4>
                    )}

                    {def.color_hex && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{ backgroundColor: def.color_hex }}
                        ></div>
                        <span className="text-sm text-gray-600">{def.color_hex}</span>
                      </div>
                    )}

                    {def.barcode && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">الباركود:</span> {def.barcode}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleEdit(def)}
                      className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <PencilIcon className="w-4 h-4" />
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(def.id)}
                      className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}
