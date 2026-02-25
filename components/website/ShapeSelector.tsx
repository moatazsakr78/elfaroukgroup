'use client';

import { useState, useRef, useEffect } from 'react';
import { ProductShape } from './shared/types';
import { getTransformedImageUrl } from '@/lib/utils/supabaseImageTransform';

interface ShapeSelectorProps {
  shapes: ProductShape[];
  selectedShape: ProductShape | null;
  onShapeSelect: (shape: ProductShape | null) => void;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

export default function ShapeSelector({
  shapes,
  selectedShape,
  onShapeSelect,
  deviceType
}: ShapeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Helper function to check if shape has a real name
  const hasShapeName = (shape: ProductShape): boolean => {
    return !!(shape.name && shape.name.trim());
  };

  // Get display name for shape
  const getShapeDisplayName = (shape: ProductShape): string => {
    return hasShapeName(shape) ? shape.name! : 'شكل';
  };

  // Get display content for selected shape
  const getSelectedDisplay = () => {
    if (!selectedShape) {
      return <span className="text-gray-500">اختر الشكل</span>;
    }

    return (
      <div className="flex items-center gap-2">
        {selectedShape.image_url && (
          <img
            src={getTransformedImageUrl(selectedShape.image_url, 'detail_shape')}
            alt={getShapeDisplayName(selectedShape)}
            className="w-6 h-6 object-cover rounded border border-gray-300"
          />
        )}
        <span className="text-gray-700 truncate">
          {getShapeDisplayName(selectedShape)}
        </span>
      </div>
    );
  };

  // Handle shape selection
  const handleSelect = (shape: ProductShape | null, e: React.MouseEvent) => {
    e.stopPropagation();
    onShapeSelect(shape);
    setIsOpen(false);
  };

  const buttonHeight = deviceType === 'tablet' ? 'h-10' : 'h-9';
  const imageSize = deviceType === 'tablet' ? 'w-8 h-8' : 'w-7 h-7';
  const textSize = deviceType === 'tablet' ? 'text-base' : 'text-sm';

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-full ${buttonHeight} bg-white border border-gray-300 rounded-md px-3 ${textSize} text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm flex items-center justify-between ${
          deviceType === 'tablet' ? 'py-2.5' : 'py-2'
        }`}
      >
        {getSelectedDisplay()}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Clear Selection Option */}
          <button
            onClick={(e) => handleSelect(null, e)}
            className={`w-full px-3 py-2 ${textSize} text-right text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-end border-b border-gray-200`}
          >
            بدون شكل
          </button>

          {/* Shape Options */}
          {shapes.map((shape) => {
            const displayName = getShapeDisplayName(shape);
            const hasName = hasShapeName(shape);
            const hasImage = !!shape.image_url;

            return (
              <button
                key={shape.id}
                onClick={(e) => handleSelect(shape, e)}
                className={`w-full px-3 py-2.5 ${textSize} text-right hover:bg-gray-100 transition-colors flex items-center justify-end gap-3 ${
                  selectedShape?.id === shape.id ? 'bg-blue-50' : ''
                }`}
              >
                {/* Text - Show name if exists, otherwise show "شكل" if there's an image */}
                {hasName && (
                  <span className="truncate flex-1 text-right text-gray-700">
                    {displayName}
                  </span>
                )}
                {!hasName && hasImage && (
                  <span className="truncate flex-1 text-right text-gray-500 italic text-xs">
                    {displayName}
                  </span>
                )}

                {/* Image - Always show if available */}
                {hasImage && (
                  <img
                    src={getTransformedImageUrl(shape.image_url, 'detail_shape')}
                    alt={displayName}
                    className={`${imageSize} object-cover rounded border border-gray-300 flex-shrink-0`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
