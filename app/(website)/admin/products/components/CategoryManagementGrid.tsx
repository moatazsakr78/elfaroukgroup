'use client';

import { useState } from 'react';

// Component to handle category images with proper error handling
function CategoryImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [imageError, setImageError] = useState(false);

  if (!src || imageError) {
    return (
      <div className={className + " bg-gray-200 flex items-center justify-center"}>
        <div className="text-center text-gray-500">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs">{!src ? 'لا توجد صورة' : 'صورة معطلة'}</span>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className + " bg-gray-200"}
      onError={() => setImageError(true)}
    />
  );
}
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  isHidden: boolean;
  displayOrder: number;
  color: string;
}

interface CategoryManagementGridProps {
  categories: Category[];
  isDragMode: boolean;
  onReorder: (reorderedCategories: Category[]) => void;
  onToggleVisibility: (categoryId: string) => void;
  selectedCategoryId?: string | null;
  onCategorySelect?: (categoryId: string) => void;
}

interface SortableCategoryCardProps {
  category: Category;
  index: number;
  onToggleVisibility: (categoryId: string) => void;
  isDragging?: boolean;
  isSelected?: boolean;
  onCategorySelect?: (categoryId: string) => void;
}

function SortableCategoryCard({ category, index, onToggleVisibility, isDragging = false, isSelected = false, onCategorySelect }: SortableCategoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white rounded-lg p-3 border relative
        transition-all duration-200 cursor-move
        ${isSortableDragging || isDragging
          ? 'shadow-2xl rotate-3 scale-105 bg-white border-blue-400 z-50 opacity-90'
          : 'hover:shadow-md hover:scale-102'
        }
        ${isSortableDragging ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
      `}
      onClick={() => onCategorySelect?.(category.id)}
    >
      {/* Category Image */}
      <div className="mb-3">
        <CategoryImage
          src={category.image}
          alt={category.name}
          className="w-full h-48 object-cover rounded-lg"
        />
      </div>

      {/* Category Name */}
      <h3 className="text-sm font-semibold text-gray-800 text-center mb-3 truncate" title={category.name}>
        {category.name}
      </h3>

      {/* Visibility Toggle - Centered */}
      <div className="flex justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(category.id);
          }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            category.isHidden
              ? 'bg-gray-300 hover:bg-gray-400'
              : 'bg-green-500 hover:bg-green-600'
          }`}
          title={category.isHidden ? 'مخفي من المتجر' : 'ظاهر في المتجر'}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              category.isHidden ? 'translate-x-1' : 'translate-x-5'
            }`}
          />
        </button>
      </div>

      {/* Status Indicator - Top Right Corner */}
      <div className="absolute top-2 right-2">
        <span className={`inline-block w-3 h-3 rounded-full ${
          category.isHidden ? 'bg-red-400' : 'bg-green-400'
        }`} title={category.isHidden ? 'مخفي' : 'ظاهر'}></span>
      </div>

      {/* Drag Handle - Top Left Corner */}
      <div className="absolute top-2 left-2 text-gray-400 hover:text-gray-600 transition-colors cursor-move">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </div>

      {/* Drag Visual Feedback */}
      {(isSortableDragging || isDragging) && (
        <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-pulse">
          يتم السحب...
        </div>
      )}
    </div>
  );
}

function CategoryCard({ category, index, onToggleVisibility, isSelected = false, onCategorySelect }: {
  category: Category;
  index: number;
  onToggleVisibility: (categoryId: string) => void;
  isSelected?: boolean;
  onCategorySelect?: (categoryId: string) => void;
}) {
  return (
    <div
      className={`bg-white rounded-lg p-3 border hover:shadow-md transition-all duration-200 relative cursor-pointer ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
      onClick={() => onCategorySelect?.(category.id)}
    >
      {/* Category Image */}
      <div className="mb-3">
        <CategoryImage
          src={category.image}
          alt={category.name}
          className="w-full h-48 object-cover rounded-lg"
        />
      </div>

      {/* Category Name */}
      <h3 className="text-sm font-semibold text-gray-800 text-center mb-3 truncate" title={category.name}>
        {category.name}
      </h3>

      {/* Visibility Toggle - Centered */}
      <div className="flex justify-center">
        <button
          onClick={() => onToggleVisibility(category.id)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            category.isHidden
              ? 'bg-gray-300 hover:bg-gray-400'
              : 'bg-green-500 hover:bg-green-600'
          }`}
          title={category.isHidden ? 'مخفي من المتجر' : 'ظاهر في المتجر'}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              category.isHidden ? 'translate-x-1' : 'translate-x-5'
            }`}
          />
        </button>
      </div>

      {/* Status Indicator - Top Right Corner */}
      <div className="absolute top-2 right-2">
        <span className={`inline-block w-3 h-3 rounded-full ${
          category.isHidden ? 'bg-red-400' : 'bg-green-400'
        }`} title={category.isHidden ? 'مخفي' : 'ظاهر'}></span>
      </div>
    </div>
  );
}

export default function CategoryManagementGrid({
  categories,
  isDragMode,
  onReorder,
  onToggleVisibility,
  selectedCategoryId,
  onCategorySelect
}: CategoryManagementGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = categories.findIndex((category) => category.id === active.id);
      const newIndex = categories.findIndex((category) => category.id === over?.id);
      
      const reorderedCategories = arrayMove(categories, oldIndex, newIndex);
      
      // Update display order
      const updatedCategories = reorderedCategories.map((category, index) => ({
        ...category,
        displayOrder: index
      }));
      
      onReorder(updatedCategories);
    }

    setActiveId(null);
  }

  const categoryIds = categories.map(category => category.id);
  const draggedCategory = activeId ? categories.find(category => category.id === activeId) : null;

  if (isDragMode) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-sm">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={categoryIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
              {categories.map((category, index) => (
                <SortableCategoryCard
                  key={category.id}
                  category={category}
                  index={index}
                  onToggleVisibility={onToggleVisibility}
                  isSelected={selectedCategoryId === category.id}
                  onCategorySelect={onCategorySelect}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {draggedCategory ? (
              <SortableCategoryCard
                category={draggedCategory}
                index={categories.findIndex(c => c.id === draggedCategory.id)}
                onToggleVisibility={onToggleVisibility}
                isDragging
                isSelected={selectedCategoryId === draggedCategory.id}
                onCategorySelect={onCategorySelect}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        
        {/* Empty State */}
        {categories.length === 0 && (
          <div className="text-center py-12 col-span-full">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-gray-500 text-lg">لا توجد فئات متاحة</p>
            <p className="text-gray-400 text-sm mt-1">سيتم تحميل الفئات من قاعدة البيانات</p>
          </div>
        )}

        {/* Drag Instructions */}
        {categories.length > 0 && (
          <div className="bg-blue-50 border-t border-blue-200 p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">اسحب الفئات لإعادة ترتيبها، ثم احفظ التغييرات</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Normal (non-drag) mode
  return (
    <div className="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
        {categories.map((category, index) => (
          <CategoryCard
            key={category.id}
            category={category}
            index={index}
            onToggleVisibility={onToggleVisibility}
            isSelected={selectedCategoryId === category.id}
            onCategorySelect={onCategorySelect}
          />
        ))}
      </div>
      
      {/* Empty State for search results */}
      {categories.length === 0 && (
        <div className="text-center py-12 col-span-full">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-500 text-lg">لا توجد فئات تطابق البحث</p>
          <p className="text-gray-400 text-sm mt-1">جرب كلمات بحث أخرى</p>
        </div>
      )}
    </div>
  );
}