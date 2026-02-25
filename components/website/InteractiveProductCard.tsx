'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Product, ProductColor, ProductShape, ProductSize } from './shared/types';
import { useCart } from '../../lib/contexts/CartContext';
import { useUserProfile } from '../../lib/hooks/useUserProfile';
import { useWebsiteCurrency } from '@/lib/hooks/useCurrency';
import { useRatingsDisplay } from '../../lib/hooks/useRatingSettings';
import { useStoreDisplaySettings } from '../../lib/hooks/useStoreDisplaySettings';
import { useProductVoting } from '@/app/lib/hooks/useProductVoting';
import { useFavorites } from '@/lib/contexts/FavoritesContext';
import ProductVoteModal from './ProductVoteModal';
import ShapeSelector from './ShapeSelector';
import { getTransformedImageUrl, getPresetForDevice } from '@/lib/utils/supabaseImageTransform';

interface InteractiveProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => Promise<void>;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  onProductClick?: (productId: string) => void;
  displaySettings?: {
    display_mode: 'show_all' | 'show_with_stock' | 'show_with_stock_and_vote';
  };
}

export default function InteractiveProductCard({
  product,
  onAddToCart,
  deviceType,
  onProductClick,
  displaySettings
}: InteractiveProductCardProps) {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedShape, setSelectedShape] = useState<ProductShape | null>(null);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Mobile-specific states
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState('');
  
  // Get cart functions for direct access
  const { addToCart: directAddToCart } = useCart();
  const websiteCurrency = useWebsiteCurrency();

  // Get user profile to check role
  const { profile } = useUserProfile();

  // Get rating settings
  const { showRatings } = useRatingsDisplay();

  // Get store display settings
  const { showQuantityInStore, showProductStarRating } = useStoreDisplaySettings();

  // Vote modal state
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [voteModalMode, setVoteModalMode] = useState<'vote' | 'stats'>('vote');

  // Get voting stats
  const { voteStats } = useProductVoting(String(product.id));

  // Check if product is out of stock
  const isOutOfStock = (product.totalQuantity || product.stock || 0) === 0;

  // Check if voting mode is active
  const isVotingMode = displaySettings?.display_mode === 'show_with_stock_and_vote';

  // Check if user has already voted
  const hasUserVoted = voteStats.userVote !== null;

  // Get favorites functions
  const { isFavorite, toggleFavorite } = useFavorites();
  const isProductFavorite = isFavorite(String(product.id));

  // Helper function to parse description safely
  const parseDescription = (desc: any): string => {
    if (!desc) return 'لا يوجد وصف متاح';

    // If it's already a string, check if it's a JSON string
    if (typeof desc === 'string') {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(desc);
        // If parsed successfully and has a text property, use it
        if (parsed && typeof parsed === 'object' && parsed.text) {
          return parsed.text;
        }
        // Otherwise return the original string
        return desc;
      } catch {
        // Not JSON, return as is
        return desc;
      }
    }

    // If it's an object with text property
    if (typeof desc === 'object' && desc.text) {
      return desc.text;
    }

    // If it's an object without text, stringify it (shouldn't happen but just in case)
    if (typeof desc === 'object') {
      return JSON.stringify(desc);
    }

    return String(desc);
  };

  // Get current product data based on selected size
  const getCurrentProductData = () => {
    if (selectedSize && selectedSize.product) {
      return {
        ...product,
        id: selectedSize.product.id,
        name: selectedSize.product.name,
        description: parseDescription(selectedSize.product.description || product.description),
        price: selectedSize.product.price,
        image: selectedSize.product.main_image_url || product.image,
        selectedSize: selectedSize
      };
    }
    return {
      ...product,
      description: parseDescription(product.description)
    };
  };

  const currentProduct = getCurrentProductData();

  // Create array of all available images (main image + additional images)
  const allImages = (() => {
    const images = [];

    // Add main image first
    if (currentProduct.image) {
      images.push(currentProduct.image);
    }

    // Add all additional images from the images array
    if (currentProduct.images && Array.isArray(currentProduct.images)) {
      const additionalImages = currentProduct.images.filter(img => img && img !== currentProduct.image);
      images.push(...additionalImages);
    }

    const finalImages = images.filter(Boolean) as string[];

    return finalImages;
  })();

  // Determine which price to display based on user role
  const getDisplayPrice = () => {
    if (profile?.role === 'جملة' && currentProduct.wholesale_price) {
      return currentProduct.wholesale_price;
    }
    return currentProduct.price;
  };

  // Get current display image - prioritize selected shape, then color images, then regular images
  const getCurrentDisplayImage = () => {
    // If a shape is selected and has an image, use it
    if (selectedShape && selectedShape.image_url) {
      return selectedShape.image_url;
    }

    if (selectedColor && selectedColor.image_url) {
      // If a color is selected and has images, create array with color image first, then regular images
      const colorImages = [selectedColor.image_url, ...allImages.filter(img => img !== selectedColor.image_url)];
      return colorImages[currentImageIndex] || selectedColor.image_url;
    }

    // Return the image at current index, fallback to first image or placeholder
    if (allImages.length > 0) {
      return allImages[currentImageIndex] || allImages[0];
    }

    return product.image || '/placeholder-product.svg';
  };

  // Handle mouse hover for desktop - change image based on mouse position
  const handleMouseMove = (e: React.MouseEvent) => {
    if (deviceType !== 'desktop') return;
    if (allImages.length <= 1) return;

    // If shape or color with image is selected, don't change images on hover
    if (selectedShape?.image_url || selectedColor?.image_url) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const segmentWidth = rect.width / allImages.length;
    const newIndex = Math.min(Math.floor(x / segmentWidth), allImages.length - 1);

    if (newIndex !== currentImageIndex) {
      setCurrentImageIndex(newIndex);
    }
  };

  const handleMouseLeave = () => {
    if (deviceType !== 'desktop') return;
    // If shape or color with image is selected, don't reset
    if (selectedShape?.image_url || selectedColor?.image_url) return;
    setCurrentImageIndex(0); // Reset to first image
  };

  // Handle touch/swipe events for tablets
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [hasMoved, setHasMoved] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setHasMoved(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    setHasMoved(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation(); // Prevent navigation to product page

    if (deviceType !== 'tablet') return;

    // Get available images array based on selected color
    const availableImages = selectedColor && selectedColor.image_url
      ? [selectedColor.image_url, ...allImages.filter(img => img !== selectedColor.image_url)]
      : allImages;

    if (availableImages.length <= 1) return;

    // Handle swipe if there was movement
    if (touchStart && touchEnd && hasMoved) {
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      if (isLeftSwipe) {
        // Swipe left - next image
        const nextIndex = (currentImageIndex + 1) % availableImages.length;
        setCurrentImageIndex(nextIndex);
        return;
      } else if (isRightSwipe) {
        // Swipe right - previous image
        const prevIndex = currentImageIndex === 0 ? availableImages.length - 1 : currentImageIndex - 1;
        setCurrentImageIndex(prevIndex);
        return;
      }
    }

    // Handle tap navigation if no swipe occurred - more responsive zones
    if (!hasMoved && touchStart) {
      const imageContainer = imageRef.current;
      if (!imageContainer) return;

      const rect = imageContainer.getBoundingClientRect();
      const tapX = touchStart;
      const containerLeft = rect.left;
      const containerWidth = rect.width;
      const relativeX = tapX - containerLeft;

      // Divide image into sections based on number of images for better UX
      const sectionWidth = containerWidth / availableImages.length;
      const tappedSection = Math.floor(relativeX / sectionWidth);
      const targetIndex = Math.max(0, Math.min(tappedSection, availableImages.length - 1));

      if (targetIndex !== currentImageIndex) {
        setCurrentImageIndex(targetIndex);
      }
    }
  };

  // Handle color selection with toggle functionality
  const handleColorSelect = (color: ProductColor, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to product page
    // Toggle color selection - if same color is clicked, deselect it
    if (selectedColor?.id === color.id) {
      setSelectedColor(null);
    } else {
      setSelectedColor(color);
    }
    setCurrentImageIndex(0); // Reset image index when color changes
  };

  // Handle shape selection with toggle functionality
  const handleShapeSelect = (shape: ProductShape, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to product page
    // Toggle shape selection - if same shape is clicked, deselect it
    if (selectedShape?.id === shape.id) {
      setSelectedShape(null);
    } else {
      setSelectedShape(shape);
    }
    setCurrentImageIndex(0); // Reset image index when shape changes
  };

  // Handle size selection with product data update
  const handleSizeSelect = (size: ProductSize, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to product page
    setSelectedSize(size);
    setCurrentImageIndex(0); // Reset image index when size changes
  };

  // Get responsive classes based on device type
  const getResponsiveClasses = () => {
    switch (deviceType) {
      case 'desktop':
        return {
          containerClass: 'bg-custom-gray rounded-lg p-4 hover:bg-gray-300 transition-colors border border-gray-300 shadow-md cursor-pointer group',
          imageClass: 'w-full h-72 object-cover rounded-lg',
          titleClass: 'font-semibold mb-2 text-gray-800 truncate transition-colors group-hover:text-[var(--primary-color)]'
        };
      case 'tablet':
        return {
          containerClass: 'bg-custom-gray rounded-lg p-4 hover:bg-gray-300 transition-colors border border-gray-300 shadow-md cursor-pointer group',
          imageClass: 'w-full h-64 object-cover rounded-lg',
          titleClass: 'font-semibold mb-2 text-gray-800 truncate transition-colors group-hover:text-[var(--primary-color)]'
        };
      case 'mobile':
        return {
          containerClass: 'bg-custom-gray rounded-lg p-3 hover:bg-gray-300 transition-colors border border-gray-300 shadow-md cursor-pointer group',
          imageClass: 'w-full h-40 object-cover rounded-lg',
          titleClass: 'font-semibold mb-2 text-sm text-gray-800 truncate transition-colors group-hover:text-[var(--primary-color)]'
        };
    }
  };

  const classes = getResponsiveClasses();

  return (
    <div
      className={`${classes.containerClass} flex flex-col`}
      data-device-type={deviceType}
      onClick={() => {
        if (onProductClick) {
          onProductClick(String(currentProduct.id));
        } else {
          router.push(`/product/${currentProduct.id}`);
        }
      }}
    >
      <div
        ref={imageRef}
        className="relative mb-4"
        onClick={(e) => {
          if (deviceType === 'tablet') {
            e.stopPropagation();
          }
        }}
        onMouseMove={deviceType === 'desktop' ? handleMouseMove : undefined}
        onMouseLeave={deviceType === 'desktop' ? handleMouseLeave : undefined}
        onTouchStart={deviceType === 'tablet' ? handleTouchStart : undefined}
        onTouchMove={deviceType === 'tablet' ? handleTouchMove : undefined}
        onTouchEnd={deviceType === 'tablet' ? handleTouchEnd : undefined}
      >
        <img
          src={getTransformedImageUrl(getCurrentDisplayImage(), getPresetForDevice(deviceType))}
          alt={product.name}
          loading="lazy"
          className={`${classes.imageClass} transition-opacity duration-200 ${isVotingMode && isOutOfStock ? 'opacity-50' : ''}`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== '/placeholder-product.svg') {
              target.src = '/placeholder-product.svg';
            }
          }}
        />
        {product.isOnSale && (
          <span className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
            -{product.discount}%
          </span>
        )}

        {/* Favorite Indicator - Only show if product is in favorites */}
        {isProductFavorite && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`${deviceType === 'mobile' ? 'w-7 h-7' : 'w-9 h-9'} flex items-center justify-center rounded-full bg-red-500 shadow-lg`}>
              <svg
                className={`${deviceType === 'mobile' ? 'w-4 h-4' : 'w-5 h-5'}`}
                fill="white"
                stroke="white"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
          </div>
        )}

      </div>
      
      <div className="flex flex-col">
        <h4 className={classes.titleClass}>{currentProduct.name}</h4>
        {/* Description with dynamic height based on colors, shapes and sizes availability */}
        <div
          className="mb-1"
          style={{
            minHeight: (product.colors && product.colors.length > 0) || (product.shapes && product.shapes.length > 0) || (product.sizes && product.sizes.length > 0)
              ? (deviceType === 'tablet' ? '4.2rem' : '3.6rem')
              : (deviceType === 'tablet' ? '4.5rem' : '4rem')
          }}
        >
          <div
            className="text-sm text-gray-600"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: (product.colors && product.colors.length > 0) || (product.shapes && product.shapes.length > 0) || (product.sizes && product.sizes.length > 0) ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '1.4rem',
              maxHeight: (product.colors && product.colors.length > 0) || (product.shapes && product.shapes.length > 0) || (product.sizes && product.sizes.length > 0) ? '2.8rem' : '4.2rem',
              wordWrap: 'break-word'
            }}
          >
            {currentProduct.description}
          </div>
        </div>
        
        {/* Color Options - Horizontal Scroll for colors */}
        {product.colors && product.colors.length > 0 ? (
          <div className={`${deviceType === 'tablet' ? 'h-10' : 'h-8'} mb-1 flex items-center`}>
            <div className={`flex overflow-x-auto scrollbar-hide ${deviceType === 'tablet' ? 'gap-2.5' : 'gap-2'} pb-1`}>
              {product.colors.map((color) => (
                <button
                  key={color.id}
                  onClick={(e) => handleColorSelect(color, e)}
                  className={`${
                    deviceType === 'tablet' ? 'w-7 h-7' : 'w-6 h-6'
                  } rounded-full border-2 transition-all duration-200 flex-shrink-0 ${
                    selectedColor?.id === color.id
                      ? 'border-gray-800 scale-110 shadow-md'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className={`${deviceType === 'tablet' ? 'h-3' : 'h-2'} mb-1`}></div>
        )}

        {/* Shape Options - Custom Dropdown with Image Support */}
        {product.shapes && product.shapes.length > 0 ? (
          <div className={`${deviceType === 'tablet' ? 'h-10' : 'h-9'} mb-1`}>
            <ShapeSelector
              shapes={product.shapes}
              selectedShape={selectedShape}
              onShapeSelect={(shape) => {
                setSelectedShape(shape);
                setCurrentImageIndex(0);
              }}
              deviceType={deviceType}
            />
          </div>
        ) : (
          <div className={`${deviceType === 'tablet' ? 'h-2' : 'h-1'} mb-1`}></div>
        )}

        {/* Size Options - Dropdown for sizes */}
        {product.sizes && product.sizes.length > 0 ? (
          <div className={`${deviceType === 'tablet' ? 'h-10' : 'h-9'} mb-1`}>
            <select
              value={selectedSize?.id || ''}
              onChange={(e) => {
                const sizeId = e.target.value;
                if (sizeId) {
                  const size = product.sizes?.find(s => s.id === sizeId);
                  if (size) {
                    handleSizeSelect(size, e as any);
                  }
                } else {
                  setSelectedSize(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm ${
                deviceType === 'tablet' ? 'py-2.5 text-base' : 'py-2'
              }`}
            >
              <option value="">اختر المقاس</option>
              {product.sizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={`${deviceType === 'tablet' ? 'h-2' : 'h-1'} mb-1`}></div>
        )}
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {currentProduct.originalPrice && (
                <span className="text-sm line-through text-gray-500">
                  {currentProduct.originalPrice} {websiteCurrency}
                </span>
              )}
              <span className="text-lg font-bold" style={{color: 'var(--primary-color)'}}>
                {getDisplayPrice()} {websiteCurrency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {profile?.role === 'جملة' && currentProduct.wholesale_price && (
                <span className="text-xs text-blue-600 font-medium">سعر الجملة</span>
              )}
              {/* Static stock - updated every 60 seconds via ISR - only show if enabled in settings */}
              {showQuantityInStore && (product.totalQuantity !== undefined || product.stock !== undefined) && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  (product.totalQuantity || product.stock || 0) > 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  الكمية: {product.totalQuantity || product.stock || 0}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Ratings Section - Only show if enabled in both global ratings setting and store display setting */}
        {showRatings && showProductStarRating && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">⭐</span>
              <span className="text-sm text-gray-400">
                {product.rating} ({product.reviews})
              </span>
            </div>
          </div>
        )}

      </div>
      
      {/* Desktop/Tablet Button */}
      {deviceType !== 'mobile' && (
        <>
          {isVotingMode && isOutOfStock ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasUserVoted) {
                  setVoteModalMode('stats');
                } else {
                  setVoteModalMode('vote');
                }
                setIsVoteModalOpen(true);
              }}
              className={`w-full mt-3 rounded-lg font-medium transition-colors text-white px-4 py-2 text-sm ${
                hasUserVoted
                  ? 'bg-gray-600 hover:bg-gray-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {hasUserVoted ? 'عرض الإحصائيات 📊' : 'صوت 🗳️'}
            </button>
          ) : (
            <div className="flex gap-2 mt-3">
              {/* Add to Cart Button */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const productToAdd = {
                    ...currentProduct,
                    selectedColor: selectedColor || (product.colors && product.colors.length > 0 ? product.colors[0] : null),
                    selectedShape: selectedShape || (product.shapes && product.shapes.length > 0 ? product.shapes[0] : null),
                    selectedSize: selectedSize,
                    note: note || undefined, // Include note if available
                    price: getDisplayPrice() // Use the display price based on user role
                  };
                  await onAddToCart(productToAdd);
                }}
                className={`flex-1 rounded-lg font-medium transition-colors text-white px-4 py-2 text-sm`}
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                إضافة
              </button>

              {/* Note Button for Desktop/Tablet */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowNoteModal(true);
                }}
                className="w-10 h-10 rounded-lg font-medium transition-colors flex items-center justify-center"
                style={{backgroundColor: '#D1D5DB', color: '#374151'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#9CA3AF';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#D1D5DB';
                }}
                title="إضافة ملاحظة"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Mobile Buttons */}
      {deviceType === 'mobile' && (
        <div className="flex gap-1 mt-3">
          {isVotingMode && isOutOfStock ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasUserVoted) {
                  setVoteModalMode('stats');
                } else {
                  setVoteModalMode('vote');
                }
                setIsVoteModalOpen(true);
              }}
              className={`w-full rounded-lg font-medium transition-colors text-white p-1.5 text-xs ${
                hasUserVoted
                  ? 'bg-gray-600 hover:bg-gray-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {hasUserVoted ? 'عرض الإحصائيات 📊' : 'صوت 🗳️'}
            </button>
          ) : (
            <>
              {/* Add Button (80% width) */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const productToAdd = {
                    ...currentProduct,
                    selectedColor: selectedColor || (product.colors && product.colors.length > 0 ? product.colors[0] : null),
                    selectedShape: selectedShape || (product.shapes && product.shapes.length > 0 ? product.shapes[0] : null),
                    selectedSize: selectedSize,
                    note: note || undefined, // Include note if available
                    price: getDisplayPrice() // Use the display price based on user role
                  };
                  await onAddToCart(productToAdd);
                }}
                className="flex-[4] rounded-lg font-medium transition-colors text-white p-1.5 text-xs"
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                إضافة
              </button>

              {/* Note Button (20% width) with gray color like in the image */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowNoteModal(true);
                }}
                className="flex-1 rounded-lg font-medium transition-colors p-1.5"
                style={{backgroundColor: '#D1D5DB', color: '#374151'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#9CA3AF';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = '#D1D5DB';
                }}
                title="إضافة ملاحظة"
              >
                <svg className="w-3 h-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
      {/* Note Modal */}
      {showNoteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.target === e.currentTarget) {
              setShowNoteModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <h3 className="text-lg font-bold text-center mb-4 text-gray-800">إضافة ملاحظة</h3>

            {/* Favorite Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleFavorite(String(product.id));
              }}
              className={`w-full flex items-center justify-center gap-2 p-3 mb-4 rounded-lg border-2 transition-all duration-200 ${
                isProductFavorite
                  ? 'bg-red-50 border-red-500 text-red-600'
                  : 'bg-gray-50 border-gray-300 text-gray-600 hover:border-red-300 hover:bg-red-50'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill={isProductFavorite ? '#EF4444' : 'none'}
                stroke={isProductFavorite ? '#EF4444' : 'currentColor'}
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="font-medium">
                {isProductFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              </span>
            </button>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="أدخل ملاحظتك هنا..."
              className="w-full h-32 p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 resize-none text-right"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowNoteModal(false);
                }}
                className="flex-1 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  // Note is saved and will be included when adding to cart
                  console.log('Note saved:', note, 'for product:', product.name);
                  setShowNoteModal(false);
                  // Don't reset note - keep it so it can be added with the product
                }}
                className="flex-1 py-3 text-white rounded-lg font-medium transition-colors"
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Vote Modal */}
      <ProductVoteModal
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        product={currentProduct}
        mode={voteModalMode}
      />
    </div>
  );
}