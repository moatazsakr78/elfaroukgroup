import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { ProductColor } from '../../../components/website/shared/types'
import { cache, CacheKeys, CacheTTL } from '../cache/memoryCache'

export interface Product {
  id: string
  name: string
  name_en?: string | null
  description?: string | null
  description_en?: string | null
  barcode?: string | null
  price: number
  cost_price: number
  category_id?: string | null
  video_url?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  product_code?: string | null
  wholesale_price?: number | null
  price1?: number | null
  price2?: number | null
  price3?: number | null
  price4?: number | null
  main_image_url?: string | null
  sub_image_url?: string | null
  additional_images_urls?: string[] | null // الحقل الجديد للصور الإضافية
  barcodes?: string[] | null
  unit?: string | null
  stock?: number | null
  min_stock?: number | null
  max_stock?: number | null
  location?: string | null
  status?: string | null
  warehouse?: string | null
  branch?: string | null
  tax_price?: number | null
  audit_status?: string | null
  // New rating and discount fields
  rating?: number | null
  rating_count?: number | null
  discount_percentage?: number | null
  discount_amount?: number | null
  discount_start_date?: string | null
  discount_end_date?: string | null
  // New management fields
  is_hidden?: boolean | null
  is_featured?: boolean | null
  display_order?: number | null
  suggested_products?: string[] | null
  additional_images?: any[] | null
  actualVideoUrl?: string | null // Actual video URL (not images array)
  productVideos?: ProductVideo[] // ✨ قائمة الفيديوهات من جدول product_videos
  // Relations
  category?: {
    id: string
    name: string
    name_en?: string | null
  } | null
  // Computed fields for table display
  totalQuantity?: number
  inventoryData?: Record<string, { quantity: number, min_stock: number, audit_status: string }>
  variantsData?: Record<string, ProductVariant[]>
  productColors?: Array<{id: string, name: string, color: string}>
  allImages?: string[]
  productSizes?: ProductSize[]
  productRatings?: ProductRating[]
  // Helper computed fields
  finalPrice?: number // Price after discount
  isDiscounted?: boolean
  discountLabel?: string
  colors?: ProductColor[] // Color variants
}

