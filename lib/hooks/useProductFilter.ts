'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import { DisplayMode, ProductDisplaySettings } from './useProductDisplaySettings';

export interface Product {
  id: string;
  name: string;
  price?: number;
  description?: string;
  image?: string;
  [key: string]: any;
}

export interface ProductWithInventory extends Product {
  total_inventory?: number;
  is_available?: boolean;
}

// ✨ SINGLETON: Cache settings globally to prevent multiple loads
let cachedSettings: ProductDisplaySettings | null = null;
let settingsPromise: Promise<ProductDisplaySettings> | null = null;

// Function to load settings only once
const loadSettingsOnce = async (): Promise<ProductDisplaySettings> => {
  // If already cached, return immediately
  if (cachedSettings) {
    console.log('🎯 [useProductFilter] Using cached settings:', cachedSettings);
    return cachedSettings;
  }

  // If already loading, wait for the existing promise
  if (settingsPromise) {
    console.log('⏳ [useProductFilter] Waiting for existing settings load...');
    return settingsPromise;
  }

  // Start loading
  settingsPromise = (async () => {
    try {
      console.log('⚙️ [useProductFilter] Loading product display settings (ONCE)...');
      const { data, error } = await (supabase as any)
        .from('product_display_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ [useProductFilter] Error loading display settings:', error);
        cachedSettings = { display_mode: 'show_all', selected_warehouses: [], selected_branches: [] };
      } else if (data) {
        console.log('✅ [useProductFilter] Display settings loaded from database:', data);
        cachedSettings = {
          display_mode: data.display_mode,
          selected_warehouses: data.selected_warehouses || [],
          selected_branches: data.selected_branches || []
        };
        console.log('📝 [useProductFilter] Cached settings:', cachedSettings);
      } else {
        console.log('⚠️ [useProductFilter] No settings found, using defaults');
        cachedSettings = { display_mode: 'show_all', selected_warehouses: [], selected_branches: [] };
      }

      return cachedSettings;
    } catch (error) {
      console.error('❌ [useProductFilter] Error:', error);
      cachedSettings = { display_mode: 'show_all', selected_warehouses: [], selected_branches: [] };
      return cachedSettings;
    } finally {
      settingsPromise = null;
    }
  })();

  return settingsPromise;
};

// Function to clear cached settings (call after settings are updated)
export function clearSettingsCache() {
  cachedSettings = null;
  settingsPromise = null;
  console.log('🗑️ [useProductFilter] Cache cleared');
}

