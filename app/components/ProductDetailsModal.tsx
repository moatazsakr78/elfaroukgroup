'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { Product, ProductColor } from '../../components/website/shared/types';
import { supabase } from '../lib/supabase/client';
import { useFormatPrice } from '@/lib/hooks/useCurrency';
import { useRatingsDisplay } from '../../lib/hooks/useRatingSettings';
import { useCart } from '../../lib/contexts/CartContext';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import CartModal from './CartModal';

interface DatabaseProduct {
  id: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  category_id?: string | null;
  video_url?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  product_code?: string | null;
  wholesale_price?: number | null;
  price1?: number | null;
  price2?: number | null;
  price3?: number | null;
  price4?: number | null;
  main_image_url?: string | null;
  sub_image_url?: string | null;
  additional_images_urls?: string[] | null; // ✨ الحقل الجديد للصور الإضافية
  barcodes?: string[] | null;
  unit?: string | null;
  stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  location?: string | null;
  status?: string | null;
  warehouse?: string | null;
  branch?: string | null;
  tax_price?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  discount_start_date?: string | null;
  discount_end_date?: string | null;
  is_hidden?: boolean | null;
  is_featured?: boolean | null;
  display_order?: number | null;
  suggested_products?: string[] | null;
  category?: {
    id: string;
    name: string;
    name_en?: string | null;
  } | null;
}

interface ProductDetail extends Omit<Product, 'sizes'> {
  gallery: string[];
  specifications: { [key: string]: string };
  shapes: { id: string; name: string; image_url?: string; available: boolean }[];
  sizes: {
    id: string;
    name: string;
    price?: number;
    product_id?: string;
    available: boolean;
    type: 'variant' | 'related_product';
    image_url?: string;
    product_name?: string;
  }[];
  detailedDescription: string;
}

// Function to get sub-images for a product from database or fallback
const getProductSubImages = async (
  productId: string,
  productName: string = '',
  videoUrl: string | null = null,
  additionalImagesUrls: any = null // ✨ معامل جديد
): Promise<string[]> => {
  try {
    console.log('🚀 getProductSubImages CALLED for:', productName);
    console.log('   - productId:', productId);
    console.log('   - videoUrl:', videoUrl);
    console.log('   - additionalImagesUrls:', additionalImagesUrls);

    // ✨ HIGHEST PRIORITY: Check additional_images_urls (new field)
    if (additionalImagesUrls && Array.isArray(additionalImagesUrls) && additionalImagesUrls.length > 0) {
      console.log(`✅ Modal: Loaded ${additionalImagesUrls.length} images from additional_images_urls for ${productName}`);
      return additionalImagesUrls;
    }

    // Second priority: Check if sub-images are stored in video_url field (old system)
    if (videoUrl) {
      try {
        const additionalImages = JSON.parse(videoUrl);
        if (Array.isArray(additionalImages) && additionalImages.length > 0) {
          console.log(`✅ Modal: Loaded ${additionalImages.length} images from video_url for ${productName}`);
          return additionalImages;
        }
      } catch (parseError) {
        // video_url is not JSON, it's a video link
      }
    }

    // Third priority: Check product_images table
    const { data: productImages, error } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_id', productId)
      .order('sort_order');

    if (!error && productImages && productImages.length > 0) {
      console.log(`✅ Modal: Loaded ${productImages.length} images from product_images table for ${productName}`);
      return productImages.map(img => img.image_url);
    }

    // Fourth priority: Use fallback system (generates placeholder images)
    console.log(`⚠️ Modal: No images found, using fallback for product ${productName}`);
    return getProductSubImagesFallback(productId, productName);
  } catch (err) {
    console.error('Error fetching product images:', err);
    return getProductSubImagesFallback(productId, productName);
  }
};

// Product-specific sub-images mapping
const getProductSpecificSubImages = (productId: string, productName: string): string[] | null => {
  // This function can be customized to assign specific sub-images to specific products
  // You can map by product ID, name, or any other criteria
  
  const productMappings: Record<string, string[]> = {
    // Example mappings - you can customize these
    '3f2d97c6-c4b7-491d-8ee3-55f03dbf13c9': ['/sub-images/1.png', '/sub-images/2.png', '/sub-images/3.png', '/sub-images/4.png'],
    '769bff92-57eb-45bd-bb59-6cef56a2fba0': ['/sub-images/5.png', '/sub-images/6.png', '/sub-images/7.png', '/sub-images/8.png'],
    '5c0b1b90-2e6d-425f-972d-aafae451f4e2': ['/sub-images/9.png', '/sub-images/10.png', '/sub-images/11.png', '/sub-images/12.png'],
  };

  // Check if we have a specific mapping for this product ID
  if (productMappings[productId]) {
    return productMappings[productId];
  }

  // Map by product name patterns - more comprehensive coverage
  if (productName.includes('زجاجه') || productName.includes('لابوبو')) {
    return ['/sub-images/13.png', '/sub-images/14.png', '/sub-images/15.png', '/sub-images/16.png'];
  }
  
  if (productName.includes('دابل فيس')) {
    return ['/sub-images/17.png', '/sub-images/18.png', '/sub-images/19.png', '/sub-images/20.png'];
  }

  if (productName.includes('باسكت') || productName.includes('ألعاب')) {
    return ['/sub-images/21.png', '/sub-images/22.png', '/sub-images/23.png', '/sub-images/24.png'];
  }

  // Additional pattern mappings for common product types
  if (productName.includes('ورق') || productName.includes('زبده')) {
    return ['/sub-images/25.png', '/sub-images/1.png', '/sub-images/2.png', '/sub-images/3.png'];
  }

  if (productName.includes('فاست') || productName.includes('بوش')) {
    return ['/sub-images/4.png', '/sub-images/5.png', '/sub-images/6.png', '/sub-images/7.png'];
  }

  if (productName.includes('طقم') || productName.includes('حمام')) {
    return ['/sub-images/8.png', '/sub-images/9.png', '/sub-images/10.png', '/sub-images/11.png'];
  }

  if (productName.includes('مج') || productName.includes('تاج')) {
    return ['/sub-images/12.png', '/sub-images/13.png', '/sub-images/14.png', '/sub-images/15.png'];
  }

  return null; // Will fall back to deterministic assignment
};

