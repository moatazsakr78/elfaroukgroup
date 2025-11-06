'use client';

import { useState, useEffect } from 'react';
import { useProductSizeGroups } from '../../../../../lib/hooks/useProductSizeGroups';

interface ManageSizeGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSizeGroupDeleted: () => void;
}

export default function ManageSizeGroupsModal({
  isOpen,
  onClose,
  onSizeGroupDeleted
}: ManageSizeGroupsModalProps) {
  const {
    sizeGroups,
    isLoading,
    error,
    fetchSizeGroups,
    deleteSizeGroup
  } = useProductSizeGroups();

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Load size groups when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSizeGroups();
    }
  }, [isOpen]);

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`هل أنت متأكد من فك ربط مجموعة "${groupName}"؟\n\nسيتم إعادة جميع المنتجات إلى حالتها المستقلة.`)) {
      return;
    }

    setIsDeleting(groupId);
    try {
      await deleteSizeGroup(groupId);
      alert(`تم فك ربط مجموعة "${groupName}" بنجاح!\n\nجميع المنتجات عادت إلى حالتها المستقلة.`);
      onSizeGroupDeleted();
      await fetchSizeGroups();
    } catch (error) {
      console.error('Error deleting size group:', error);
      alert('حدث خطأ أثناء فك الربط: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    } finally {
      setIsDeleting(null);
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">إدارة مجموعات الأحجام</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">جاري تحميل مجموعات الأحجام...</p>
              </div>
            </div>
          ) : sizeGroups.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">لا توجد مجموعات أحجام</h3>
              <p className="text-gray-500">لم يتم إنشاء أي مجموعات أحجام بعد</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sizeGroups.map((group) => (
                <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <div className="bg-gray-50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                          <span className="text-sm text-gray-500">
                            ({group.items?.length || 0} منتج)
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                        )}
                        <div className="text-xs text-gray-400">
                          تم الإنشاء: {group.created_at ? new Date(group.created_at).toLocaleDateString('ar-EG') : 'غير متوفر'}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleGroupExpansion(group.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedGroupId === group.id ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          disabled={isDeleting === group.id}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                          {isDeleting === group.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              <span>جاري فك الربط...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                              <span>فك الربط</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Products List */}
                  {expandedGroupId === group.id && group.items && group.items.length > 0 && (
                    <div className="p-4 bg-white border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">المنتجات في هذه المجموعة:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {group.items
                          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                          .map((item) => (
                            <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              {item.product?.main_image_url && (
                                <img
                                  src={item.product.main_image_url}
                                  alt={item.product.name}
                                  className="w-full h-24 object-cover rounded mb-2"
                                />
                              )}
                              <div className="text-sm font-medium text-gray-800 truncate mb-1">
                                {item.product?.name || 'منتج محذوف'}
                              </div>
                              <div className="text-xs text-blue-600 font-semibold mb-1">
                                الحجم: {item.size_name}
                              </div>
                              {item.product?.price && (
                                <div className="text-xs text-gray-600">
                                  {item.product.price} ريال
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {!isLoading && (
              <span>
                إجمالي المجموعات: <span className="font-semibold">{sizeGroups.length}</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
