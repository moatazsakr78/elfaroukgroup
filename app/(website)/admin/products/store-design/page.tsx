'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProductsAdmin } from '../../../../lib/hooks/useProductsAdmin';
import { useCustomSections } from '../../../../../lib/hooks/useCustomSections';
import { DragDropProvider } from '../components/DragDropProvider';
import CustomSectionManagementGrid from './components/CustomSectionManagementGrid';
import AddCustomSectionModal from './components/AddCustomSectionModal';
import { supabase } from '../../../../lib/supabase/client';

interface CustomSectionItem {
  id: string;
  name: string;
  description: string;
  isHidden: boolean;
  displayOrder: number;
  productCount: number;
  products: string[];
}

export default function StoreDesignPage() {
  const router = useRouter();
  const { products: databaseProducts, isLoading: isProductsLoading, fetchProducts } = useProductsAdmin();
  const { sections: customSections, isLoading: isSectionsLoading, fetchSections, deleteSection, reorderSections } = useCustomSections();
  const [sections, setSections] = useState<CustomSectionItem[]>([]);
  const [originalSections, setOriginalSections] = useState<CustomSectionItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [isEditSectionModalOpen, setIsEditSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Set client-side flag after component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Warn user when leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Convert custom sections to management format
  useEffect(() => {
    if (customSections && customSections.length >= 0 && !isSaving) {
      const convertedSections = customSections.map((section: any, index: number) => ({
        id: section.id,
        name: section.name,
        description: section.description || '',
        isHidden: !section.is_active,
        displayOrder: section.display_order || index,
        productCount: Array.isArray(section.products) ? section.products.length : 0,
        products: Array.isArray(section.products) ? section.products : []
      }));

      setSections(convertedSections);
      setOriginalSections(JSON.parse(JSON.stringify(convertedSections)));
      setHasUnsavedChanges(false);
    }
  }, [customSections, isSaving]);

  const toggleDragMode = () => {
    setIsDragMode(!isDragMode);
  };

  const toggleSectionVisibility = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const newHiddenState = !section.isHidden;

    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, isHidden: newHiddenState } : s
    ));
    setHasUnsavedChanges(true);
  };

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSectionId(selectedSectionId === sectionId ? null : sectionId);
  };

  const handleEditSection = () => {
    if (selectedSectionId) {
      const section = sections.find(s => s.id === selectedSectionId);
      if (section) {
        setEditingSection(section);
        setIsEditSectionModalOpen(true);
      }
    }
  };

  const handleDeleteSection = async () => {
    if (selectedSectionId) {
      const section = sections.find(s => s.id === selectedSectionId);
      if (section && confirm(`هل أنت متأكد من حذف القسم "${section.name}"؟\n\nلن يتم حذف المنتجات، فقط القسم المخصص.`)) {
        try {
          await deleteSection(selectedSectionId);
          setSelectedSectionId(null);
          // Remove from local state
          setSections(prev => prev.filter(s => s.id !== selectedSectionId));
          alert(`تم حذف القسم "${section.name}" بنجاح`);
        } catch (error) {
          console.error('Error deleting section:', error);
          alert('حدث خطأ أثناء حذف القسم');
        }
      }
    }
  };

  const handleSectionReorder = (reorderedSections: any[]) => {
    setSections(reorderedSections);
    setHasUnsavedChanges(true);
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    console.log('🟢 Starting save process for custom sections...');
    console.log('Current sections:', sections);
    console.log('Original sections:', originalSections);

    try {
      // Check if there are changes to save
      const hasOrderChanges = sections.some((section, index) => {
        const original = originalSections.find(os => os.id === section.id);
        return !original || original.displayOrder !== index;
      });

      const hasVisibilityChanges = sections.some((section) => {
        const original = originalSections.find(os => os.id === section.id);
        return !original || original.isHidden !== section.isHidden;
      });

      if (!hasOrderChanges && !hasVisibilityChanges) {
        console.log('🟡 No changes to save');
        alert('لا توجد تغييرات للحفظ');
        setIsSaving(false);
        return;
      }

      // Convert management format back to custom sections format
      const reorderedCustomSections = sections.map((section, index) => ({
        id: section.id,
        name: section.name,
        description: section.description,
        section_key: `section-${section.id}`,
        is_active: !section.isHidden,
        display_order: index,
        products: section.products,
        created_at: '',
        updated_at: new Date().toISOString(),
        created_by: null
      }));

      // Update order and visibility
      if (hasOrderChanges) {
        console.log('🔄 Updating custom sections order...');
        await reorderSections(reorderedCustomSections);
      }

      // Handle visibility changes separately if needed
      if (hasVisibilityChanges && !hasOrderChanges) {
        console.log('🔄 Updating custom sections visibility...');
        const visibilityUpdatePromises = sections
          .filter(section => {
            const original = originalSections.find(os => os.id === section.id);
            return original && original.isHidden !== section.isHidden;
          })
          .map(section =>
            (supabase as any)
              .from('custom_sections')
              .update({
                is_active: !section.isHidden,
                updated_at: new Date().toISOString()
              })
              .eq('id', section.id)
          );

        await Promise.all(visibilityUpdatePromises);
      }

      console.log('🎉 Successfully updated custom sections');

      // Update original sections state to match current state
      setOriginalSections(JSON.parse(JSON.stringify(sections)));
      setHasUnsavedChanges(false);

      // Refresh sections from database to get the latest state
      setTimeout(async () => {
        try {
          await fetchSections();
        } catch (error) {
          console.error('Error refreshing sections:', error);
        }
      }, 500);

      alert('تم حفظ التغييرات بنجاح!');

    } catch (error) {
      console.error('❌ Error saving changes:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      alert(`حدث خطأ أثناء حفظ التغييرات: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    if (!hasUnsavedChanges) return;

    if (confirm('هل أنت متأكد من إلغاء جميع التغييرات؟')) {
      setSections(JSON.parse(JSON.stringify(originalSections)));
      setHasUnsavedChanges(false);
      setIsDragMode(false);
    }
  };


  // Show loading state during hydration or while loading data
  if (!isClient || isProductsLoading || isSectionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#c0c0c0' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل صفحة تصميم المتجر...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col text-gray-800" style={{ backgroundColor: '#c0c0c0' }}>
      {/* Header - Fixed */}
      <header className="flex-shrink-0 border-b border-gray-700 py-1" style={{ backgroundColor: 'var(--primary-color)' }}>
        <div className="w-full px-6 flex items-center justify-between">
          {/* Right side - Title and Action buttons */}
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold text-white">تصميم المتجر</h1>

            {/* White separator line */}
            <div className="w-px h-8 bg-white/30 mx-3"></div>

            {/* Drag Mode Button */}
            <button
              onClick={toggleDragMode}
              className={`flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] ${isDragMode
                  ? 'hover:text-yellow-200'
                  : 'hover:text-gray-200'
                }`}
            >
              <svg
                className={`w-8 h-8 mb-2 transition-colors ${isDragMode
                    ? 'text-yellow-300 group-hover:text-yellow-200'
                    : 'text-white group-hover:text-gray-200'
                  }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              <span className={`text-sm font-bold text-center leading-tight transition-colors ${isDragMode
                  ? 'text-yellow-300 group-hover:text-yellow-200'
                  : 'text-white group-hover:text-gray-200'
                }`}>
                {isDragMode ? 'إلغاء تبديل' : 'تبديل المراكز'}
              </span>
            </button>

            <div className="w-px h-8 bg-white/30 mx-2"></div>

            {/* Add Section Button */}
            <button
              onClick={() => setIsAddSectionModalOpen(true)}
              className="flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] hover:bg-white/10"
            >
              <svg className="w-8 h-8 mb-2 text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-bold text-center leading-tight text-white transition-colors">
                إضافة قسم
              </span>
            </button>

            <div className="w-px h-8 bg-white/30 mx-1"></div>

            {/* Edit Section Button */}
            <button
              onClick={handleEditSection}
              disabled={!selectedSectionId}
              className={`flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] ${selectedSectionId
                  ? 'hover:bg-white/10 text-white'
                  : 'text-white/30 cursor-not-allowed'
                }`}
            >
              <svg className="w-8 h-8 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-bold text-center leading-tight transition-colors">
                تعديل قسم
              </span>
            </button>

            <div className="w-px h-8 bg-white/30 mx-1"></div>

            {/* Delete Section Button */}
            <button
              onClick={handleDeleteSection}
              disabled={!selectedSectionId}
              className={`flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] ${selectedSectionId
                  ? 'hover:bg-white/10 text-white'
                  : 'text-white/30 cursor-not-allowed'
                }`}
            >
              <svg className="w-8 h-8 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="text-sm font-bold text-center leading-tight transition-colors">
                حذف قسم
              </span>
            </button>

            {/* Save Order Button - appears when in drag mode */}
            {isDragMode && (
              <>
                <div className="w-px h-8 bg-white/30 mx-2"></div>
                <button
                  onClick={saveAllChanges}
                  disabled={isSaving}
                  className="flex flex-col items-center justify-center p-4 transition-colors group min-w-[100px] hover:text-green-200"
                >
                  <svg className="w-8 h-8 mb-2 text-green-300 group-hover:text-green-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-bold text-center leading-tight text-green-300 group-hover:text-green-200 transition-colors">
                    {isSaving ? 'جاري الحفظ' : 'حفظ الترتيب'}
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Center - Empty space */}
          <div></div>

          {/* Left side - Exit button */}
          <button
            onClick={() => router.back()}
            className="text-white hover:text-red-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Container - Flex */}
      <div className="flex-1 flex min-h-0">
        {/* Save Changes Bar - Fixed at Bottom */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-50 border-t-2 border-amber-200 px-6 py-3" style={{ marginRight: '320px' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-amber-800 font-semibold">
                  لديك تغييرات غير محفوظة
                </span>
                <span className="text-sm text-amber-600">
                  احفظ التغييرات لتطبيقها على المتجر
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={discardChanges}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isSaving}
                >
                  إلغاء التغييرات
                </button>
                <button
                  onClick={saveAllChanges}
                  disabled={isSaving}
                  className="px-6 py-2 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: 'var(--primary-color)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSaving) (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSaving) (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                  }}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      حفظ جميع التغييرات
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar - Fixed */}
        <div className="flex-shrink-0 w-80 bg-white border-l border-gray-300 flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">لوحة التحكم</h2>

              <div className="space-y-3">
                <button
                  onClick={() => setIsAddSectionModalOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3 text-right rounded-lg transition-colors bg-red-100 border-2 border-red-300"
                >
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="font-medium text-red-600">إضافة قسم جديد</span>
                </button>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">
                    <p className="font-semibold mb-1">عدد الأقسام:</p>
                    <p className="text-2xl font-bold text-gray-800">{sections.length}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">
                    <p className="font-semibold mb-1">الأقسام النشطة:</p>
                    <p className="text-2xl font-bold text-green-600">{sections.filter(s => !s.isHidden).length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sections Content - Scrollable Main Area */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
            {/* Custom Sections Management Grid with Drag & Drop */}
            <DragDropProvider>
              <CustomSectionManagementGrid
                sections={sections}
                isDragMode={isDragMode}
                onReorder={handleSectionReorder}
                onToggleVisibility={toggleSectionVisibility}
                selectedSectionId={selectedSectionId}
                onSectionSelect={handleSectionSelect}
              />
            </DragDropProvider>
          </div>
        </main>
      </div>

      {/* Add Custom Section Modal */}
      <AddCustomSectionModal
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        products={databaseProducts || []}
        onSectionCreated={() => {
          fetchSections();
          fetchProducts();
        }}
      />

      {/* Edit Custom Section Modal */}
      <AddCustomSectionModal
        isOpen={isEditSectionModalOpen}
        onClose={() => {
          setIsEditSectionModalOpen(false);
          setEditingSection(null);
        }}
        products={databaseProducts || []}
        editingSection={editingSection}
        onSectionCreated={() => {
          fetchSections();
          fetchProducts();
          setIsEditSectionModalOpen(false);
          setEditingSection(null);
          setSelectedSectionId(null);
        }}
      />
    </div>
  );
}