// Fallback system for assigning sub-images to products
const getProductSubImagesFallback = (productId: string, productName: string = ''): string[] => {
  // First try to get product-specific sub-images
  const specificImages = getProductSpecificSubImages(productId, productName);
  if (specificImages) {
    return specificImages;
  }

  // ALWAYS provide sub-images using deterministic assignment for ANY product
  const images: string[] = [];
  const totalSubImages = 27; // We now have 27 sub-images (1-27)
  
  // Create a more robust hash from the product ID
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    const char = productId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Ensure positive number and get starting index
  const startIndex = Math.abs(hash) % totalSubImages;
  
  // Always return exactly 5 different sub-images for every product
  for (let i = 0; i < 5; i++) {
    const imageNumber = ((startIndex + i) % totalSubImages) + 1;
    images.push(`/sub-images/${imageNumber}.png`);
  }

  return images;
};

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

export default function ProductDetailsModal({
  isOpen,
  onClose,
  productId
}: ProductDetailsModalProps) {
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const { logoUrl, companyName } = useCompanySettings();
  const { showRatings } = useRatingsDisplay();
  const { cartItems, addToCart } = useCart();
  const [productDetails, setProductDetails] = useState<ProductDetail | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [suggestedProductsList, setSuggestedProductsList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // No longer using useOptimisticCart - using useCart from CartContext

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [currentGallery, setCurrentGallery] = useState<string[]>([]);
  const [selectedShape, setSelectedShape] = useState<{ id: string; name: string; image_url?: string; available: boolean } | null>(null);
  const [selectedSize, setSelectedSize] = useState<{
    id: string;
    name: string;
    price?: number;
    product_id?: string;
    available: boolean;
    type: 'variant' | 'related_product';
    image_url?: string;
    product_name?: string;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [currentSuggestedIndex, setCurrentSuggestedIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [productVideos, setProductVideos] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentProductName, setCurrentProductName] = useState<string>('');

  // Save scroll position to restore when modal closes
  const [savedScrollPosition, setSavedScrollPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Detect device type for responsive design
  const [isMobile, setIsMobile] = useState(false);

  // Device detection effect - Include tablet in mobile design
  useEffect(() => {
    const checkDevice = () => {
      // Changed from 768 to 1024 to include tablets in mobile design
      const isMobileDevice = window.innerWidth < 1024;
      setIsMobile(isMobileDevice);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Prevent body scroll when modal is open and change theme color
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position to sessionStorage for mobile reliability
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft || window.scrollX || 0;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;

      // Save to both state and sessionStorage
      setSavedScrollPosition({ x: scrollX, y: scrollY });
      sessionStorage.setItem('modalScrollPosition', JSON.stringify({ x: scrollX, y: scrollY }));

      // Simple and reliable scroll lock for all devices
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;

      // Change theme color for product details modal to blue like cart
      const blueColor = '#3B82F6'; // Blue color to match cart modal

      // Function to update all meta tags
      const updateThemeColor = (color: string) => {
        // Update theme-color meta tag
        const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
        if (themeColorMeta) {
          themeColorMeta.content = color;
        }

        // Update msapplication-navbutton-color for Windows Phone
        const msNavColorMeta = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement;
        if (msNavColorMeta) {
          msNavColorMeta.content = color;
        }

        // Update apple-mobile-web-app-status-bar-style for iOS
        const appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
        if (appleStatusBarMeta) {
          appleStatusBarMeta.content = 'default';
        }
      };

      // Apply the blue color immediately and with delays to ensure browser picks it up
      updateThemeColor(blueColor);
      setTimeout(() => updateThemeColor(blueColor), 10);
      setTimeout(() => updateThemeColor(blueColor), 100);
      setTimeout(() => updateThemeColor(blueColor), 250);

    } else {
      // Simple and reliable scroll restoration for all devices
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.body.style.left = '';

      // Get saved position from sessionStorage as backup
      let positionToRestore = savedScrollPosition;
      try {
        const sessionPosition = sessionStorage.getItem('modalScrollPosition');
        if (sessionPosition) {
          positionToRestore = JSON.parse(sessionPosition);
          sessionStorage.removeItem('modalScrollPosition');
        }
      } catch (e) {
        // Fallback to state if sessionStorage fails
      }

      // Robust restoration that works on mobile and desktop
      const restoreScroll = () => {
        window.scrollTo({
          left: positionToRestore.x,
          top: positionToRestore.y,
          behavior: 'instant'
        });
      };

      // Immediate restoration
      restoreScroll();

      // Delayed restoration as backup (essential for mobile browsers)
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(restoreScroll, 0);
        setTimeout(restoreScroll, 10);
        setTimeout(restoreScroll, 50);
      });

      // Restore original theme colors
      const originalBlueColor = '#3B82F6'; // Original blue color

      // Function to restore theme color
      const restoreThemeColor = (color: string) => {
        const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
        if (themeColorMeta) {
          themeColorMeta.content = color;
        }

        const msNavColorMeta = document.querySelector('meta[name="msapplication-navbutton-color"]') as HTMLMetaElement;
        if (msNavColorMeta) {
          msNavColorMeta.content = color;
        }

        const appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement;
        if (appleStatusBarMeta) {
          appleStatusBarMeta.content = 'default';
        }
      };

      // Restore the blue color
      restoreThemeColor(originalBlueColor);
      setTimeout(() => restoreThemeColor(originalBlueColor), 10);
    }

    return () => {
      // Cleanup on unmount - restore original theme
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';

      const originalBlueColor = '#3B82F6';
      const themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (themeColorMeta) {
        themeColorMeta.content = originalBlueColor;
      }
    };
  }, [isOpen]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all states when modal closes
      setSelectedVideo(null);
      setSelectedImage(0);
      setProductDetails(null);
      setCurrentGallery([]);
      setSelectedColor(null);
      setSelectedShape(null);
      setSelectedSize(null);
      setQuantity(1);
      return;
    }
  }, [isOpen]);

  // Fetch product data
  useEffect(() => {
    if (!isOpen || !productId) return;

    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: rawProduct, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            additional_images_urls,
            category:categories(
              id,
              name,
              name_en
            )
          `)
          .eq('id', productId)
          .eq('is_active', true)
          .eq('is_hidden', false)
          .single();

        if (productError) throw productError;

        // Cast to DatabaseProduct with additional_images_urls
        const product = rawProduct as unknown as DatabaseProduct;

        if (!product) {
          setError('المنتج غير موجود');
          return;
        }

        // Get all product variants (colors, shapes, sizes)
        const { data: colorVariants } = await supabase
          .from('product_variants')
          .select('id, name, color_hex, color_name, image_url, quantity')
          .eq('product_id', product.id)
          .eq('variant_type', 'color') as { data: any[] | null };

        const { data: shapeVariants } = await supabase
          .from('product_variants')
          .select('id, name, quantity, image_url')
          .eq('product_id', product.id)
          .eq('variant_type', 'shape') as { data: any[] | null };

        const { data: sizeVariants } = await supabase
          .from('product_variants')
          .select('id, name, quantity')
          .eq('product_id', product.id)
          .eq('variant_type', 'size') as { data: any[] | null };

        // البحث عن الأحجام الحقيقية من product_size_groups
        let realSizeProducts: any[] = [];
        try {
          // أولاً، نبحث عن مجموعة الأحجام التي ينتمي إليها هذا المنتج
          const { data: sizeGroupItems } = await supabase
            .from('product_size_group_items')
            .select(`
              *,
              size_group:product_size_groups(*)
            `)
            .eq('product_id', product.id);

          if (sizeGroupItems && sizeGroupItems.length > 0) {
            const sizeGroupId = sizeGroupItems[0].size_group_id;

            // نجلب جميع المنتجات في نفس مجموعة الأحجام
            const { data: allSizeItems } = await supabase
              .from('product_size_group_items')
              .select(`
                *,
                product:products(
                  id,
                  name,
                  price,
                  is_active,
                  main_image_url
                )
              `)
              .eq('size_group_id', sizeGroupId)
              .order('sort_order');

            if (allSizeItems && allSizeItems.length > 0) {
              realSizeProducts = allSizeItems
                .filter(item => item.product && item.product.is_active)
                .map(item => ({
                  id: item.product.id,
                  name: item.size_name,
                  price: item.product.price,
                  product_id: item.product.id,
                  available: true,
                  type: 'related_product' as const,
                  sort_order: item.sort_order,
                  image_url: item.product.main_image_url, // إضافة صورة المقاس
                  product_name: item.product.name // إضافة اسم المنتج الكامل
                }))
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            }
          }
        } catch (error) {
          // Silently handle error
        }

        // إذا لم نجد أحجام حقيقية، نبحث عن منتجات مترابطة بناءً على اسم المنتج (النظام القديم)
        let relatedSizeProducts: any[] = [];
        if (realSizeProducts.length === 0) {
          try {
            const baseName = product.name
              .replace(/\s*مقاس\s*\d+\s*/g, '')
              .replace(/\s*مقياس\s*\d+\s*/g, '')
              .replace(/\s*حجم\s*(صغير|متوسط|كبير)\s*/g, '')
              .trim();

            if (baseName && baseName !== product.name) {
              const { data: relatedProducts } = await supabase
                .from('products')
                .select('id, name, price')
                .ilike('name', `%${baseName}%`)
                .neq('id', product.id)
                .eq('is_active', true)
                .limit(10);

              if (relatedProducts && relatedProducts.length > 0) {
                relatedSizeProducts = relatedProducts.filter(p =>
                  /مقاس|مقياس|حجم/.test(p.name)
                ).map(p => {
                  const sizeMatch = p.name.match(/مقاس\s*(\d+)|مقياس\s*(\d+)|حجم\s*(صغير|متوسط|كبير)/);
                  const sizeName = sizeMatch ? (sizeMatch[1] || sizeMatch[2] || sizeMatch[3]) : 'غير محدد';

                  return {
                    id: p.id,
                    name: `مقاس ${sizeName}`,
                    price: p.price,
                    product_id: p.id,
                    available: true,
                    type: 'related_product' as const
                  };
                });
              }
            }
          } catch (error) {
            // Silently handle error
          }
        }

        // Parse product description if it's JSON
        let actualDescription: string = product.description || "";
        try {
          if (product.description && product.description.startsWith('{')) {
            const descriptionData = JSON.parse(product.description);
            actualDescription = descriptionData.text || "";
          }
        } catch (e) {
          // If parsing fails, use original description
          actualDescription = product.description || "";
        }

        // Get sub-images for this product
        const subImages = await getProductSubImages(
          product.id,
          product.name,
          product.video_url,
          product.additional_images_urls // ✨ تمرير الحقل الجديد
        );

        // Get product videos from product_videos table using any type workaround
        try {
          const { data: videos, error: videoError } = await (supabase as any)
            .from('product_videos')
            .select('*')
            .eq('product_id', product.id)
            .order('sort_order', { ascending: true });

          if (!videoError && videos) {
            setProductVideos(videos);
          } else {
            setProductVideos([]);
          }
        } catch (videoError) {
          console.error('Error fetching product videos:', videoError);
          setProductVideos([]);
        }
        
        // Build gallery array
        const gallery: string[] = [];

        console.log('🖼️ Gallery Debug for:', product.name);
        console.log('  - main_image_url:', product.main_image_url);
        console.log('  - subImages count:', subImages.length);
        console.log('  - subImages:', subImages);
        console.log('  - additional_images_urls from DB:', product.additional_images_urls);

        // Add main image first
        if (product.main_image_url) {
          gallery.push(product.main_image_url);
        }

        // Add sub-images
        gallery.push(...subImages);

        // Add sub_image_url if it exists and is different from main
        if (product.sub_image_url && product.sub_image_url !== product.main_image_url) {
          gallery.push(product.sub_image_url);
        }

        console.log('  - Final gallery count:', gallery.length);
        console.log('  - Final gallery:', gallery);

        // Calculate discount information
        const now = new Date();
        const discountStart = (product as any).discount_start_date ? new Date((product as any).discount_start_date) : null;
        const discountEnd = (product as any).discount_end_date ? new Date((product as any).discount_end_date) : null;
        
        const discountPercentage = (product as any).discount_percentage || 0;
        const discountAmount = (product as any).discount_amount || 0;
        
        const isDiscountActive = (
          (discountPercentage > 0 || discountAmount > 0) &&
          (!discountStart || now >= discountStart) &&
          (!discountEnd || now <= discountEnd)
        );
        
        let finalPrice = product.price;
        let calculatedDiscountPercentage = 0;
        
        if (isDiscountActive && discountPercentage > 0) {
          finalPrice = product.price * (1 - (discountPercentage / 100));
          calculatedDiscountPercentage = discountPercentage;
        } else if (isDiscountActive && discountAmount > 0) {
          finalPrice = Math.max(0, product.price - discountAmount);
          calculatedDiscountPercentage = Math.round((discountAmount / product.price) * 100);
        }

        // Create product detail object
        const productDetail: ProductDetail = {
          id: parseInt(product.id.split('-')[0], 16) % 1000, // Convert UUID to number for compatibility
          name: product.name,
          description: actualDescription,
          detailedDescription: actualDescription || 'لا يوجد وصف تفصيلي متاح حالياً.',
          price: finalPrice,
          originalPrice: isDiscountActive ? product.price : undefined,
          image: product.main_image_url || '/placeholder-image.jpg',
          gallery: gallery,
          category: product.category?.name || 'غير محدد',
          rating: (product as any).rating || 0,
          reviews: (product as any).rating_count || 0,
          isOnSale: isDiscountActive,
          discount: calculatedDiscountPercentage,
          specifications: {
            'الكود': product.product_code || 'غير محدد',
            'الباركود': product.barcode || 'غير محدد',
            'الوحدة': product.unit || 'قطعة',
            'المخزون': product.stock?.toString() || '0',
            'الحد الأدنى للمخزون': product.min_stock?.toString() || '0',
            'سعر الجملة': product.wholesale_price ? formatPrice(product.wholesale_price) : 'غير محدد'
          },
          colors: colorVariants?.map(variant => ({
            id: variant.id,
            name: variant.color_name || variant.name,
            hex: variant.color_hex,
            image_url: variant.image_url,
            quantity: variant.quantity || 0
          }))
          .sort((a, b) => (b.quantity || 0) - (a.quantity || 0)) || [], // Sort by quantity descending
          shapes: shapeVariants?.map(variant => ({
            id: variant.id,
            name: variant.name,
            image_url: variant.image_url,
            available: (variant.quantity || 0) > 0
          })) || [],
          sizes: [
            ...(sizeVariants?.map(variant => ({
              id: variant.id,
              name: variant.name,
              available: (variant.quantity || 0) > 0,
              type: 'variant' as const
            })) || []),
            // استخدام الأحجام الحقيقية أولاً، ثم النظام القديم كبديل
            ...(realSizeProducts.length > 0 ? realSizeProducts : relatedSizeProducts).map(product => ({
              id: product.id,
              name: product.name,
              price: product.price,
              product_id: product.product_id,
              available: product.available,
              type: 'related_product' as const,
              image_url: product.image_url,
              product_name: product.product_name
            }))
          ]
        };

        setProductDetails(productDetail);
        setCurrentGallery(gallery);
        setCurrentPrice(productDetail.price);
        setCurrentProductName(productDetail.name);

        // Reset video state when opening new product
        setSelectedVideo(null);
        setSelectedImage(0);

        // Set initial selections
        if (productDetail.colors && productDetail.colors.length > 0) {
          const firstColor = productDetail.colors[0];
          setSelectedColor(firstColor);
          // If first color has image, prioritize it in gallery
          if (firstColor?.image_url) {
            const newGallery = [firstColor.image_url, ...gallery.filter(img => img !== firstColor.image_url)];
            setCurrentGallery(newGallery);
          }
        }
        if (productDetail.shapes && productDetail.shapes.length > 0) {
          setSelectedShape(productDetail.shapes[0]);
        }
        if (productDetail.sizes && productDetail.sizes.length > 0) {
          setSelectedSize(productDetail.sizes[0]);
        }

        // Fetch suggested products if available
        if (product.suggested_products && Array.isArray(product.suggested_products) && product.suggested_products.length > 0) {
          const suggestedIds = product.suggested_products;

          const { data: rawSuggestedData, error: suggestedError } = await supabase
            .from('products')
            .select(`
              *,
              additional_images_urls,
              category:categories(
                id,
                name,
                name_en
              )
            `)
            .in('id', suggestedIds)
            .eq('is_active', true)
            .eq('is_hidden', false);

          const suggestedData = rawSuggestedData as unknown as DatabaseProduct[];

          if (!suggestedError && suggestedData) {
            const convertedSuggestedProducts: Product[] = suggestedData.map((suggestedProduct: any) => {
              // Calculate discount for suggested products
              const now = new Date();
              const discountStart = suggestedProduct.discount_start_date ? new Date(suggestedProduct.discount_start_date) : null;
              const discountEnd = suggestedProduct.discount_end_date ? new Date(suggestedProduct.discount_end_date) : null;
              
              const isDiscountActive = (
                (suggestedProduct.discount_percentage > 0 || suggestedProduct.discount_amount > 0) &&
                (!discountStart || now >= discountStart) &&
                (!discountEnd || now <= discountEnd)
              );
              
              let finalPrice = suggestedProduct.price;
              let calculatedDiscountPercentage = 0;
              
              if (isDiscountActive && suggestedProduct.discount_percentage > 0) {
                finalPrice = suggestedProduct.price * (1 - (suggestedProduct.discount_percentage / 100));
                calculatedDiscountPercentage = suggestedProduct.discount_percentage;
              } else if (isDiscountActive && suggestedProduct.discount_amount > 0) {
                finalPrice = Math.max(0, suggestedProduct.price - suggestedProduct.discount_amount);
                calculatedDiscountPercentage = Math.round((suggestedProduct.discount_amount / suggestedProduct.price) * 100);
              }

              return {
                id: parseInt(suggestedProduct.id.split('-')[0], 16) % 1000,
                name: suggestedProduct.name,
                description: suggestedProduct.description || '',
                price: finalPrice,
                originalPrice: isDiscountActive ? suggestedProduct.price : undefined,
                image: suggestedProduct.main_image_url || '/placeholder-image.jpg',
                category: suggestedProduct.category?.name || 'غير محدد',
                rating: suggestedProduct.rating || 0,
                reviews: suggestedProduct.rating_count || 0,
                isOnSale: isDiscountActive,
                discount: calculatedDiscountPercentage
              };
            });
            
            setSuggestedProductsList(convertedSuggestedProducts);
          }
        }

      } catch (err) {
        console.error('Error fetching product:', err);
        setError(err instanceof Error ? err.message : 'فشل في تحميل المنتج');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [isOpen, productId]);

  const handleAddToCart = async () => {
    if (!productDetails) return;

    try {
      const productIdToAdd = selectedSize?.type === 'related_product' && selectedSize.product_id
        ? selectedSize.product_id
        : productId;

      const priceToUse = selectedSize?.type === 'related_product' && selectedSize.price
        ? selectedSize.price
        : currentPrice;

      await addToCart(
        productIdToAdd,
        quantity,
        priceToUse,
        selectedColor?.name,
        selectedShape?.name,
        selectedSize?.name
      );
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('حدث خطأ أثناء إضافة المنتج. يرجى المحاولة مرة أخرى.');
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{borderBottomColor: 'var(--primary-color)'}}></div>
          <p className="text-lg text-gray-800">جاري تحميل المنتج...</p>
        </div>
      </div>
    );
  }

  if (error || !productDetails) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor: '#c0c0c0'}}>
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800">خطأ</h1>
          <p className="text-lg mb-4 text-gray-800">{error || 'المنتج غير موجود'}</p>
          <button 
            onClick={onClose}
            className="text-white px-6 py-2 rounded-lg transition-colors"
            style={{backgroundColor: 'var(--primary-color)'}}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .mobile-tabs-container {
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .mobile-tabs-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        className="fixed inset-0 w-screen h-screen bg-white z-[99999] flex flex-col overflow-hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: 'white',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Cairo', Arial, sans-serif"
        }}
        dir="rtl"
      >

      {/* Responsive Header */}
      <header className="border-b border-gray-600 py-0 flex-shrink-0" style={{backgroundColor: 'var(--primary-color)'}}>
        {/* Desktop Header */}
        <div className="hidden lg:block">
          <div className="px-8 flex items-center justify-between" style={{minHeight: '80px'}}>
            <button
              onClick={onClose}
              className="text-white hover:text-red-300 transition-colors p-3 text-lg flex items-center"
            >
              <svg className="w-8 h-8 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>العودة للمتجر</span>
            </button>

            <div className="text-white text-2xl font-bold">
              تفاصيل المنتج
            </div>

            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-lg flex items-center justify-center">
                <img
                  src={logoUrl || '/assets/logo/She & Only2.png'}
                  alt={`${companyName} Logo`}
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-white text-lg font-bold">{companyName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Header */}
        <div className="lg:hidden">
          <div className="px-3 flex items-center justify-between min-h-[60px]">
            <button
              onClick={onClose}
              className="text-white hover:text-red-300 transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center">
                <img
                  src={logoUrl || '/assets/logo/She & Only2.png'}
                  alt={`${companyName} Logo`}
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-white text-sm font-bold">{companyName}</span>
              </div>
            </div>

            <button
              onClick={() => setShowCartModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-white text-sm"
              style={{backgroundColor: 'var(--primary-color)'}}
            >
              <span>({cartItems?.length || 0})</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Product Details Content - Mobile optimized */}
      {isMobile ? (
        <main
          className="flex-1 overflow-y-auto bg-[#C0C0C0] scrollbar-hide"
          style={{
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden auto',
            backgroundColor: '#C0C0C0',
            flex: '1 1 0%',
            padding: '12px'
          }}>
          <div>

            {/* Mobile Product Content */}
            <div className="space-y-4">
              {/* Product Image/Video */}
              <div className="bg-white rounded-lg p-3">
                {selectedVideo ? (
                  <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
                    <video
                      src={selectedVideo}
                      className="w-full h-full object-cover rounded-lg"
                      controls={true}
                      preload="metadata"
                      poster={currentGallery[0] || productDetails.image || ''}
                      style={{
                        backgroundColor: '#000000'
                      }}
                    />
                    {/* Video overlay for better visual indication */}
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 rounded px-2 py-1">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                ) : (
                  <img
                    src={currentGallery[selectedImage]}
                    alt={productDetails.name}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                )}
                {/* Thumbnail Gallery - Images and Videos */}
                {(currentGallery.length > 1 || productVideos.length > 0) && (
                  <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                    {/* Image Thumbnails */}
                    {currentGallery.map((img, index) => (
                      <button
                        key={`image-${index}`}
                        onClick={() => {
                          setSelectedImage(index);
                          setSelectedVideo(null);
                        }}
                        className={`flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden ${
                          selectedImage === index && !selectedVideo ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <img src={img} alt={`${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}

                    {/* Video Thumbnails */}
                    {productVideos.map((video, index) => (
                      <button
                        key={`video-${index}`}
                        onClick={() => {
                          setSelectedVideo(video.video_url);
                          setSelectedImage(-1);
                        }}
                        className={`relative flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden bg-black ${
                          selectedVideo === video.video_url ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <video
                          src={video.video_url}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                          poster={currentGallery[0] || productDetails.image || ''}
                          style={{
                            backgroundColor: '#000000'
                          }}
                        />
                        {/* Video Play Icon Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="bg-white rounded-lg p-3 space-y-3">
                <h1 className="text-lg font-bold text-gray-800">{currentProductName}</h1>
                <p className="text-sm text-gray-600">{productDetails.description}</p>

                {/* Price */}
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold" style={{color: 'var(--primary-color)'}}>{formatPrice(currentPrice)}</span>
                  {productDetails.originalPrice && (
                    <span className="text-sm text-gray-500 line-through">{formatPrice(productDetails.originalPrice)}</span>
                  )}
                </div>

                {/* Colors */}
                {productDetails.colors && productDetails.colors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">اللون:</h3>
                    <div className="flex gap-2">
                      {productDetails.colors?.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => {
                            if (selectedColor?.id === color.id) {
                              setSelectedColor(null);
                              setCurrentGallery(productDetails.gallery || []);
                              setSelectedImage(0);
                              setSelectedVideo(null);
                            } else {
                              setSelectedColor(color);
                              if (color.image_url && productDetails.gallery) {
                                const newGallery = [color.image_url, ...productDetails.gallery.filter(img => img !== color.image_url)];
                                setCurrentGallery(newGallery);
                                setSelectedImage(0);
                                setSelectedVideo(null);
                              }
                            }
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            selectedColor?.id === color.id ? 'border-red-500 scale-110' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {productDetails.sizes && productDetails.sizes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">المقاس:</h3>
                    <div className="flex gap-2 flex-wrap">
                      {productDetails.sizes?.map((size) => (
                        <button
                          key={size.id}
                          onClick={() => {
                            if (selectedSize?.id === size.id) {
                              setSelectedSize(null);
                              setCurrentPrice(productDetails.price);
                              setCurrentProductName(productDetails.name);
                            } else {
                              setSelectedSize(size);
                              if (size.price) setCurrentPrice(size.price);
                              if (size.product_name) setCurrentProductName(size.product_name);
                            }
                          }}
                          disabled={!size.available}
                          className={`px-2 py-1 border rounded text-xs ${
                            selectedSize?.id === size.id
                              ? 'border-red-500 bg-red-50 text-red-600'
                              : size.available
                              ? 'border-gray-300 bg-white'
                              : 'border-gray-200 bg-gray-100 text-gray-400'
                          }`}
                        >
                          {size.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">الكمية:</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      min="1"
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-sm font-semibold px-2 py-1 w-12 text-center border border-gray-300 rounded focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <button
                  onClick={handleAddToCart}
                  className="w-full text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm mt-4"
                  style={{backgroundColor: 'var(--primary-color)'}}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                  </svg>
                  إضافة إلى السلة
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto bg-[#C0C0C0] px-4 py-8 scrollbar-hide">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            <button onClick={onClose} className="transition-colors hover:text-[var(--primary-color)]">الرئيسية</button>
            <span>›</span>
            <span className="text-gray-800">{productDetails.category}</span>
            <span>›</span>
            <span className="text-gray-800 font-medium">{productDetails.name}</span>
          </nav>

        {/* Product Main Section - L-shaped Layout */}
        <div className="grid grid-cols-12 gap-4 mb-12">
          {/* Empty spacer - Left Side */}
          <div className="col-span-1">
          </div>

          {/* Main Product Image with L-shaped thumbnails around it */}
          <div className="col-span-4 relative">
            {/* Main Product Image */}
            <div
              className={`relative w-full aspect-square bg-white rounded-lg overflow-hidden shadow-lg ${selectedVideo ? 'cursor-pointer' : 'cursor-crosshair'}`}
              onMouseEnter={() => !selectedVideo && setIsZooming(true)}
              onMouseLeave={() => !selectedVideo && setIsZooming(false)}
              onMouseMove={(e) => {
                if (isZooming && !selectedVideo) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setZoomPosition({ x, y });
                }
              }}
            >
              {selectedVideo ? (
                <div className="relative w-full h-full">
                  <video
                    src={selectedVideo}
                    className="w-full h-full object-cover"
                    controls={false}
                    muted
                    preload="metadata"
                  />
                  <button
                    onClick={() => setShowVideoModal(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 hover:bg-opacity-50 transition-all"
                  >
                    <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </button>
                </div>
              ) : (
                <img
                  key={`main-image-${selectedImage}-${currentGallery[selectedImage]}`}
                  src={currentGallery[selectedImage]}
                  alt={productDetails.name}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setShowVideoModal(true)}
                />
              )}
              {/* Zoom hint - only show for images, not videos */}
              {!isZooming && !selectedVideo && (
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  مرر للتكبير
                </div>
              )}
            </div>

            {/* L-shaped thumbnails layout */}
            {(() => {
              console.log('📸 Thumbnails Debug:');
              console.log('   - currentGallery:', currentGallery);
              console.log('   - currentGallery.length:', currentGallery.length);
              console.log('   - productVideos.length:', productVideos.length);

              // Combine all media (images + videos)
              const allMedia = [
                ...currentGallery.map((url, idx) => ({ type: 'image', url, imageIndex: idx })),
                ...productVideos.map(video => ({ type: 'video', url: video.video_url, imageIndex: -1 }))
              ];

              console.log('   - allMedia.length:', allMedia.length);

              if (allMedia.length === 0) return null;

              return (
                <>
                  {/* Right side vertical thumbnails (first 7) - Extra Large size */}
                  <div className="absolute top-0 -right-28 flex flex-col space-y-2">
                    {allMedia.slice(0, 7).map((media, index) => (
                      <button
                        key={`right-${index}`}
                        onClick={() => {
                          if (media.type === 'video') {
                            setSelectedVideo(media.url);
                            setSelectedImage(-1);
                          } else {
                            setSelectedImage(media.imageIndex);
                            setSelectedVideo(null);
                          }
                        }}
                        onDoubleClick={() => setShowVideoModal(true)}
                        onMouseEnter={() => {
                          if (media.type === 'video') {
                            setSelectedVideo(media.url);
                            setSelectedImage(-1);
                          } else {
                            setSelectedImage(media.imageIndex);
                            setSelectedVideo(null);
                          }
                        }}
                        className={`relative w-24 aspect-square rounded border-2 overflow-hidden transition-all duration-200 ${
                          (media.type === 'video' ? selectedVideo === media.url : selectedImage === media.imageIndex && !selectedVideo)
                            ? 'border-red-500 ring-1 ring-red-500'
                            : 'border-gray-300 hover:border-red-300'
                        }`}
                      >
                        {media.type === 'video' ? (
                          <>
                            <video
                              src={media.url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </>
                        ) : (
                          <img
                            src={media.url}
                            alt={`${productDetails.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Bottom horizontal thumbnails - Extra Large size */}
                  <div className="absolute -bottom-28 right-0 flex space-x-2">
                    {allMedia.slice(7).map((media, index) => (
                      <button
                        key={`bottom-${index}`}
                        onClick={() => {
                          if (media.type === 'video') {
                            setSelectedVideo(media.url);
                            setSelectedImage(-1);
                          } else {
                            setSelectedImage(media.imageIndex);
                            setSelectedVideo(null);
                          }
                        }}
                        onDoubleClick={() => setShowVideoModal(true)}
                        onMouseEnter={() => {
                          if (media.type === 'video') {
                            setSelectedVideo(media.url);
                            setSelectedImage(-1);
                          } else {
                            setSelectedImage(media.imageIndex);
                            setSelectedVideo(null);
                          }
                        }}
                        className={`relative w-24 aspect-square rounded border-2 overflow-hidden transition-all duration-200 ${
                          (media.type === 'video' ? selectedVideo === media.url : selectedImage === media.imageIndex && !selectedVideo)
                            ? 'border-red-500 ring-1 ring-red-500'
                            : 'border-gray-300 hover:border-red-300'
                        }`}
                      >
                        {media.type === 'video' ? (
                          <>
                            <video
                              src={media.url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </>
                        ) : (
                          <img
                            src={media.url}
                            alt={`${productDetails.name} ${index + 8}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Elegant Zoom Overlay - Positioned next to main image - Only for images, not videos */}
          <div className="col-span-3 relative">
            {isZooming && !selectedVideo && (
              <div className="sticky top-4 w-full aspect-square bg-white rounded-lg shadow-xl border-2 border-gray-300 overflow-hidden">
                <img
                  key={`zoom-image-${selectedImage}-${currentGallery[selectedImage]}`}
                  src={currentGallery[selectedImage]}
                  alt={productDetails.name}
                  className="w-full h-full object-cover scale-[2]"
                  style={{
                    transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`
                  }}
                />
              </div>
            )}
          </div>

          {/* Product Info - Right Side */}
          <div className="col-span-4 space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{currentProductName}</h1>
              <p className="text-gray-600 text-lg">{productDetails.description}</p>
            </div>

            {/* Rating and Reviews - conditionally shown based on settings */}
            {showRatings && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < Math.floor(productDetails.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}>
                      ⭐
                    </span>
                  ))}
                  <span className="text-sm text-gray-600 mr-2">
                    {productDetails.rating} ({productDetails.reviews} تقييم)
                  </span>
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold" style={{color: 'var(--primary-color)'}}>{formatPrice(currentPrice)}</span>
              {productDetails.originalPrice && (
                <span className="text-xl text-gray-500 line-through">{formatPrice(productDetails.originalPrice)}</span>
              )}
              {productDetails.isOnSale && (
                <span className="px-2 py-1 rounded-full text-xs font-bold" style={{backgroundColor: '#F5F1F1', color: 'var(--primary-color)'}}>
                  خصم {productDetails.discount}%
                </span>
              )}
            </div>

            {/* Colors */}
            {productDetails.colors && productDetails.colors.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">اللون المتاح:</h3>
                <div className="flex gap-2">
                  {productDetails.colors?.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => {
                        if (selectedColor?.id === color.id) {
                          setSelectedColor(null);
                          setCurrentGallery(productDetails.gallery || []);
                          setSelectedImage(0);
                          setSelectedVideo(null);
                        } else {
                          setSelectedColor(color);
                          if (color.image_url && productDetails.gallery) {
                            const newGallery = [color.image_url, ...productDetails.gallery.filter(img => img !== color.image_url)];
                            setCurrentGallery(newGallery);
                            setSelectedImage(0);
                            setSelectedVideo(null);
                          } else {
                            setCurrentGallery(productDetails.gallery || []);
                          }
                        }
                      }}
                      className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor?.id === color.id
                          ? 'border-red-500 shadow-lg scale-110'
                          : 'border-gray-300 hover:border-red-300'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {selectedColor?.id === color.id && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">اللون المحدد: {selectedColor?.name}</p>
              </div>
            )}


            {/* Shapes */}
            {productDetails.shapes && productDetails.shapes.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">الشكل المتاح:</h3>
                <div className="flex gap-2 flex-wrap">
                  {productDetails.shapes?.map((shape) => (
                    <button
                      key={shape.id}
                      onClick={() => {
                        if (selectedShape?.id === shape.id) {
                          // إلغاء التحديد - العودة للمعرض الأصلي
                          setSelectedShape(null);
                          setCurrentGallery(productDetails.gallery || []);
                          setSelectedImage(0);
                          setSelectedVideo(null);
                        } else {
                          // اختيار شكل جديد
                          setSelectedShape(shape);

                          // تغيير الصورة الرئيسية إذا كان للشكل صورة
                          if (shape.image_url) {
                            const newGallery = [shape.image_url, ...productDetails.gallery.filter(img => img !== shape.image_url)];
                            setCurrentGallery(newGallery);
                            setSelectedImage(0);
                            setSelectedVideo(null); // إزالة الفيديو المحدد إن وجد
                          }
                        }
                      }}
                      disabled={!shape.available}
                      className={`px-3 py-1 border-2 rounded-lg transition-all text-sm ${
                        selectedShape?.id === shape.id
                          ? 'border-red-500 bg-red-50 text-red-600 font-semibold'
                          : shape.available
                          ? 'border-gray-300 hover:border-red-300 bg-white hover:bg-red-50'
                          : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={shape.name}
                    >
                      {shape.name}
                      {selectedShape?.id === shape.id && (
                        <span className="mr-1">
                          <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedShape && (
                  <p className="text-xs text-gray-600 mt-1">الشكل المحدد: {selectedShape?.name}</p>
                )}
              </div>
            )}

            {/* Sizes */}
            {productDetails.sizes && productDetails.sizes.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">أحجام المقاسات:</h3>
                <div className="flex gap-2 flex-wrap">
                  {productDetails.sizes?.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => {
                        if (selectedSize?.id === size.id) {
                          // إلغاء التحديد - العودة للمنتج الأصلي
                          setSelectedSize(null);
                          setCurrentPrice(productDetails.price);
                          setCurrentProductName(productDetails.name);
                          setCurrentGallery(productDetails.gallery || []);
                          setSelectedImage(0);
                          setSelectedVideo(null);
                        } else {
                          // اختيار حجم جديد
                          setSelectedSize(size);

                          // تغيير السعر
                          if (size.price) {
                            setCurrentPrice(size.price);
                          }

                          // تغيير اسم المنتج
                          if (size.product_name) {
                            setCurrentProductName(size.product_name);
                          }

                          // تغيير الصورة الرئيسية
                          if (size.image_url) {
                            const newGallery = [size.image_url, ...productDetails.gallery.filter(img => img !== size.image_url)];
                            setCurrentGallery(newGallery);
                            setSelectedImage(0);
                            setSelectedVideo(null); // إزالة الفيديو المحدد إن وجد
                          }
                        }
                      }}
                      disabled={!size.available}
                      className={`px-3 py-1 border-2 rounded-lg transition-all text-base ${
                        selectedSize?.id === size.id
                          ? 'border-red-500 bg-red-50 text-red-600 font-semibold'
                          : size.available
                          ? 'border-gray-300 hover:border-red-300 bg-white hover:bg-red-50'
                          : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={size.type === 'related_product' ? `${size.name} - ${formatPrice(size.price || 0)}` : size.name}
                    >
                      <div className="flex flex-col items-center text-center">
                        <span className="text-sm">{size.name}</span>
                        {size.type === 'related_product' && size.price && (
                          <span className="text-sm opacity-75">{formatPrice(size.price)}</span>
                        )}
                      </div>
                      {selectedSize?.id === size.id && (
                        <span className="mr-1">
                          <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedSize && (
                  <p className="text-xs text-gray-600 mt-1">الحجم المحدد: {selectedSize?.name}</p>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">الكمية:</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  value={quantity}
                  min="1"
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setQuantity(Math.max(1, value));
                  }}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="text-lg font-semibold px-3 py-1 w-16 text-center border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Add to Cart Buttons */}
            <div className="flex gap-3 pt-3">
              <button
                onClick={handleAddToCart}
                className="flex-1 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                style={{backgroundColor: 'var(--primary-color)'}}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
                </svg>
                أضف إلى السلة
              </button>
              <button className="px-4 py-2 border rounded-lg font-semibold transition-colors flex items-center justify-center text-sm" style={{borderColor: 'var(--primary-color)', color: 'var(--primary-color)'}} onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#F5F1F1'; }} onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          </div>

        </div>


        {/* Suggested Products - Only show if there are suggested products */}
        {suggestedProductsList.length > 0 && (
          <section>
            <div className="mx-16">
              <h3 className="text-2xl font-bold mb-6" style={{color: 'var(--primary-color)'}}>منتجات مقترحة</h3>
            </div>
            <div className="relative">
              {/* Navigation Arrows - Only show if there are more than 4 products */}
              {suggestedProductsList.length > 4 && (
                <>
                  <button 
                    onClick={() => setCurrentSuggestedIndex(Math.max(0, currentSuggestedIndex - 4))}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentSuggestedIndex === 0}
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => setCurrentSuggestedIndex(Math.min(suggestedProductsList.length - 4, currentSuggestedIndex + 4))}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentSuggestedIndex >= suggestedProductsList.length - 4}
                  >
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Products Grid with Margins for Arrows */}
              <div className="mx-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {suggestedProductsList.slice(currentSuggestedIndex, currentSuggestedIndex + 4).map((product) => (
                    <div 
                      key={product.id} 
                      className="bg-white rounded-lg p-4 hover:bg-gray-100 transition-colors border border-gray-300 shadow-md group cursor-pointer"
                      onClick={() => {
                        // Set new product ID and reset state
                        setProductDetails(null);
                        setIsLoading(true);
                        setError(null);
                        setSelectedImage(0);
                        setSelectedColor(null);
                        setCurrentGallery([]);
                        setSelectedSize(null);
                        setQuantity(1);
                        setCurrentSuggestedIndex(0);
                        
                        // Find the UUID from the suggested product
                        const suggestedProductId = product.id.toString();
                        // Note: This is a limitation - we need to track UUID properly
                        // For now, this won't work correctly as we've lost the UUID
                      }}
                    >
                      <div className="relative mb-4">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        {product.isOnSale && (
                          <span className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                            -{product.discount}%
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold mb-2 text-gray-800 truncate transition-colors group-hover:text-[var(--primary-color)]">{product.name}</h4>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {product.originalPrice && (
                            <span className="text-sm text-gray-500 line-through">{formatPrice(product.originalPrice)}</span>
                          )}
                          <span className="text-lg font-bold" style={{color: 'var(--primary-color)'}}>{formatPrice(product.price)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {showRatings && (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-400">⭐</span>
                            <span className="text-sm text-gray-400">{product.rating} ({product.reviews})</span>
                          </div>
                        )}
                        {!showRatings && <div></div>}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await addToCart(String(product.id), 1, product.price);
                            } catch (error) {
                              console.error('Error adding to cart:', error);
                              alert('حدث خطأ أثناء إضافة المنتج.');
                            }
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
                          style={{backgroundColor: 'var(--primary-color)'}}
                          onMouseEnter={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-hover-color)';
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--primary-color)';
                          }}
                        >
                          أضف للسلة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
        </main>
      )}

      {/* Elegant White Video/Image Modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="relative bg-white w-full h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">{productDetails.name}</h3>
              <button
                onClick={() => setShowVideoModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex h-[calc(100vh-88px)]">
              {/* Sidebar - Media Selection */}
              <div className="w-96 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <div className="p-6">
                  {/* Images Section */}
                  {currentGallery.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800">الصور ({currentGallery.length})</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {currentGallery.map((imageUrl, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedImage(index);
                              setSelectedVideo('');
                            }}
                            className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${
                              !selectedVideo && selectedImage === index
                                ? 'border-blue-500 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <img
                              src={imageUrl}
                              alt={`${productDetails.name} ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Videos Section */}
                  {productVideos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-800">الفيديوهات ({productVideos.length})</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {productVideos.map((video, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedVideo(video.video_url)}
                            className={`aspect-video rounded-md overflow-hidden border-2 transition-all relative ${
                              selectedVideo === video.video_url
                                ? 'border-red-500 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <video
                              src={video.video_url}
                              className="w-full h-full object-cover"
                              muted
                              preload="metadata"
                            />
                            {/* Play Icon Overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                              <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content Area - Video/Image Display */}
              <div className="flex-1 p-8">
                <div className="w-full h-full bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
                  {selectedVideo ? (
                    <video
                      src={selectedVideo}
                      className="max-w-full max-h-full object-contain"
                      controls
                      autoPlay
                    />
                  ) : (
                    <img
                      key={`modal-image-${selectedImage}-${currentGallery[selectedImage]}`}
                      src={currentGallery[selectedImage]}
                      alt={productDetails.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Cart Modal */}
      <CartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
      />
      </div>
    </>
  );
}