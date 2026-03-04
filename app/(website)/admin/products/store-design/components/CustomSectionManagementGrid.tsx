'use client';

import { useState } from 'react';
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

interface CustomSection {
  id: string;
  name: string;
  description: string;
  isHidden: boolean;
  displayOrder: number;
  productCount: number;
}

interface CustomSectionManagementGridProps {
  sections: CustomSection[];
  isDragMode: boolean;
  onReorder: (reorderedSections: CustomSection[]) => void;
  onToggleVisibility: (sectionId: string) => void;
  selectedSectionId?: string | null;
  onSectionSelect?: (sectionId: string) => void;
}

interface SortableCustomSectionCardProps {
  section: CustomSection;
  index: number;
  onToggleVisibility: (sectionId: string) => void;
  isDragging?: boolean;
  isSelected?: boolean;
  onSectionSelect?: (sectionId: string) => void;
}

function SortableCustomSectionCard({ section, index, onToggleVisibility, isDragging = false, isSelected = false, onSectionSelect }: SortableCustomSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: section.id });

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
        bg-white rounded-lg p-3 md:p-4 border relative
        transition-all duration-200 cursor-move
        ${isSortableDragging || isDragging
          ? 'shadow-2xl rotate-3 scale-105 bg-white border-blue-400 z-50 opacity-90'
          : 'hover:shadow-md hover:scale-102'
        }
        ${isSortableDragging ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
      `}
      onClick={() => onSectionSelect?.(section.id)}
    >
      {/* Section Icon */}
      <div className="mb-4 flex items-center justify-center">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}>
          <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      </div>

      {/* Section Name */}
      <h3 className="text-lg font-semibold text-gray-800 text-center mb-2 truncate" title={section.name}>
        {section.name}
      </h3>

      {/* Section Description */}
      {section.description && (
        <p className="text-sm text-gray-600 text-center mb-3 line-clamp-2" title={section.description}>
          {section.description}
        </p>
      )}

      {/* Product Count */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="text-sm text-gray-600">
          {section.productCount} منتج
        </span>
      </div>

      {/* Visibility Toggle - Centered */}
      <div className="flex justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(section.id);
          }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${section.isHidden
              ? 'bg-gray-300 hover:bg-gray-400'
              : 'bg-green-500 hover:bg-green-600'
            }`}
          title={section.isHidden ? 'مخفي من المتجر' : 'ظاهر في المتجر'}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${section.isHidden ? 'translate-x-1' : 'translate-x-5'
              }`}
          />
        </button>
      </div>

      {/* Status Indicator - Top Right Corner */}
      <div className="absolute top-2 right-2">
        {section.isHidden ? (
          <div
            className="w-4 h-4 rounded-full bg-gray-400 animate-pulse"
            title="مخفي"
          />
        ) : (
          <div
            className="w-4 h-4 rounded-full bg-green-500 animate-pulse"
            title="نشط"
          />
        )}
      </div>

      {/* Display Order Badge - Top Left Corner */}
      <div className="absolute top-2 left-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {index + 1}
      </div>
    </div>
  );
}

export default function CustomSectionManagementGrid({
  sections,
  isDragMode,
  onReorder,
  onToggleVisibility,
  selectedSectionId,
  onSectionSelect
}: CustomSectionManagementGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
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

  const handleDragStart = (event: DragStartEvent) => {
    if (!isDragMode) return;
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isDragMode) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((section) => section.id === active.id);
      const newIndex = sections.findIndex((section) => section.id === over.id);

      const newSections = arrayMove(sections, oldIndex, newIndex);
      onReorder(newSections);
    }

    setActiveId(null);
  };

  const activeSectionItem = sections.find((section) => section.id === activeId);

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full p-4 mb-4" style={{ backgroundColor: 'rgba(93, 31, 31, 0.1)' }}>
          <svg className="w-16 h-16" style={{ color: 'var(--primary-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد أقسام مخصصة</h3>
        <p className="text-gray-500 mb-4">ابدأ بإنشاء أقسام مخصصة لتنظيم منتجات متجرك</p>
        <p className="text-sm text-gray-400">💡 يمكنك إنشاء أقسام مثل &quot;منتجات تيك توك&quot; أو &quot;المنتجات الجديدة&quot;</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((section) => section.id)}
        strategy={rectSortingStrategy}
        disabled={!isDragMode}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sections.map((section, index) => (
            <SortableCustomSectionCard
              key={section.id}
              section={section}
              index={index}
              onToggleVisibility={onToggleVisibility}
              isSelected={selectedSectionId === section.id}
              onSectionSelect={onSectionSelect}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId && activeSectionItem ? (
          <div className="bg-white rounded-lg p-3 md:p-4 border border-blue-400 shadow-2xl opacity-90 rotate-3 scale-105">
            <div className="mb-4 flex items-center justify-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary-color)' }}>
                <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 text-center truncate">
              {activeSectionItem.name}
            </h3>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