export function useProductFilter() {
  const [displaySettings, setDisplaySettings] = useState<ProductDisplaySettings>({
    display_mode: 'show_all',
    selected_warehouses: [],
    selected_branches: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load display settings ONCE
  useEffect(() => {
    let isMounted = true;

    loadSettingsOnce().then(settings => {
      if (isMounted) {
        setDisplaySettings(settings);
        setIsLoading(false);
        console.log('✅ [useProductFilter] Settings applied to component');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Function to get inventory for a product
  const getProductInventory = async (productId: string): Promise<number> => {
    try {
      const { display_mode, selected_warehouses, selected_branches } = displaySettings;

      console.log('🔍 [getProductInventory] Called for product:', productId);
      console.log('📊 [getProductInventory] Display mode:', display_mode);
      console.log('🏢 [getProductInventory] Selected branches:', selected_branches?.length || 0, selected_branches);
      console.log('📦 [getProductInventory] Selected warehouses:', selected_warehouses?.length || 0, selected_warehouses);

      // If mode is 'show_all', we don't need to check inventory
      if (display_mode === 'show_all') {
        console.log('✅ [getProductInventory] Mode is show_all, returning 1');
        return 1; // Return any positive number to indicate "available"
      }

      let query = (supabase as any)
        .from('inventory')
        .select('quantity, branch_id')
        .eq('product_id', productId);

      // ✨ FIXED: Combine warehouses and branches into one array since they're all in the branches table
      // and inventory only has branch_id field
      const selectedLocations = [
        ...(selected_warehouses || []),
        ...(selected_branches || [])
      ];

      const hasLocations = selectedLocations.length > 0;

      console.log('🏢 [getProductInventory] Total selected locations:', selectedLocations.length);
      console.log('🔑 [getProductInventory] Location IDs:', selectedLocations);

      // If specific locations are selected, filter by them
      if (hasLocations) {
        console.log('🔧 [getProductInventory] Applying filter for locations...');
        query = query.in('branch_id', selectedLocations);
      } else {
        console.log('⚠️ [getProductInventory] No locations selected, will fetch ALL inventory!');
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [getProductInventory] Error fetching inventory:', error);
        return 0;
      }

      console.log('📦 [getProductInventory] Raw inventory data:', data);

      // Calculate total inventory
      const totalInventory = (data || []).reduce((sum: number, item: any) => {
        console.log(`   - Branch ${item.branch_id}: quantity = ${item.quantity}`);
        return sum + (item.quantity || 0);
      }, 0);

      console.log('📊 [getProductInventory] Total inventory:', totalInventory);
      console.log(totalInventory > 0 ? '✅ [getProductInventory] Product WILL BE SHOWN' : '❌ [getProductInventory] Product WILL BE HIDDEN');

      return totalInventory;
    } catch (error) {
      console.error('❌ [getProductInventory] Error getting product inventory:', error);
      return 0;
    }
  };

  // Function to filter products based on display settings
  const filterProducts = useCallback(async (products: Product[]): Promise<ProductWithInventory[]> => {
    const { display_mode } = displaySettings;

    console.log('🎯 filterProducts called with', products.length, 'products');
    console.log('🎛️ Display mode:', display_mode);

    // If show_all, return all products
    if (display_mode === 'show_all') {
      console.log('✅ Mode is show_all, returning all products as available');
      return products.map(p => ({
        ...p,
        is_available: true,
        total_inventory: undefined
      }));
    }

    // For other modes, check inventory for each product
    console.log('🔄 Checking inventory for each product...');
    const productsWithInventory = await Promise.all(
      products.map(async (product) => {
        const inventory = await getProductInventory(product.id);
        const isAvailable = inventory > 0;

        console.log(`📦 Product ${product.name} (${product.id}): inventory=${inventory}, available=${isAvailable}`);

        return {
          ...product,
          total_inventory: inventory,
          is_available: isAvailable
        };
      })
    );

    console.log('📊 Products with inventory:', productsWithInventory.length);
    console.log('✅ Available products:', productsWithInventory.filter(p => p.is_available).length);
    console.log('❌ Unavailable products:', productsWithInventory.filter(p => !p.is_available).length);

    // Filter based on display mode
    if (display_mode === 'show_with_stock') {
      // Only show products with stock
      const filtered = productsWithInventory.filter(p => p.is_available);
      console.log('🎯 Filtering to show only products with stock:', filtered.length, 'products');
      return filtered;
    } else if (display_mode === 'show_with_stock_and_vote') {
      // Show all products, but mark which are out of stock
      console.log('🎯 Showing all products with vote option for out of stock');
      return productsWithInventory;
    }

    return productsWithInventory;
  }, [displaySettings]);

  // Function to check if a single product should be displayed
  const shouldDisplayProduct = async (product: Product): Promise<{ display: boolean; isAvailable: boolean; inventory: number }> => {
    const { display_mode } = displaySettings;

    // If show_all, always display
    if (display_mode === 'show_all') {
      return { display: true, isAvailable: true, inventory: 0 };
    }

    // Check inventory
    const inventory = await getProductInventory(product.id);
    const isAvailable = inventory > 0;

    // Determine if should display
    let shouldDisplay = true;
    if (display_mode === 'show_with_stock') {
      shouldDisplay = isAvailable;
    } else if (display_mode === 'show_with_stock_and_vote') {
      shouldDisplay = true; // Always display in this mode
    }

    return {
      display: shouldDisplay,
      isAvailable,
      inventory
    };
  };

  return {
    displaySettings,
    isLoading,
    filterProducts,
    shouldDisplayProduct,
    getProductInventory
  };
}
