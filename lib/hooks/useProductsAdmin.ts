/**
 * ✨ SUPER OPTIMIZED Products Hook for Admin Pages
 *
 * Performance improvements:
 * - Reduces 201 queries to 3 queries (for 100 products)
 * - Uses client-side caching
 * - Selective field fetching
 * - Batch processing
 *
 * Use this for: Inventory, POS, Admin Products pages
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/app/lib/supabase/client';

// ✨ Helper function to chunk array for batched queries (Supabase URL limit ~2000 chars)
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Batch size for .in() queries (safe limit for UUIDs)
const QUERY_BATCH_SIZE = 200;

// ✨ Video interface for product_videos table
export interface ProductVideo {
  id: string;
  product_id: string;
  video_url: string;
  thumbnail_url?: string | null;
  video_name?: string | null;
  video_size?: number | null;
  duration?: number | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  main_image_url?: string | null;
  sub_image_url?: string | null;
  additional_images_urls?: string[] | null;
  category_id?: string | null;
  is_active?: boolean | null;
  display_order?: number | null;
  stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  unit?: string | null;
  description?: string | null;
  description_en?: string | null;
  wholesale_price?: number | null;
  price1?: number | null;
  price2?: number | null;
  price3?: number | null;
  price4?: number | null;
  quantity_per_carton?: number | null;
  product_code?: string | null;
  // New rating and discount fields
  rating?: number | null;
  rating_count?: number | null;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  discount_start_date?: string | null;
  discount_end_date?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  // Computed fields
  totalQuantity?: number;
  inventoryData?: Record<string, { quantity: number; min_stock: number; audit_status: string }>;
  variantsData?: Record<string, any[]>;
  productColors?: Array<{id: string; name: string; color: string}>;
  allImages?: string[];
  // ✨ Export fields
  additional_images?: any[] | null; // Mapped from additional_images_urls for export
  productVideos?: ProductVideo[]; // Videos from product_videos table
  // Helper computed fields
  finalPrice?: number; // Price after discount
  isDiscounted?: boolean;
  discountLabel?: string;
}

export interface Branch {
  id: string;
  name: string;
  name_en?: string | null;
  address?: string;
  is_active?: boolean | null;
}

export function useProductsAdmin(options?: { selectedBranches?: string[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Memoize selected branches to prevent unnecessary re-fetches
  const selectedBranches = useMemo(() => options?.selectedBranches || [], [options?.selectedBranches]);

  const fetchProducts = useCallback(async (force = false) => {
    try {
      // Simple cache: don't refetch if less than 5 seconds since last fetch (unless forced)
      const now = Date.now();
      if (!force && lastFetch && now - lastFetch < 5000) {
        console.log('⚡ Using cached data (< 5s old)');
        return;
      }

      setIsLoading(true);
      setError(null);

      console.time('⚡ Fetch products with inventory');

      // Query 1: Fetch branches (small dataset, no pagination needed)
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // Query 2: Fetch ALL products with pagination (bypasses Supabase 1000 row limit)
      const PAGE_SIZE = 1000;
      const allProducts: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: pageError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            barcode,
            price,
            cost_price,
            main_image_url,
            sub_image_url,
            additional_images_urls,
            category_id,
            is_active,
            display_order,
            stock,
            min_stock,
            max_stock,
            unit,
            description,
            wholesale_price,
            price1,
            price2,
            price3,
            price4,
            quantity_per_carton,
            product_code,
            rating,
            rating_count,
            discount_percentage,
            discount_amount,
            discount_start_date,
            discount_end_date,
            categories (
              id,
              name
            )
          `)
          .eq('is_active', true)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('display_order', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (pageError) throw pageError;
        if (data && data.length > 0) {
          allProducts.push(...data);
          offset += data.length;
          if (data.length < PAGE_SIZE) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      const rawProducts = allProducts;
      const productsError = null;

      if (branchesError) {
        console.warn('Unable to fetch branches:', branchesError);
      } else {
        setBranches(branchesData || []);
      }

      if (productsError) {
        throw productsError;
      }

      if (!rawProducts || rawProducts.length === 0) {
        console.log('⚠️ No products found!');
        setProducts([]);
        setIsLoading(false);
        return;
      }

      console.log('🔍 Total products fetched from DB:', rawProducts.length);

      const productIds = (rawProducts as any[]).map(p => p.id);

      // ✨ BATCHED QUERIES: Split product IDs into chunks to avoid URL length limits
      const productIdChunks = chunkArray(productIds, QUERY_BATCH_SIZE);
      console.log(`📦 Split ${productIds.length} products into ${productIdChunks.length} batches`);

      // ✨ Fetch inventory in batches
      const inventoryPromises = productIdChunks.map(chunk =>
        supabase
          .from('inventory')
          .select('product_id, branch_id, warehouse_id, quantity, min_stock, audit_status')
          .in('product_id', chunk)
      );

      // ✨ Fetch variant definitions in batches
      const variantDefinitionsPromises = productIdChunks.map(chunk =>
        supabase
          .from('product_color_shape_definitions')
          .select('id, product_id, variant_type, name, color_hex, image_url, barcode, sort_order')
          .in('product_id', chunk)
      );

      // ✨ Fetch videos in batches
      const videosPromises = productIdChunks.map(chunk =>
        (supabase as any)
          .from('product_videos')
          .select('id, product_id, video_url, thumbnail_url, video_name, video_size, duration, sort_order, created_at')
          .in('product_id', chunk)
          .order('sort_order', { ascending: true })
      );

      // Run all batched queries in parallel
      const [inventoryResults, variantDefinitionsResults, videosResults] = await Promise.all([
        Promise.all(inventoryPromises),
        Promise.all(variantDefinitionsPromises),
        Promise.all(videosPromises)
      ]);

      // Merge results from all batches
      const inventory: any[] = [];
      const variantDefinitions: any[] = [];
      const videos: any[] = [];

      inventoryResults.forEach((result, idx) => {
        if (result.error) {
          console.warn(`Error fetching inventory batch ${idx}:`, result.error);
        } else if (result.data) {
          inventory.push(...result.data);
        }
      });

      variantDefinitionsResults.forEach((result, idx) => {
        if (result.error) {
          console.warn(`Error fetching variant definitions batch ${idx}:`, result.error);
        } else if (result.data) {
          variantDefinitions.push(...result.data);
        }
      });

      videosResults.forEach((result, idx) => {
        if (result.error) {
          console.warn(`Error fetching videos batch ${idx}:`, result.error);
        } else if (result.data) {
          videos.push(...result.data);
        }
      });

      console.log(`✅ Fetched: ${inventory.length} inventory records, ${variantDefinitions.length} definitions, ${videos.length} videos`);

      // ✨ Query 4b: Get ALL variant QUANTITIES (depends on variant definitions)
      let variants: any[] = [];
      if (variantDefinitions && variantDefinitions.length > 0) {
        const definitionIds = variantDefinitions.map(d => d.id);
        const definitionIdChunks = chunkArray(definitionIds, QUERY_BATCH_SIZE);

        const quantitiesPromises = definitionIdChunks.map(chunk =>
          supabase
            .from('product_variant_quantities')
            .select('variant_definition_id, branch_id, quantity')
            .in('variant_definition_id', chunk)
        );

        const quantitiesResults = await Promise.all(quantitiesPromises);
        const quantities: any[] = [];

        quantitiesResults.forEach((result, idx) => {
          if (result.error) {
            console.warn(`Error fetching variant quantities batch ${idx}:`, result.error);
          } else if (result.data) {
            quantities.push(...result.data);
          }
        });

        // Build variants array from definitions + quantities
        if (quantities && quantities.length > 0) {
          variants = quantities.map(qty => {
            const definition = variantDefinitions.find(d => d.id === qty.variant_definition_id);
            if (!definition) return null;

            return {
              product_id: definition.product_id,
              variant_type: definition.variant_type,
              name: definition.name,
              quantity: qty.quantity || 0,
              color_hex: definition.color_hex,
              color_name: definition.name, // Use name as color_name for compatibility
              image_url: definition.image_url,
              branch_id: qty.branch_id
            };
          }).filter(v => v !== null);
        }

        console.log(`✅ Loaded ${variants.length} variant quantities from ${variantDefinitions.length} definitions`);
      }

      console.timeEnd('⚡ Fetch products with inventory');

      // Group inventory, variants, videos, and color definitions by product ID for O(1) lookup
      const inventoryMap = new Map<string, any[]>();
      const variantsMap = new Map<string, any[]>();
      const videosMap = new Map<string, ProductVideo[]>();
      const colorsMap = new Map<string, any[]>();

      (inventory || []).forEach(item => {
        const existing = inventoryMap.get(item.product_id) || [];
        existing.push(item);
        inventoryMap.set(item.product_id, existing);
      });

      (variants || []).forEach(item => {
        const existing = variantsMap.get(item.product_id) || [];
        existing.push(item);
        variantsMap.set(item.product_id, existing);
      });

      (videos || []).forEach((item: any) => {
        const existing = videosMap.get(item.product_id) || [];
        existing.push(item as ProductVideo);
        videosMap.set(item.product_id, existing);
      });

      // Build productColors map from color definitions
      (variantDefinitions || [])
        .filter(d => d.variant_type === 'color')
        .forEach(colorDef => {
          const existing = colorsMap.get(colorDef.product_id) || [];
          existing.push({
            id: colorDef.id,
            name: colorDef.name || '',
            color: colorDef.color_hex || '#6B7280',
            image: colorDef.image_url || undefined
          });
          colorsMap.set(colorDef.product_id, existing);
        });

      // Build colors (with barcode) and shapes maps for BarcodePrintModal
      const colorsWithBarcodeMap = new Map<string, any[]>();
      const shapesMap = new Map<string, any[]>();

      (variantDefinitions || []).forEach(def => {
        if (def.variant_type === 'color' && def.color_hex && def.name) {
          const existing = colorsWithBarcodeMap.get(def.product_id) || [];
          existing.push({
            id: def.id,
            name: def.name,
            hex: def.color_hex,
            image_url: def.image_url,
            barcode: def.barcode || null,
          });
          colorsWithBarcodeMap.set(def.product_id, existing);
        }
        if (def.variant_type === 'shape' && def.name) {
          const existing = shapesMap.get(def.product_id) || [];
          existing.push({
            id: def.id,
            name: def.name,
            image_url: def.image_url,
            barcode: def.barcode || null,
          });
          shapesMap.set(def.product_id, existing);
        }
      });

      // Enrich products with computed data (client-side - fast!)
      const enrichedProducts: Product[] = rawProducts.map((product: any) => {
        const productInventory = inventoryMap.get(product.id) || [];
        const productVariants = variantsMap.get(product.id) || [];
        const productVideos = videosMap.get(product.id) || [];
        const productColors = colorsMap.get(product.id) || [];

        // Calculate total stock
        let totalQuantity = 0;
        productInventory.forEach((inv: any) => {
          const locationId = inv.branch_id || inv.warehouse_id;
          // Only count if no branch filter, or if branch is in selected branches
          if (selectedBranches.length === 0 || selectedBranches.includes(locationId)) {
            totalQuantity += inv.quantity || 0;
          }
        });

        // Group inventory by branch for easy lookup
        const inventoryData: Record<string, any> = {};
        productInventory.forEach((inv: any) => {
          const locationId = inv.branch_id || inv.warehouse_id;
          if (locationId) {
            inventoryData[locationId] = {
              quantity: inv.quantity || 0,
              min_stock: inv.min_stock || 0,
              audit_status: inv.audit_status || 'غير مجرود',
            };
          }
        });

        // Group variants by branch
        const variantsData: Record<string, any[]> = {};
        productVariants.forEach((variant: any) => {
          if (variant.branch_id) {
            if (!variantsData[variant.branch_id]) {
              variantsData[variant.branch_id] = [];
            }
            variantsData[variant.branch_id].push(variant);
          }
        });

        // ✨ Process product images (main + sub + additional + variants)
        const allProductImages: string[] = [];
        if (product.main_image_url) allProductImages.push(product.main_image_url);
        if (product.sub_image_url) allProductImages.push(product.sub_image_url);

        // ✨ Add additional images from JSONB field
        const additionalImages = (product as any).additional_images_urls;
        if (additionalImages && Array.isArray(additionalImages)) {
          additionalImages.forEach((imgUrl: string) => {
            if (imgUrl && imgUrl.trim() !== '') {
              allProductImages.push(imgUrl);
            }
          });
        }

        // Add variant images
        productVariants.forEach((variant: any) => {
          if (variant.image_url) allProductImages.push(variant.image_url);
        });

        // Remove duplicates
        const allImages = Array.from(new Set(allProductImages.filter(img => img && img.trim() !== '')));

        // Calculate discount information
        const now = new Date();
        const discountStart = product.discount_start_date ? new Date(product.discount_start_date) : null;
        const discountEnd = product.discount_end_date ? new Date(product.discount_end_date) : null;

        const isDiscountActive = (
          (product.discount_percentage > 0 || product.discount_amount > 0) &&
          (!discountStart || now >= discountStart) &&
          (!discountEnd || now <= discountEnd)
        );

        let finalPrice = product.price;
        let discountLabel = '';

        if (isDiscountActive) {
          if (product.discount_percentage > 0) {
            finalPrice = product.price * (1 - (product.discount_percentage / 100));
            discountLabel = `-${product.discount_percentage}%`;
          } else if (product.discount_amount > 0) {
            finalPrice = Math.max(0, product.price - product.discount_amount);
            discountLabel = `-${product.discount_amount}`;
          }
        }

        // ✨ Map additional_images for export (from additional_images_urls)
        const exportAdditionalImages = (product as any).additional_images_urls || [];

        return {
          ...product,
          totalQuantity,
          inventoryData,
          variantsData,
          productColors, // ✨ Colors from variant definitions
          colors: colorsWithBarcodeMap.get(product.id) || [],
          shapes: shapesMap.get(product.id) || [],
          allImages,
          additional_images: exportAdditionalImages, // ✨ For export modal
          productVideos: productVideos, // ✨ Videos from product_videos table
          finalPrice,
          isDiscounted: isDiscountActive,
          discountLabel,
        };
      });

      console.log('✅ Enriched products ready:', enrichedProducts.length);

      setProducts(enrichedProducts);
      setLastFetch(now);
    } catch (err) {
      console.error('❌ Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'فشل في جلب المنتجات');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranches, lastFetch]);

  // Initial fetch
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ✨ Create new product
  const createProduct = useCallback(async (productData: Partial<Product>): Promise<Product | null> => {
    try {
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
          product_code: productData.product_code,
          wholesale_price: productData.wholesale_price || 0,
          price1: productData.price1 || 0,
          price2: productData.price2 || 0,
          price3: productData.price3 || 0,
          price4: productData.price4 || 0,
          quantity_per_carton: productData.quantity_per_carton,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          additional_images_urls: (productData as any).additional_images || productData.additional_images_urls || [],
          video_url: (productData as any).video_url || null,
          barcodes: productData.barcodes || [],
          unit: productData.unit || 'قطعة',
          is_active: true
        })
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .single()

      if (error) throw error
      return data as Product
    } catch (err) {
      console.error('Error creating product:', err)
      throw err
    }
  }, [])

  // ✨ Update existing product
  const updateProduct = useCallback(async (productId: string, productData: Partial<Product>): Promise<Product | null> => {
    try {
      // Map additional_images field to additional_images_urls
      const additionalImagesValue = (productData as any).additional_images || productData.additional_images_urls
      const videoUrlValue = (productData as any).actualVideoUrl !== undefined ? (productData as any).actualVideoUrl : (productData as any).video_url

      const { data, error } = await supabase
        .from('products')
        .update({
          name: productData.name,
          name_en: productData.name_en,
          description: productData.description,
          description_en: productData.description_en,
          barcode: productData.barcode,
          price: productData.price,
          cost_price: productData.cost_price,
          wholesale_price: productData.wholesale_price,
          price1: productData.price1,
          price2: productData.price2,
          price3: productData.price3,
          price4: productData.price4,
          quantity_per_carton: productData.quantity_per_carton,
          category_id: productData.category_id,
          product_code: productData.product_code,
          main_image_url: productData.main_image_url,
          sub_image_url: productData.sub_image_url,
          additional_images_urls: additionalImagesValue,
          video_url: videoUrlValue,
          barcodes: productData.barcodes,
          unit: productData.unit,
          is_active: productData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .single()

      if (error) throw error
      return data as Product
    } catch (err) {
      console.error('Error updating product:', err)
      throw err
    }
  }, [])

  // ✨ Get product usage statistics before deletion
  const getProductUsageStats = useCallback(async (productId: string): Promise<{
    salesInvoices: number;
    salesReturns: number;
    purchaseInvoices: number;
    purchaseReturns: number;
    orders: number;
    totalQuantitySold: number;
    currentStock: number;
    hasUsage: boolean;
  }> => {
    try {
      // Get all sale items for this product with their sale info
      const { data: saleItems, error: saleError } = await supabase
        .from('sale_items')
        .select('id, quantity, sale_id')
        .eq('product_id', productId)

      if (saleError) {
        console.error('Error fetching sale_items:', saleError)
      }

      let salesInvoices = 0
      let salesReturns = 0
      let totalQuantitySold = 0

      // If we have sale items, get their invoice types
      if (saleItems && saleItems.length > 0) {
        const saleIds = Array.from(new Set(saleItems.map((item: any) => item.sale_id)))

        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('id, invoice_type')
          .in('id', saleIds)

        if (!salesError && salesData) {
          const salesMap = new Map(salesData.map((s: any) => [s.id, s.invoice_type]))

          for (const item of saleItems) {
            const invoiceType = salesMap.get(item.sale_id)
            if (invoiceType === 'Sales Return') {
              salesReturns++
            } else {
              salesInvoices++
              totalQuantitySold += (item.quantity || 0)
            }
          }
        } else {
          // If can't get invoice types, count all as sales
          salesInvoices = saleItems.length
          totalQuantitySold = saleItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        }
      }

      // Get purchase invoice items count
      const { data: purchaseItems, error: purchaseError } = await supabase
        .from('purchase_invoice_items')
        .select('id, purchase_invoice_id')
        .eq('product_id', productId)

      if (purchaseError) {
        console.error('Error fetching purchase_invoice_items:', purchaseError)
      }

      let purchaseInvoices = 0
      let purchaseReturns = 0

      // If we have purchase items, get their invoice types
      if (purchaseItems && purchaseItems.length > 0) {
        const purchaseIds = Array.from(new Set(purchaseItems.map((item: any) => item.purchase_invoice_id)))

        const { data: purchasesData, error: purchasesError } = await supabase
          .from('purchase_invoices')
          .select('id, invoice_type')
          .in('id', purchaseIds)

        if (!purchasesError && purchasesData) {
          const purchasesMap = new Map(purchasesData.map((p: any) => [p.id, p.invoice_type]))

          for (const item of purchaseItems) {
            const invoiceType = purchasesMap.get(item.purchase_invoice_id)
            if (invoiceType === 'Purchase Return') {
              purchaseReturns++
            } else {
              purchaseInvoices++
            }
          }
        } else {
          // If can't get invoice types, count all as purchases
          purchaseInvoices = purchaseItems.length
        }
      }

      // Get orders count
      const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)

      if (orderError) {
        console.error('Error fetching order_items:', orderError)
      }

      const orders = (orderItems || []).length

      // Get current stock from inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId)

      if (inventoryError) {
        console.error('Error fetching inventory:', inventoryError)
      }

      const currentStock = (inventoryData || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)

      const hasUsage = salesInvoices > 0 || salesReturns > 0 || purchaseInvoices > 0 || purchaseReturns > 0 || orders > 0

      return {
        salesInvoices,
        salesReturns,
        purchaseInvoices,
        purchaseReturns,
        orders,
        totalQuantitySold,
        currentStock,
        hasUsage
      }
    } catch (err) {
      console.error('Error getting product usage stats:', err)
      // Return empty stats instead of throwing to allow the flow to continue
      return {
        salesInvoices: 0,
        salesReturns: 0,
        purchaseInvoices: 0,
        purchaseReturns: 0,
        orders: 0,
        totalQuantitySold: 0,
        currentStock: 0,
        hasUsage: false
      }
    }
  }, [])

  // ✨ Delete product (soft delete if in invoices, hard delete otherwise)
  const deleteProduct = useCallback(async (productId: string, forceSoftDelete: boolean = false): Promise<void> => {
    try {
      const stats = await getProductUsageStats(productId)

      if (stats.hasUsage) {
        if (!forceSoftDelete) {
          // Return an error with usage stats so the UI can show details
          const error = new Error('PRODUCT_HAS_USAGE') as any
          error.usageStats = stats
          throw error
        }

        // Soft delete - just mark as deleted
        const { error } = await supabase
          .from('products')
          .update({ is_deleted: true } as any)
          .eq('id', productId)

        if (error) throw error
      } else {
        // Hard delete - no references found
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId)

        if (error) throw error
      }
    } catch (err) {
      console.error('Error deleting product:', err)
      throw err
    }
  }, [getProductUsageStats])

  // ✨ Hide product (soft delete always - just marks as deleted without checking usage)
  const hideProduct = useCallback(async (productId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_deleted: true } as any)
        .eq('id', productId)

      if (error) throw error
    } catch (err) {
      console.error('Error hiding product:', err)
      throw err
    }
  }, [])

  // ✨ Fetch a single product with all enrichments (for smart real-time updates)
  const fetchSingleProduct = useCallback(async (productId: string): Promise<Product | null> => {
    try {
      // Fetch product with category
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          id, name, barcode, price, cost_price, main_image_url, sub_image_url,
          additional_images_urls, category_id, is_active, display_order, stock,
          min_stock, max_stock, unit, description, wholesale_price, price1, price2,
          price3, price4, quantity_per_carton, product_code, rating, rating_count, discount_percentage, discount_amount,
          discount_start_date, discount_end_date,
          categories (id, name)
        `)
        .eq('id', productId)
        .eq('is_active', true)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .single();

      if (productError || !product) return null;

      // Fetch inventory, variants, and videos for this product
      const [inventoryResult, variantDefsResult, videosResult] = await Promise.all([
        supabase.from('inventory').select('product_id, branch_id, warehouse_id, quantity, min_stock, audit_status').eq('product_id', productId),
        supabase.from('product_color_shape_definitions').select('id, product_id, variant_type, name, color_hex, image_url, barcode, sort_order').eq('product_id', productId),
        (supabase as any).from('product_videos').select('id, product_id, video_url, thumbnail_url, video_name, video_size, duration, sort_order, created_at').eq('product_id', productId).order('sort_order', { ascending: true })
      ]);

      const productInventory = inventoryResult.data || [];
      const variantDefinitions = variantDefsResult.data || [];
      const productVideos: ProductVideo[] = videosResult.data || [];

      // Fetch variant quantities if there are definitions
      let productVariants: any[] = [];
      if (variantDefinitions.length > 0) {
        const definitionIds = variantDefinitions.map(d => d.id);
        const { data: quantities } = await supabase
          .from('product_variant_quantities')
          .select('variant_definition_id, branch_id, quantity')
          .in('variant_definition_id', definitionIds);

        if (quantities) {
          productVariants = quantities.map(qty => {
            const definition = variantDefinitions.find(d => d.id === qty.variant_definition_id);
            if (!definition) return null;
            return {
              product_id: definition.product_id,
              variant_type: definition.variant_type,
              name: definition.name,
              quantity: qty.quantity || 0,
              color_hex: definition.color_hex,
              color_name: definition.name,
              image_url: definition.image_url,
              branch_id: qty.branch_id
            };
          }).filter(v => v !== null);
        }
      }

      // Build productColors from color definitions
      const productColors = variantDefinitions
        .filter(d => d.variant_type === 'color')
        .map(colorDef => ({
          id: colorDef.id,
          name: colorDef.name || '',
          color: colorDef.color_hex || '#6B7280',
          image: colorDef.image_url || undefined
        }));

      // Build colors (with barcode) and shapes for BarcodePrintModal
      const colors = variantDefinitions
        .filter(d => d.variant_type === 'color' && d.color_hex && d.name)
        .map(def => ({
          id: def.id,
          name: def.name,
          hex: def.color_hex,
          image_url: def.image_url,
          barcode: def.barcode || null,
        }));

      const shapes = variantDefinitions
        .filter(d => d.variant_type === 'shape' && d.name)
        .map(def => ({
          id: def.id,
          name: def.name,
          image_url: def.image_url,
          barcode: def.barcode || null,
        }));

      // Calculate total stock
      let totalQuantity = 0;
      productInventory.forEach((inv: any) => {
        const locationId = inv.branch_id || inv.warehouse_id;
        if (selectedBranches.length === 0 || selectedBranches.includes(locationId)) {
          totalQuantity += inv.quantity || 0;
        }
      });

      // Group inventory by branch
      const inventoryData: Record<string, any> = {};
      productInventory.forEach((inv: any) => {
        const locationId = inv.branch_id || inv.warehouse_id;
        if (locationId) {
          inventoryData[locationId] = {
            quantity: inv.quantity || 0,
            min_stock: inv.min_stock || 0,
            audit_status: inv.audit_status || 'غير مجرود',
          };
        }
      });

      // Group variants by branch
      const variantsData: Record<string, any[]> = {};
      productVariants.forEach((variant: any) => {
        if (variant.branch_id) {
          if (!variantsData[variant.branch_id]) {
            variantsData[variant.branch_id] = [];
          }
          variantsData[variant.branch_id].push(variant);
        }
      });

      // Process all images
      const allProductImages: string[] = [];
      if (product.main_image_url) allProductImages.push(product.main_image_url);
      if (product.sub_image_url) allProductImages.push(product.sub_image_url);
      const additionalImages = (product as any).additional_images_urls;
      if (additionalImages && Array.isArray(additionalImages)) {
        additionalImages.forEach((imgUrl: string) => {
          if (imgUrl && imgUrl.trim() !== '') allProductImages.push(imgUrl);
        });
      }
      productVariants.forEach((variant: any) => {
        if (variant.image_url) allProductImages.push(variant.image_url);
      });
      const allImages = Array.from(new Set(allProductImages.filter(img => img && img.trim() !== '')));

      // Calculate discount info
      const now = new Date();
      const discountStart = product.discount_start_date ? new Date(product.discount_start_date) : null;
      const discountEnd = product.discount_end_date ? new Date(product.discount_end_date) : null;
      const discountPercentage = product.discount_percentage || 0;
      const discountAmount = product.discount_amount || 0;
      const isDiscountActive = (
        (discountPercentage > 0 || discountAmount > 0) &&
        (!discountStart || now >= discountStart) &&
        (!discountEnd || now <= discountEnd)
      );

      let finalPrice = product.price;
      let discountLabel = '';
      if (isDiscountActive) {
        if (discountPercentage > 0) {
          finalPrice = product.price * (1 - (discountPercentage / 100));
          discountLabel = `-${discountPercentage}%`;
        } else if (discountAmount > 0) {
          finalPrice = Math.max(0, product.price - discountAmount);
          discountLabel = `-${discountAmount}`;
        }
      }

      return {
        ...product,
        totalQuantity,
        inventoryData,
        variantsData,
        productColors,
        colors,
        shapes,
        allImages,
        additional_images: additionalImages || [],
        productVideos,
        finalPrice,
        isDiscounted: isDiscountActive,
        discountLabel,
      } as Product;
    } catch (err) {
      console.error('❌ Error fetching single product:', err);
      return null;
    }
  }, [selectedBranches]);

  // ✨ Update inventory for a single product (for smart real-time updates)
  const updateProductInventory = useCallback(async (productId: string): Promise<void> => {
    try {
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, branch_id, warehouse_id, quantity, min_stock, audit_status')
        .eq('product_id', productId);

      if (!inventoryData) return;

      // Calculate total quantity and inventory map
      let totalQuantity = 0;
      const inventoryMap: Record<string, any> = {};

      inventoryData.forEach((inv: any) => {
        const locationId = inv.branch_id || inv.warehouse_id;
        if (selectedBranches.length === 0 || selectedBranches.includes(locationId)) {
          totalQuantity += inv.quantity || 0;
        }
        if (locationId) {
          inventoryMap[locationId] = {
            quantity: inv.quantity || 0,
            min_stock: inv.min_stock || 0,
            audit_status: inv.audit_status || 'غير مجرود',
          };
        }
      });

      // Update only this product in the state (no full refetch!)
      setProducts(prev => prev.map(p =>
        p.id === productId
          ? { ...p, totalQuantity, inventoryData: inventoryMap }
          : p
      ));
    } catch (err) {
      console.error('❌ Error updating product inventory:', err);
    }
  }, [selectedBranches]);

  // ✨ Real-time updates (SMART - selective updates without full refetch)
  useEffect(() => {
    console.log('🔴 Setting up smart real-time subscriptions');

    // Handler for product changes - SMART selective update
    const handleProductChange = async (payload: any) => {
      console.log('📡 Products change detected:', payload.eventType);

      if (payload.eventType === 'INSERT') {
        // New product - fetch and add to list
        const productId = payload.new?.id;
        if (productId) {
          const newProduct = await fetchSingleProduct(productId);
          if (newProduct) {
            setProducts(prev => [...prev, newProduct]);
            console.log('✅ New product added:', newProduct.name);
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        // Updated product - fetch and merge
        const productId = payload.new?.id;
        if (productId) {
          const updatedProduct = await fetchSingleProduct(productId);
          if (updatedProduct) {
            setProducts(prev => prev.map(p =>
              p.id === productId ? updatedProduct : p
            ));
            console.log('✅ Product updated:', updatedProduct.name);
          } else {
            // Product might have been deactivated/deleted - remove from list
            setProducts(prev => prev.filter(p => p.id !== productId));
            console.log('🗑️ Product removed from list (deactivated or deleted)');
          }
        }
      } else if (payload.eventType === 'DELETE') {
        // Deleted product - remove from list
        const productId = payload.old?.id;
        if (productId) {
          setProducts(prev => prev.filter(p => p.id !== productId));
          console.log('🗑️ Product removed:', productId);
        }
      }
    };

    // Handler for inventory changes - SMART selective update
    const handleInventoryChange = async (payload: any) => {
      console.log('📡 Inventory change detected:', payload.eventType);

      const productId = payload.new?.product_id || payload.old?.product_id;
      if (!productId) return;

      // Fetch updated inventory for this specific product
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, branch_id, warehouse_id, quantity, min_stock, audit_status')
        .eq('product_id', productId);

      if (!inventoryData) return;

      // Calculate total quantity and inventory map
      let totalQuantity = 0;
      const inventoryMap: Record<string, any> = {};

      inventoryData.forEach((inv: any) => {
        const locationId = inv.branch_id || inv.warehouse_id;
        if (selectedBranches.length === 0 || selectedBranches.includes(locationId)) {
          totalQuantity += inv.quantity || 0;
        }
        if (locationId) {
          inventoryMap[locationId] = {
            quantity: inv.quantity || 0,
            min_stock: inv.min_stock || 0,
            audit_status: inv.audit_status || 'غير مجرود',
          };
        }
      });

      // Update only this product in the state (NO full refetch!)
      setProducts(prev => prev.map(p =>
        p.id === productId
          ? { ...p, totalQuantity, inventoryData: inventoryMap }
          : p
      ));
      console.log('✅ Inventory updated for product:', productId);
    };

    // Subscribe to products changes
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'elfaroukgroup',
          table: 'products',
        },
        handleProductChange
      )
      .subscribe();

    // Subscribe to inventory changes
    const inventoryChannel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'elfaroukgroup',
          table: 'inventory',
        },
        handleInventoryChange
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      console.log('🔴 Cleaning up real-time subscriptions');
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, [fetchSingleProduct, selectedBranches]);

  return {
    products,
    setProducts, // ✨ Expose setProducts for optimistic updates
    branches, // ✨ Expose branches for UI components
    isLoading,
    error,
    fetchProducts: () => fetchProducts(true), // Force refetch
    fetchSingleProduct, // ✨ Expose for manual single product refresh
    createProduct, // ✨ Expose createProduct
    updateProduct, // ✨ Expose updateProduct
    deleteProduct, // ✨ Expose deleteProduct
    hideProduct, // ✨ Expose hideProduct for soft delete without usage check
    getProductUsageStats, // ✨ Expose getProductUsageStats for detailed deletion info
  };
}
