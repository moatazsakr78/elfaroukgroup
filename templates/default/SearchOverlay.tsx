'use client';

import { useState, useEffect, useRef } from 'react';
import { Product } from '@/components/website/shared/types';
import { useWebsiteCurrency } from '@/lib/hooks/useCurrency';
import { getTransformedImageUrl } from '@/lib/utils/supabaseImageTransform';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProductSelect?: (product: Product) => void;
}

export default function SearchOverlay({
  isOpen,
  onClose,
  products,
  searchQuery,
  onSearchChange,
  onProductSelect
}: SearchOverlayProps) {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const websiteCurrency = useWebsiteCurrency();
  const [headerHeight, setHeaderHeight] = useState(75);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Since header is now fixed, we can use a constant height
  useEffect(() => {
    // The header is now fixed at top: 0, so we use its height directly
    setHeaderHeight(75); // 75px is the header height (min-h-[75px])
  }, [isOpen]);

  // Filter products based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts([]);
      return;
    }

    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    setFilteredProducts(filtered.slice(0, 8)); // Limit to 8 results
  }, [searchQuery, products]);

  // Auto-focus search input when overlay opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent scrolling
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Search Overlay */}
      <div 
        className="fixed left-0 right-0 bg-white border-b border-gray-300 shadow-2xl"
        style={{
          zIndex: 9999,
          top: `${headerHeight}px`, // Position directly below the red header bar
          transform: isOpen ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        <div className="max-w-4xl mx-auto p-6">
          {/* Search Input */}
          <div className="relative mb-6">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن المنتجات..."
              className="w-full px-6 py-4 pr-14 text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500 transition-colors text-right bg-gray-50"
              style={{
                fontFamily: 'Cairo, sans-serif'
              }}
            />
            <svg 
              className="absolute right-5 top-1/2 transform -translate-y-1/2 w-6 h-6 text-gray-400"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 text-gray-500 hover:text-red-600 transition-colors"
              title="إغلاق"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Results */}
          {searchQuery.trim() && (
            <div className="max-h-96 overflow-y-auto scrollbar-hide">
              {filteredProducts.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4 text-right">
                    {filteredProducts.length} نتيجة بحث
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          onProductSelect?.(product);
                          onClose();
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
                      >
                        {/* Product Image */}
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {product.image ? (
                            <img
                              src={getTransformedImageUrl(product.image, 'search_thumb')}
                              alt={product.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0 text-right">
                          <h3 className="font-semibold text-gray-900 truncate text-sm">
                            {product.name}
                          </h3>
                          <p className="text-xs text-gray-600 mb-1">
                            {product.category}
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-red-600 font-bold text-sm">
                              {product.price} {websiteCurrency}
                            </span>
                            {product.originalPrice && (
                              <span className="text-gray-400 line-through text-xs">
                                {product.originalPrice} {websiteCurrency}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600 mb-2">لا توجد نتائج</h3>
                  <p className="text-gray-500">جرب كلمات بحث مختلفة</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!searchQuery.trim() && (
            <div className="text-center py-8">
              <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">ابحث عن المنتجات</h3>
              <p className="text-gray-500">اكتب اسم المنتج أو الفئة للبحث</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}