'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../app/lib/supabase/client';

export interface StoreCategory {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  image_url: string | null;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  is_all_category?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}

export interface StoreCategoryProduct {
  id: string;
  store_category_id: string;
  product_id: string;
  sort_order: number;
  added_at: string;
  added_by?: string;
}

export interface CreateStoreCategoryData {
  name: string;
  name_en?: string;
  description?: string;
  image_url?: string;
  color?: string;
  product_ids: string[];
}

export function useStoreCategories() {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all store categories
  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('store_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching store categories:', error);
      setError(error instanceof Error ? error.message : 'خطأ في تحميل فئات المتجر');
    } finally {
      setIsLoading(false);
    }
  };


  // Create new store category
  const createCategory = async (categoryData: CreateStoreCategoryData) => {
    try {
      setError(null);

      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get next sort order
      const { data: lastCategory } = await supabase
        .from('store_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const nextSortOrder = (lastCategory?.sort_order || 0) + 1;

      // Create category
      const { data: category, error: categoryError } = await supabase
        .from('store_categories')
        .insert({
          name: categoryData.name,
          name_en: categoryData.name_en,
          description: categoryData.description,
          image_url: categoryData.image_url,
          color: categoryData.color || '#3B82F6',
          sort_order: nextSortOrder,
          created_by: user?.id
        })
        .select()
        .single();

      if (categoryError) throw categoryError;

      // Add products to category if provided
      if (categoryData.product_ids.length > 0) {
        const productLinks = categoryData.product_ids.map((productId, index) => ({
          store_category_id: category.id,
          product_id: productId,
          sort_order: index,
          added_by: user?.id
        }));

        const { error: linksError } = await supabase
          .from('store_category_products')
          .insert(productLinks);

        if (linksError) {
          console.error('Error linking products:', linksError);
          // Don't throw here, category is created successfully
        }
      }

      // Refresh categories list
      await fetchCategories();

      return category;
    } catch (error) {
      console.error('Error creating store category:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في إنشاء فئة المتجر';
      setError(errorMessage);
      throw error;
    }
  };

  // Update category
  const updateCategory = async (categoryId: string, updates: Partial<StoreCategory>) => {
    try {
      setError(null);

      const { data, error } = await supabase
        .from('store_categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setCategories(prev =>
        prev.map(cat => cat.id === categoryId ? { ...cat, ...data } : cat)
      );

      return data;
    } catch (error) {
      console.error('Error updating store category:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في تحديث فئة المتجر';
      setError(errorMessage);
      throw error;
    }
  };

  // Delete category
  const deleteCategory = async (categoryId: string) => {
    try {
      setError(null);

      // Check if this is the "الكل" category - prevent deletion
      const categoryToDelete = categories.find(cat => cat.id === categoryId);
      if (categoryToDelete?.is_all_category) {
        throw new Error('لا يمكن حذف فئة "الكل" - هذه فئة أساسية في النظام');
      }

      const { error } = await supabase
        .from('store_categories')
        .delete()
        .eq('id', categoryId)
        .eq('is_all_category', false); // Additional safety check

      if (error) throw error;

      // Update local state
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    } catch (error) {
      console.error('Error deleting store category:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في حذف فئة المتجر';
      setError(errorMessage);
      throw error;
    }
  };

  // Add products to category
  const addProductsToCategory = async (categoryId: string, productIds: string[]) => {
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      // Get current products count for sort order
      const { data: existingProducts } = await supabase
        .from('store_category_products')
        .select('sort_order')
        .eq('store_category_id', categoryId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const startSortOrder = (existingProducts?.[0]?.sort_order || -1) + 1;

      const productLinks = productIds.map((productId, index) => ({
        store_category_id: categoryId,
        product_id: productId,
        sort_order: startSortOrder + index,
        added_by: user?.id
      }));

      const { error } = await supabase
        .from('store_category_products')
        .insert(productLinks);

      if (error) throw error;

    } catch (error) {
      console.error('Error adding products to category:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في إضافة المنتجات للفئة';
      setError(errorMessage);
      throw error;
    }
  };

  // Remove products from category
  const removeProductsFromCategory = async (categoryId: string, productIds: string[]) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('store_category_products')
        .delete()
        .eq('store_category_id', categoryId)
        .in('product_id', productIds);

      if (error) throw error;

    } catch (error) {
      console.error('Error removing products from category:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في حذف المنتجات من الفئة';
      setError(errorMessage);
      throw error;
    }
  };

  // Get products in category
  const getCategoryProducts = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('store_category_products')
        .select(`
          *,
          products (
            id,
            name,
            name_en,
            main_image_url,
            price,
            is_active
          )
        `)
        .eq('store_category_id', categoryId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching category products:', error);
      throw error;
    }
  };

  // Reorder categories
  const reorderCategories = async (reorderedCategories: StoreCategory[]) => {
    try {
      setError(null);

      const updates = reorderedCategories.map((category, index) => ({
        id: category.id,
        sort_order: index,
        updated_at: new Date().toISOString()
      }));

      // Update each category's sort order
      const updatePromises = updates.map(update =>
        supabase
          .from('store_categories')
          .update({
            sort_order: update.sort_order,
            updated_at: update.updated_at
          })
          .eq('id', update.id)
      );

      const results = await Promise.all(updatePromises);

      // Check for errors
      const errors = results.filter((result: any) => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} categories`);
      }

      // Update local state
      setCategories(reorderedCategories.map((cat, index) => ({
        ...cat,
        sort_order: index
      })));

    } catch (error) {
      console.error('Error reordering store categories:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ في إعادة ترتيب فئات المتجر';
      setError(errorMessage);
      throw error;
    }
  };

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    isLoading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    addProductsToCategory,
    removeProductsFromCategory,
    getCategoryProducts,
    reorderCategories
  };
}

// Hook for getting categories with their products
export function useStoreCategoriesWithProducts() {
  const [categoriesWithProducts, setCategoriesWithProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoriesWithProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('store_categories')
        .select(`
          *,
          store_category_products (
            sort_order,
            products (
              id,
              name,
              name_en,
              main_image_url,
              price,
              is_active,
              is_hidden
            )
          )
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Process data to include products directly
      const processedData = data?.map((category: any) => ({
        ...category,
        products: category.store_category_products
          ?.map((link: any) => link.products)
          .filter(Boolean)
          .filter((product: any) => product.is_active && !product.is_hidden)
          .sort((a: any, b: any) => a.sort_order - b.sort_order) || []
      })) || [];

      setCategoriesWithProducts(processedData);
    } catch (error) {
      console.error('Error fetching store categories with products:', error);
      setError(error instanceof Error ? error.message : 'خطأ في تحميل فئات المتجر مع المنتجات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoriesWithProducts();
  }, []);

  return {
    categoriesWithProducts,
    isLoading,
    error,
    fetchCategoriesWithProducts
  };
}