// ✨ Interface للفيديوهات
export interface ProductVideo {
  id: string
  product_id: string
  video_url: string
  video_name?: string | null
  video_size?: number | null
  duration?: number | null
  thumbnail_url?: string | null
  sort_order?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductVariant {
  id: string
  product_id: string
  branch_id: string
  variant_type: 'color' | 'shape'
  name: string
  quantity: number
  barcode?: string | null
  image_url?: string | null
  color_hex?: string | null
  color_name?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductSize {
  id: string
  product_id: string
  size_name: string
  size_code?: string | null
  size_value?: string | null
  size_category?: string | null
  price_adjustment: number
  is_available: boolean
  stock_quantity: number
  min_stock: number
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductRating {
  id: string
  product_id: string
  customer_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  rating: number
  review_title?: string | null
  review_text?: string | null
  is_verified_purchase: boolean
  is_approved: boolean
  is_featured: boolean
  helpful_count: number
  created_at?: string | null
  updated_at?: string | null
}

export interface InventoryItem {
  id: string
  product_id: string
  branch_id: string
  quantity: number
  min_stock: number
  max_stock: number
  location?: string
}

export interface Branch {
  id: string
  name: string
  name_en?: string | null
  address?: string
  is_active?: boolean | null
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBranchesForStock, setSelectedBranchesForStock] = useState<string[]>([])

  // HELPER: Process product images (extracted for consistency)
  const processProductImages = useCallback((product: any, variants: any[] = []): string[] => {
    const allProductImages: string[] = []

    // Add main image if exists
    if (product.main_image_url) {
      allProductImages.push(product.main_image_url)
    }

    // Extract images from variants
    variants.forEach((variant: any) => {
      if (variant.image_url) {
        allProductImages.push(variant.image_url)
      }
    })

    // ✨ HIGHEST PRIORITY: Add sub-images from additional_images_urls (new field)
    if (product.additional_images_urls && Array.isArray(product.additional_images_urls) && product.additional_images_urls.length > 0) {
      allProductImages.push(...product.additional_images_urls);
    }
    // FALLBACK: Add sub-images from video_url field (old system) - only if additional_images_urls is empty
    else if (product.video_url) {
      try {
        const additionalImages = JSON.parse(product.video_url);
        if (Array.isArray(additionalImages) && additionalImages.length > 0) {
          allProductImages.push(...additionalImages);
        }
      } catch (parseError) {
        // video_url is a real video URL, not JSON - ignore
      }
    }

    // Remove duplicates from images
    const uniqueImages = Array.from(new Set(allProductImages.filter(img => img && img.trim() !== '')))

    // Add sub_image_url to images if it exists and is not already included
    if (product.sub_image_url && !uniqueImages.includes(product.sub_image_url)) {
      uniqueImages.push(product.sub_image_url)
    }

    return uniqueImages
  }, [])

  // OPTIMIZED: Single query to fetch all data with joins instead of N+1 queries
  const fetchProductsOptimized = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load selected branches for stock calculation
      const { data: displaySettings } = await supabase
        .from('product_display_settings')
        .select('selected_branches')
        .single()

      const selectedBranchIds = displaySettings?.selected_branches || []
      setSelectedBranchesForStock(selectedBranchIds)

      // Try to get from cache first
      const cachedProducts = cache.get<Product[]>(CacheKeys.productsWithData())
      const cachedBranches = cache.get<Branch[]>(CacheKeys.branches())

      if (cachedProducts && cachedBranches) {
        setProducts(cachedProducts)
        setBranches(cachedBranches)
        setIsLoading(false)
        return
      }

      // OPTIMIZATION: Fetch branches first and cache them
      const branchesData = await cache.getOrSet(
        CacheKeys.branches(),
        async () => {
          const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('is_active', true)
            .order('name')

          if (error) {
            console.warn('Unable to fetch branches:', error)
            return []
          }
          return data || []
        },
        CacheTTL.branches
      )

      setBranches(branchesData)

      // OPTIMIZATION: Single optimized query with all related data
      // Don't cache products if we have selected branches (to allow real-time recalculation)
      const shouldCache = selectedBranchIds.length === 0

      const enrichedProducts = shouldCache
        ? await cache.getOrSet(
            CacheKeys.productsWithData(),
            async () => await fetchAndProcessProducts(selectedBranchIds, branchesData),
            CacheTTL.products
          )
        : await fetchAndProcessProducts(selectedBranchIds, branchesData)

      setProducts(enrichedProducts)
      setIsLoading(false)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setProducts([])
      setIsLoading(false)
      throw err
    }
  }, [])

  // Helper function to fetch and process products
  const fetchAndProcessProducts = async (selectedBranchIds: string[], branchesData: Branch[]) => {
    // Fetch base products with categories
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(
          id,
          name,
          name_en
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (productsError) throw productsError

    if (!productsData || productsData.length === 0) {
      return []
    }

    // OPTIMIZATION: Batch fetch all inventory data in one query
    const productIds = productsData.map(p => p.id)

    const [inventoryData, variantsData, videosData] = await Promise.all([
      // Single query for all inventory data
      supabase
        .from('inventory')
        .select('product_id, branch_id, quantity, min_stock, audit_status')
        .in('product_id', productIds)
        .then(({ data, error }) => {
          if (error) {
            console.warn('Unable to fetch inventory data:', error)
            return []
          }
          return data || []
        }),

      // Single query for all color & shape definitions
      supabase
        .from('product_color_shape_definitions')
        .select('*')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.warn('Unable to fetch color/shape definitions:', error)
            return []
          }
          return data || []
        }),

      // ✨ Single query for all videos data
      (supabase as any)
        .from('product_videos')
        .select('*')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })
        .then(({ data, error }: any) => {
          if (error) {
            console.warn('Unable to fetch videos data:', error)
            return []
          }
          return data || []
        })
    ])

    // OPTIMIZATION: Group inventory, variants, and videos by product_id for O(1) lookup
    const inventoryByProduct = new Map<string, any[]>()
    const variantsByProduct = new Map<string, any[]>()
    const videosByProduct = new Map<string, ProductVideo[]>()

    inventoryData.forEach((inv: any) => {
      const productId = inv.product_id
      if (!inventoryByProduct.has(productId)) {
        inventoryByProduct.set(productId, [])
      }
      inventoryByProduct.get(productId)!.push(inv)
    })

    variantsData.forEach((variant: any) => {
      const productId = variant.product_id
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, [])
      }
      variantsByProduct.get(productId)!.push(variant)
    })

    // ✨ Group videos by product_id
    videosData.forEach((video: any) => {
      const productId = video.product_id
      if (!videosByProduct.has(productId)) {
        videosByProduct.set(productId, [])
      }
      videosByProduct.get(productId)!.push(video)
    })

    // OPTIMIZATION: Process all products in parallel with optimized logic
    return productsData.map(rawProduct => {
      const product = rawProduct as any

      // Parse product colors and description (cached computation)
      let productColors: any[] = []
      let actualDescription: string = product.description || ""

      try {
        if (product.description && product.description.startsWith('{')) {
          const descriptionData = JSON.parse(product.description)
          productColors = descriptionData.colors || []
          actualDescription = descriptionData.text || ""

          // Try to assign images from video_url to colors
          if (productColors.length > 0 && product.video_url) {
            try {
              const additionalImages = JSON.parse(product.video_url)
              if (Array.isArray(additionalImages)) {
                productColors = productColors.map((color: any, index: number) => ({
                  ...color,
                  image: color.image || (additionalImages[index] || undefined)
                }))
              }
            } catch (imageParseError) {
              // Ignore image parsing errors
            }
          }
        }
      } catch (e) {
        productColors = []
        actualDescription = product.description || ""
      }

      // OPTIMIZATION: Use pre-grouped data instead of filtering arrays
      const productInventoryData = inventoryByProduct.get(product.id) || []
      const productVariantsData = variantsByProduct.get(product.id) || []

      // Group inventory by branch/warehouse with O(n) complexity - INCLUDE AUDIT STATUS
      // Initialize with all branches (default values: quantity=0, min_stock=0, audit_status='غير مجرود')
      const inventoryByBranch: Record<string, { quantity: number, min_stock: number, audit_status: string }> = {}
      let totalQuantity = 0

      // First, initialize all branches with default values (zero quantity)
      branchesData.forEach((branch: Branch) => {
        inventoryByBranch[branch.id] = {
          quantity: 0,
          min_stock: 0,
          audit_status: 'غير مجرود'
        }
      })

      // Then, update with actual inventory data
      productInventoryData.forEach((inv: any) => {
        const locationId = inv.branch_id
        if (locationId) {
          inventoryByBranch[locationId] = {
            quantity: inv.quantity || 0,
            min_stock: inv.min_stock || 0,
            audit_status: inv.audit_status || 'غير مجرود'
          }

          // Only count quantity from selected branches (if any are selected)
          // If no branches selected, count from all branches
          if (selectedBranchIds.length === 0 || selectedBranchIds.includes(locationId)) {
            totalQuantity += inv.quantity || 0
          }
        }
      })

      // Group variants by location and process images
      const variantsByLocation: Record<string, ProductVariant[]> = {}

      productVariantsData.forEach((variant: any) => {
        const locationId = variant.branch_id
        if (locationId) {
          if (!variantsByLocation[locationId]) {
            variantsByLocation[locationId] = []
          }
          variantsByLocation[locationId].push({
            ...variant,
            variant_type: variant.variant_type as 'color' | 'shape'
          })
        }
      })

      // FIXED: Use consistent image processing helper
      const uniqueImages = processProductImages(product, productVariantsData)

      // ✨ استخدام الحقل الجديد مع fallback للصيغة القديمة
      let parsedAdditionalImages = product.additional_images_urls || []
      let actualVideoUrl = product.video_url || null

      // 🔄 FALLBACK: إذا لم تكن هناك صور في الحقل الجديد، حاول القراءة من الحقول القديمة
      if (parsedAdditionalImages.length === 0) {
        // محاولة قراءة من sub_image_url
        if (product.sub_image_url) {
          try {
            const parsed = JSON.parse(product.sub_image_url)
            if (Array.isArray(parsed)) {
              parsedAdditionalImages = parsed
            }
          } catch (e) {
            // Ignore
          }
        }

        // محاولة قراءة من video_url إذا كان يحتوي على صور
        if (parsedAdditionalImages.length === 0 && product.video_url) {
          try {
            const parsed = JSON.parse(product.video_url)
            if (Array.isArray(parsed)) {
              parsedAdditionalImages = parsed
              actualVideoUrl = null // video_url كان يحتوي على صور، وليس فيديو
            }
          } catch (e) {
            // video_url هو رابط فيديو فعلي
          }
        }
      }

      // Calculate discount information
      const now = new Date()
      const discountStart = product.discount_start_date ? new Date(product.discount_start_date) : null
      const discountEnd = product.discount_end_date ? new Date(product.discount_end_date) : null

      const isDiscountActive = (
        (product.discount_percentage > 0 || product.discount_amount > 0) &&
        (!discountStart || now >= discountStart) &&
        (!discountEnd || now <= discountEnd)
      )

      let finalPrice = product.price
      let discountLabel = ''

      if (isDiscountActive) {
        if (product.discount_percentage > 0) {
          finalPrice = product.price * (1 - (product.discount_percentage / 100))
          discountLabel = `-${product.discount_percentage}%`
        } else if (product.discount_amount > 0) {
          finalPrice = Math.max(0, product.price - product.discount_amount)
          discountLabel = `-${product.discount_amount}`
        }
      }

      // Extract color variants for website format and sort by quantity (highest first)
      const colorVariants = productVariantsData
        .filter((variant: any) => variant.variant_type === 'color' && variant.color_hex && variant.color_name)
        .map((variant: any) => ({
          id: variant.id,
          name: variant.color_name,
          hex: variant.color_hex,
          image_url: variant.image_url,
          quantity: variant.quantity || 0
        }))
        .sort((a: any, b: any) => b.quantity - a.quantity);

      // Get videos for this product
      const productVideos = videosByProduct.get(product.id) || []

      return {
        ...product,
        description: actualDescription,
        totalQuantity,
        inventoryData: inventoryByBranch,
        variantsData: variantsByLocation,
        productColors: productColors,
        colors: colorVariants,
        allImages: uniqueImages,
        additional_images: parsedAdditionalImages, // ✨ من الحقل الجديد
        actualVideoUrl: actualVideoUrl, // ✨ رابط الفيديو فقط
        productVideos: productVideos, // ✨ قائمة الفيديوهات من جدول product_videos
        finalPrice: finalPrice,
        isDiscounted: isDiscountActive,
        discountLabel: discountLabel
      }
    })
  }

  // Update existing product
  const updateProduct = useCallback(async (productId: string, productData: Partial<Product>): Promise<Product | null> => {
    try {
      // ✨ استخدام الحقل الجديد المبسط للصور الإضافية
      const additionalImagesValue = productData.additional_images || productData.additional_images_urls
      const videoUrlValue = productData.actualVideoUrl !== undefined ? productData.actualVideoUrl : productData.video_url

      const { data, error } = await supabase
        .from('products')
        .update({
          name: productData.name!,
          name_en: productData.name_en,
          description: productData.description,
          description_en: productData.description_en,
          barcode: productData.barcode,
          price: productData.price || 0,
          cost_price: productData.cost_price || 0,
          wholesale_price: productData.wholesale_price || 0,
          price1: productData.price1 || 0,
          price2: productData.price2 || 0,
          price3: productData.price3 || 0,
          price4: productData.price4 || 0,
          category_id: productData.category_id,
          product_code: productData.product_code,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          additional_images_urls: additionalImagesValue, // ✨ الحقل الجديد للصور الإضافية
          video_url: videoUrlValue, // ✨ فقط للفيديوهات
          barcodes: productData.barcodes || [],
          unit: productData.unit || 'قطعة',
          stock: productData.stock,
          min_stock: productData.min_stock,
          max_stock: productData.max_stock,
          location: productData.location,
          warehouse: productData.warehouse,
          branch: productData.branch,
          tax_price: productData.tax_price,
          rating: productData.rating || 0,
          rating_count: productData.rating_count || 0,
          discount_percentage: productData.discount_percentage || 0,
          discount_amount: productData.discount_amount || 0,
          discount_start_date: productData.discount_start_date,
          discount_end_date: productData.discount_end_date,
          is_hidden: productData.is_hidden,
          is_featured: productData.is_featured,
          display_order: productData.display_order,
          suggested_products: productData.suggested_products,
          is_active: productData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          category:categories(
            id,
            name,
            name_en
          )
        `)
        .single()

      if (error) throw error

      // OPTIMIZATION: Invalidate relevant cache entries
      cache.invalidatePattern('products:')
      cache.delete(CacheKeys.productById(productId))

      return data as Product
    } catch (err) {
      console.error('Error updating product:', err)
      throw err
    }
  }, [])

  // Create new product
  const createProduct = useCallback(async (productData: Partial<Product>): Promise<Product | null> => {
    try {
      // ✨ استخدام الحقل الجديد المبسط للصور الإضافية
      const additionalImagesValue = productData.additional_images || productData.additional_images_urls || []
      const videoUrlValue = productData.actualVideoUrl || productData.video_url || null

      console.log('💾 CreateProduct Debug:')
      console.log('  - additional_images:', additionalImagesValue.length, 'images')
      console.log('  - video_url:', videoUrlValue)

      const { data, error } = await supabase
        .from('products')
        .insert({
          name: productData.name!,
          name_en: productData.name_en,
          description: productData.description,
          description_en: productData.description_en,
          barcode: productData.barcode,
          price: productData.price || 0,
          cost_price: productData.cost_price || 0,
          category_id: productData.category_id,
          video_url: videoUrlValue, // ✨ فقط للفيديوهات
          product_code: productData.product_code,
          wholesale_price: productData.wholesale_price || 0,
          price1: productData.price1 || 0,
          price2: productData.price2 || 0,
          price3: productData.price3 || 0,
          price4: productData.price4 || 0,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          additional_images_urls: additionalImagesValue, // ✨ الحقل الجديد للصور الإضافية
          barcodes: productData.barcodes || [],
          unit: productData.unit || 'قطعة',
          stock: productData.stock || 0,
          min_stock: productData.min_stock || 0,
          max_stock: productData.max_stock || 100,
          location: productData.location,
          warehouse: productData.warehouse,
          branch: productData.branch,
          tax_price: productData.tax_price || 0,
          rating: 0,
          rating_count: 0,
          discount_percentage: productData.discount_percentage || 0,
          discount_amount: productData.discount_amount || 0,
          discount_start_date: productData.discount_start_date,
          discount_end_date: productData.discount_end_date,
          is_hidden: productData.is_hidden || false,
          is_featured: productData.is_featured || false,
          display_order: productData.display_order || 0,
          suggested_products: productData.suggested_products || [],
          is_active: true
        })
        .select(`
          *,
          category:categories(
            id,
            name,
            name_en
          )
        `)
        .single()

      if (error) throw error

      // OPTIMIZATION: Invalidate cache
      cache.invalidatePattern('products:')

      return data as Product
    } catch (err) {
      console.error('Error creating product:', err)
      throw err
    }
  }, [])

  // Delete product
  const deleteProduct = useCallback(async (productId: string): Promise<void> => {
    try {
      // Check if product exists in sales invoices
      const { data: saleItems, error: saleError } = await supabase
        .from('sale_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (saleError) throw saleError

      if (saleItems && saleItems.length > 0) {
        throw new Error('المنتج موجود في فواتير لا يمكن حذفه')
      }

      // Check if product exists in purchase invoices
      const { data: purchaseItems, error: purchaseError } = await supabase
        .from('purchase_invoice_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (purchaseError) throw purchaseError

      if (purchaseItems && purchaseItems.length > 0) {
        throw new Error('المنتج موجود في فواتير لا يمكن حذفه')
      }

      // Check if product exists in orders
      const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1)

      if (orderError) throw orderError

      if (orderItems && orderItems.length > 0) {
        throw new Error('المنتج موجود في فواتير لا يمكن حذفه')
      }

      // If no invoice references found, proceed with deletion
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      // OPTIMIZATION: Invalidate cache
      cache.invalidatePattern('products:')
      cache.delete(CacheKeys.productById(productId))
    } catch (err) {
      console.error('Error deleting product:', err)
      throw err
    }
  }, [])

  // OPTIMIZATION: Enhanced real-time subscriptions with smart cache invalidation
  useEffect(() => {
    // Products subscription
    const productsChannel = supabase
      .channel('products_changes_optimized')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async (payload) => {
          // OPTIMIZATION: Invalidate cache and refetch only when necessary
          cache.invalidatePattern('products:')
          
          if (payload.eventType === 'INSERT') {
            // For INSERT, we can add the new product directly without full refetch
            const { data: newProduct } = await supabase
              .from('products')
              .select(`
                *,
                category:categories(
                  id,
                  name,
                  name_en
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newProduct) {
              // FIXED: Proper image processing for real-time updates
              const allImages = processProductImages(newProduct)
              
              const enrichedProduct = {
                ...newProduct,
                description: newProduct.description || "",
                productColors: [],
                totalQuantity: 0,
                inventoryData: {},
                variantsData: {},
                allImages: allImages, // Now properly processes all images
                finalPrice: newProduct.price,
                isDiscounted: false,
                discountLabel: ''
              }
              
              setProducts(prev => [enrichedProduct, ...prev] as Product[])
            }
          } else if (payload.eventType === 'UPDATE') {
            // Handle UPDATE events more efficiently for specific fields
            const updatedProduct = payload.new as any
            const oldProduct = payload.old as any
            
            // For product updates, do full refetch to get latest data
            fetchProductsOptimized()
          } else {
            // For DELETE, do a smart refetch
            fetchProductsOptimized()
          }
        }
      )
      .subscribe()

    // Inventory subscription with debouncing
    const inventoryChannel = supabase
      .channel('inventory_changes_optimized')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        (payload: any) => {
          // OPTIMIZATION: Update specific product inventory without full refetch
          if (payload.new && payload.new.product_id) {
            const productId = payload.new.product_id
            const locationId = payload.new.branch_id || payload.new.warehouse_id
            const quantity = payload.new.quantity || 0
            const minStock = payload.new.min_stock || 0

            if (locationId) {
              setProducts(prev => prev.map(product => {
                if (product.id === productId) {
                  console.log('Real-time update received for product:', productId, 'with audit status:', payload.new.audit_status)
                  
                  const updatedInventoryData = {
                    ...product.inventoryData,
                    [locationId]: { 
                      quantity, 
                      min_stock: minStock,
                      audit_status: payload.new.audit_status || 'غير مجرود'
                    }
                  }
                  
                  // Recalculate total quantity
                  const totalQuantity = Object.values(updatedInventoryData)
                    .reduce((sum, inv: any) => sum + (inv?.quantity || 0), 0)

                  return {
                    ...product,
                    inventoryData: updatedInventoryData,
                    totalQuantity
                  } as Product
                }
                return product
              }))
            }
          }
        }
      )
      .subscribe()

    // Color/Shape definitions subscription
    const variantDefsChannel = supabase
      .channel('variant_definitions_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'product_color_shape_definitions' },
        async (payload: any) => {
          // When color/shape definitions change, refetch for the affected product
          const productId = payload.new?.product_id || payload.old?.product_id
          if (productId) {
            // Refetch color & shape definitions for this specific product
            const { data: variants } = await supabase
              .from('product_color_shape_definitions')
              .select('*')
              .eq('product_id', productId)
              .order('sort_order', { ascending: true })

            // Update all products with this ID (across all branches)
            setProducts(prev => prev.map(product => {
              if (product.id === productId) {
                // Update variant definitions for all locations
                const updatedVariantsData: Record<string, any[]> = {}
                Object.keys(product.variantsData || {}).forEach(locationId => {
                  updatedVariantsData[locationId] = (variants || []).map(v => ({
                    ...v,
                    variant_type: v.variant_type as 'color' | 'shape'
                  }))
                })

                return {
                  ...product,
                  variantsData: updatedVariantsData
                }
              }
              return product
            }))
          }
        }
      )
      .subscribe()

    // Variant quantities subscription
    const variantQuantitiesChannel = supabase
      .channel('variant_quantities_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'product_variant_quantities' },
        async (payload: any) => {
          // When quantities change, we need to refetch for affected product
          // Since we don't have product_id directly, we need to get it from the definition
          const variantDefId = payload.new?.variant_definition_id || payload.old?.variant_definition_id
          if (variantDefId) {
            // Get the product_id from the definition
            const { data: def } = await supabase
              .from('product_color_shape_definitions')
              .select('product_id')
              .eq('id', variantDefId)
              .single()

            if (def?.product_id) {
              // Refetch variants for this product
              const { data: variants } = await supabase
                .from('product_color_shape_definitions')
                .select('*')
                .eq('product_id', def.product_id)
                .order('sort_order', { ascending: true })

              // Update products
              setProducts(prev => prev.map(product => {
                if (product.id === def.product_id) {
                  const updatedVariantsData: Record<string, any[]> = {}
                  Object.keys(product.variantsData || {}).forEach(locationId => {
                    updatedVariantsData[locationId] = (variants || []).map(v => ({
                      ...v,
                      variant_type: v.variant_type as 'color' | 'shape'
                    }))
                  })

                  return {
                    ...product,
                    variantsData: updatedVariantsData
                  }
                }
                return product
              }))
            }
          }
        }
      )
      .subscribe()

    // Subscribe to product display settings changes
    const displaySettingsChannel = supabase
      .channel('product_display_settings_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'product_display_settings' },
        (payload: any) => {
          if (payload.new?.selected_branches) {
            // Reload products to recalculate with new branch selection
            fetchProductsOptimized()
          }
        }
      )
      .subscribe()

    return () => {
      productsChannel.unsubscribe()
      inventoryChannel.unsubscribe()
      variantDefsChannel.unsubscribe()
      variantQuantitiesChannel.unsubscribe()
      displaySettingsChannel.unsubscribe()
    }
  }, [fetchProductsOptimized])

  // Initial data fetch
  useEffect(() => {
    fetchProductsOptimized()
  }, [fetchProductsOptimized])

  return {
    products,
    setProducts,
    branches,
    isLoading,
    error,
    fetchProducts: fetchProductsOptimized, // Use optimized version
    createProduct,
    updateProduct,
    deleteProduct
  }
}