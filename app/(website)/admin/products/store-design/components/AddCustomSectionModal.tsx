'use client';

import { useState, useEffect } from 'react';
import { useCustomSections } from '../../../../../../lib/hooks/useCustomSections';
import { uploadCustomSectionImage } from '@/app/lib/supabase/storage';

interface CloneConfig {
  id: string;
  image: string;
  label: string;
  uploading?: boolean;
}

interface ProductConfig {
  product_id: string;
  custom_image: string | null;
  clones: CloneConfig[];
  uploadingCustomImage?: boolean;
}

interface AddCustomSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: any[];
  onSectionCreated?: () => void;
  editingSection?: any | null;
}

export default function AddCustomSectionModal({
  isOpen,
  onClose,
  products,
  onSectionCreated,
  editingSection
}: AddCustomSectionModalProps) {
  const { createSection, updateSection } = useCustomSections();
  const [isCreating, setIsCreating] = useState(false);

  // Step management
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Form state - Step 1
  const [sectionName, setSectionName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Form state - Step 2: per-product configs
  const [productConfigs, setProductConfigs] = useState<Map<string, ProductConfig>>(new Map());

  // Reset form when modal opens/closes or load editing data
  useEffect(() => {
    if (isOpen) {
      if (editingSection) {
        setSectionName(editingSection.name || '');
        setSearchTerm('');
        setCurrentStep(1);

        // Parse existing products (could be string[] or object[])
        const rawProducts = editingSection.products || [];
        const selectedIds = new Set<string>();
        const configs = new Map<string, ProductConfig>();

        rawProducts.forEach((p: any) => {
          if (typeof p === 'string') {
            selectedIds.add(p);
            configs.set(p, { product_id: p, custom_image: null, clones: [] });
          } else {
            const id = p.product_id;
            selectedIds.add(id);
            configs.set(id, {
              product_id: id,
              custom_image: p.custom_image || null,
              clones: (p.clones || []).map((c: any) => ({
                id: c.id || crypto.randomUUID(),
                image: c.image || '',
                label: c.label || ''
              }))
            });
          }
        });

        setSelectedProducts(selectedIds);
        setProductConfigs(configs);
        setSelectAll(false);
      } else {
        setSectionName('');
        setSearchTerm('');
        setSelectedProducts(new Set());
        setSelectAll(false);
        setCurrentStep(1);
        setProductConfigs(new Map());
      }
    }
  }, [isOpen, editingSection]);

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category?.name && product.category.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle individual product selection
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
    setSelectAll(newSelected.size === filteredProducts.length);
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
    setSelectAll(!selectAll);
  };

  // Go to step 2 - initialize configs for newly selected products
  const goToStep2 = () => {
    const newConfigs = new Map(productConfigs);
    // Add configs for newly selected products
    selectedProducts.forEach(id => {
      if (!newConfigs.has(id)) {
        newConfigs.set(id, { product_id: id, custom_image: null, clones: [] });
      }
    });
    // Remove configs for deselected products
    newConfigs.forEach((_, id) => {
      if (!selectedProducts.has(id)) {
        newConfigs.delete(id);
      }
    });
    setProductConfigs(newConfigs);
    setCurrentStep(2);
  };

  // Upload custom image for a product
  const handleUploadCustomImage = async (productId: string, file: File) => {
    const newConfigs = new Map(productConfigs);
    const config = newConfigs.get(productId);
    if (!config) return;

    config.uploadingCustomImage = true;
    setProductConfigs(new Map(newConfigs));

    try {
      const url = await uploadCustomSectionImage(file);
      config.custom_image = url;
    } catch (error) {
      console.error('Error uploading custom image:', error);
      alert('فشل رفع الصورة');
    } finally {
      config.uploadingCustomImage = false;
      setProductConfigs(new Map(newConfigs));
    }
  };

  // Remove custom image
  const handleRemoveCustomImage = (productId: string) => {
    const newConfigs = new Map(productConfigs);
    const config = newConfigs.get(productId);
    if (!config) return;
    config.custom_image = null;
    setProductConfigs(new Map(newConfigs));
  };

  // Add a clone
  const handleAddClone = (productId: string) => {
    const newConfigs = new Map(productConfigs);
    const config = newConfigs.get(productId);
    if (!config) return;
    config.clones.push({ id: crypto.randomUUID(), image: '', label: '' });
    setProductConfigs(new Map(newConfigs));
  };

  // Remove a clone
  const handleRemoveClone = (productId: string, cloneId: string) => {
    const newConfigs = new Map(productConfigs);
    const config = newConfigs.get(productId);
    if (!config) return;
    config.clones = config.clones.filter(c => c.id !== cloneId);
    setProductConfigs(new Map(newConfigs));
  };

  // Upload clone image
  const handleUploadCloneImage = async (productId: string, cloneId: string, file: File) => {
    const newConfigs = new Map(productConfigs);
    const config = newConfigs.get(productId);
    if (!config) return;

    const clone = config.clones.find(c => c.id === cloneId);
    if (!clone) return;

    clone.uploading = true;
    setProductConfigs(new Map(newConfigs));

    try {
      const url = await uploadCustomSectionImage(file);
      clone.image = url;
    } catch (error) {
      console.error('Error uploading clone image:', error);
      alert('فشل رفع صورة التصميم');
    } finally {
      clone.uploading = false;
      setProductConfigs(new Map(newConfigs));
    }
  };

  // Update clone label
  const handleCloneLabelChange = (productId: string, cloneId: string, label: string) => {
    const newConfigs = new Map(productConfigs);
    const config = newConfigs.get(productId);
    if (!config) return;
    const clone = config.clones.find(c => c.id === cloneId);
    if (!clone) return;
    clone.label = label;
    setProductConfigs(new Map(newConfigs));
  };

  // Build save format
  const buildProductsArray = () => {
    return Array.from(selectedProducts).map(id => {
      const config = productConfigs.get(id);
      if (!config) return { product_id: id };
      return {
        product_id: id,
        custom_image: config.custom_image || null,
        clones: config.clones
          .filter(c => c.image) // Only include clones with images
          .map(c => ({ id: c.id, image: c.image, label: c.label }))
      };
    });
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!sectionName.trim()) {
      alert('يرجى إدخال اسم القسم');
      return;
    }

    if (selectedProducts.size === 0) {
      alert('يرجى اختيار منتج واحد على الأقل');
      return;
    }

    setIsCreating(true);
    try {
      const productsData = buildProductsArray();

      if (editingSection) {
        await updateSection(editingSection.id, {
          name: sectionName.trim(),
          products: productsData
        });
        alert('تم تحديث القسم بنجاح!');
      } else {
        await createSection({
          name: sectionName.trim(),
          section_key: `section-${Date.now()}`,
          is_active: true,
          display_order: 0,
          products: productsData
        });
        alert('تم إنشاء القسم بنجاح!');
      }

      onSectionCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating/updating section:', error);
      alert(editingSection ? 'حدث خطأ أثناء تحديث القسم' : 'حدث خطأ أثناء إنشاء القسم');
    } finally {
      setIsCreating(false);
    }
  };

  // Get product info by id
  const getProductInfo = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-5xl h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-2xl font-bold text-gray-800">
              {editingSection ? 'تعديل القسم المخصص' : 'إضافة قسم مخصص جديد'}
            </h2>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mr-4">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>1</span>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>2</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {currentStep === 1 ? (
            <>
              {/* Step 1: Section Name + Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم القسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="مثال: منتجات تيك توك، المنتجات الجديدة، عروض خاصة..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {sectionName.length}/100 حرف
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اختيار المنتجات <span className="text-red-500">*</span>
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="البحث في المنتجات..."
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">اختيار الكل</span>
                  </label>
                </div>

                <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">{selectedProducts.size}</span> منتج محدد
                  </p>
                </div>

                <div className="border border-gray-300 rounded-lg max-h-[40vh] md:max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => toggleProductSelection(product.id)}
                        className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                          selectedProducts.has(product.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="aspect-square relative">
                          <img
                            src={product.main_image_url || '/placeholder-product.svg'}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-t-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder-product.svg';
                            }}
                          />
                          {selectedProducts.has(product.id) && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-800 truncate">{product.name}</p>
                          <p className="text-xs text-gray-500 truncate">{product.category?.name || 'عام'}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-500">لا توجد منتجات مطابقة للبحث</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: Per-product configuration */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  قم بإعداد صور مخصصة وتصاميم (Clones) لكل منتج. هذه الخطوة اختيارية - يمكنك تخطيها بالضغط على "إنشاء القسم" مباشرة.
                </p>
              </div>

              <div className="space-y-6">
                {Array.from(selectedProducts).map(productId => {
                  const product = getProductInfo(productId);
                  const config = productConfigs.get(productId);
                  if (!product || !config) return null;

                  return (
                    <div key={productId} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      {/* Product header */}
                      <div className="flex items-center gap-4 mb-4">
                        <img
                          src={product.main_image_url || '/placeholder-product.svg'}
                          alt={product.name}
                          className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }}
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{product.name}</h4>
                          <p className="text-sm text-gray-500">{product.category?.name || 'عام'}</p>
                        </div>
                      </div>

                      {/* Custom Image */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">صورة مخصصة للقسم</label>
                        <div className="flex items-center gap-3">
                          {config.custom_image ? (
                            <div className="relative">
                              <img
                                src={config.custom_image}
                                alt="صورة مخصصة"
                                className="w-20 h-20 rounded-lg object-cover border border-gray-300"
                              />
                              <button
                                onClick={() => handleRemoveCustomImage(productId)}
                                className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                              {config.uploadingCustomImage ? (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                              <span className="text-sm text-gray-600">رفع صورة مخصصة</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadCustomImage(productId, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Clones */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-600">التصاميم (Clones)</label>
                          <button
                            onClick={() => handleAddClone(productId)}
                            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            إضافة تصميم
                          </button>
                        </div>

                        {config.clones.length === 0 && (
                          <p className="text-xs text-gray-400 py-2">لا توجد تصاميم. اضغط "إضافة تصميم" لإضافة أشكال مختلفة للمنتج.</p>
                        )}

                        <div className="space-y-3">
                          {config.clones.map((clone, idx) => (
                            <div key={clone.id} className="flex items-center gap-2 md:gap-3 bg-white rounded-lg p-2 md:p-3 border border-gray-200">
                              <span className="text-sm text-gray-400 font-mono w-6">{idx + 1}</span>

                              {/* Clone image */}
                              {clone.image ? (
                                <div className="relative flex-shrink-0">
                                  <img
                                    src={clone.image}
                                    alt={clone.label || 'تصميم'}
                                    className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                                  />
                                </div>
                              ) : (
                                <label className="flex-shrink-0 w-14 h-14 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                                  {clone.uploading ? (
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadCloneImage(productId, clone.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}

                              {/* Clone label */}
                              <input
                                type="text"
                                value={clone.label}
                                onChange={(e) => handleCloneLabelChange(productId, clone.id, e.target.value)}
                                placeholder={`تصميم ${idx + 1}`}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />

                              {/* Re-upload if already has image */}
                              {clone.image && (
                                <label className="flex-shrink-0 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded cursor-pointer hover:bg-gray-200">
                                  تغيير
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadCloneImage(productId, clone.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}

                              {/* Delete clone */}
                              <button
                                onClick={() => handleRemoveClone(productId, clone.id)}
                                className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-gray-200">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={onClose}
              className="px-4 md:px-6 py-2 text-sm md:text-base text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isCreating}
            >
              إلغاء
            </button>
            {currentStep === 2 && (
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 md:px-6 py-2 text-sm md:text-base text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isCreating}
              >
                السابق
              </button>
            )}
          </div>

          {currentStep === 1 ? (
            <button
              onClick={goToStep2}
              disabled={!sectionName.trim() || selectedProducts.size === 0}
              className="px-4 md:px-6 py-2 text-sm md:text-base text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              التالي
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isCreating || !sectionName.trim() || selectedProducts.size === 0}
              className="px-4 md:px-6 py-2 text-sm md:text-base text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--primary-color)' }}
              onMouseEnter={(e) => {
                if (!isCreating) (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
              }}
              onMouseLeave={(e) => {
                if (!isCreating) (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
              }}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {editingSection ? 'جاري التحديث...' : 'جاري الإنشاء...'}
                </>
              ) : (
                editingSection ? 'تحديث القسم' : 'إنشاء القسم'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
