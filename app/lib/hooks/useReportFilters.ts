'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { FilterOption, FilterGroup, ReportFiltersData } from '@/app/types/filters'

/**
 * Hook لجلب جميع بيانات الفلاتر المطلوبة للتقارير
 * يجلب البيانات مرة واحدة عند التحميل ويوفر دالة لإعادة الجلب
 */
export function useReportFilters(): ReportFiltersData & { refetch: () => Promise<void> } {
  const [data, setData] = useState<ReportFiltersData>({
    customers: [],
    customerGroups: [],
    users: [],
    products: [],
    categories: [],
    safes: [],
    branches: [],
    warehouses: [],
    isLoading: true,
    error: null
  })

  const fetchAllData = useCallback(async () => {
    setData(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // جلب جميع البيانات بالتوازي لتحسين الأداء
      const [
        customersRes,
        customerGroupsRes,
        usersRes,
        productsRes,
        categoriesRes,
        safesRes,
        branchesRes,
        warehousesRes
      ] = await Promise.all([
        // 1. العملاء
        supabase
          .from('customers')
          .select('id, name, phone')
          .order('name'),

        // 2. فئات العملاء
        supabase
          .from('customer_groups')
          .select('id, name, parent_id')
          .order('name'),

        // 3. المستخدمين (الموظفين)
        supabase
          .from('auth_users')
          .select('id, name, email'),

        // 4. المنتجات
        supabase
          .from('products')
          .select('id, name, category_id')
          .eq('is_active', true)
          .order('name'),

        // 5. فئات المنتجات
        supabase
          .from('categories')
          .select('id, name, parent_id')
          .order('name'),

        // 6. الخزن (من جدول records)
        supabase
          .from('records')
          .select('id, name')
          .order('name'),

        // 7. الفروع
        supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),

        // 8. المخازن
        supabase
          .from('warehouses')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
      ])

      // تحويل البيانات إلى الشكل المطلوب
      const customers: FilterOption[] = (customersRes.data || []).map(c => ({
        id: c.id,
        name: c.name || 'بدون اسم',
        secondaryText: c.phone || undefined
      }))

      const customerGroups: FilterGroup[] = (customerGroupsRes.data || []).map(g => ({
        id: g.id,
        name: g.name || 'بدون اسم',
        parentId: g.parent_id
      }))

      const users: FilterOption[] = (usersRes.data || []).map(u => ({
        id: u.id,
        name: u.name || u.email || 'بدون اسم',
        secondaryText: u.email || undefined
      }))

      const products: FilterOption[] = (productsRes.data || []).map(p => ({
        id: p.id,
        name: p.name || 'بدون اسم',
        groupId: p.category_id || undefined
      }))

      const categories: FilterGroup[] = (categoriesRes.data || []).map(c => ({
        id: c.id,
        name: c.name || 'بدون اسم',
        parentId: c.parent_id
      }))

      const safes: FilterOption[] = (safesRes.data || []).map(s => ({
        id: s.id,
        name: s.name || 'بدون اسم'
      }))

      const branches: FilterOption[] = (branchesRes.data || []).map(b => ({
        id: b.id,
        name: b.name || 'بدون اسم'
      }))

      const warehouses: FilterOption[] = (warehousesRes.data || []).map(w => ({
        id: w.id,
        name: w.name || 'بدون اسم'
      }))

      setData({
        customers,
        customerGroups,
        users,
        products,
        categories,
        safes,
        branches,
        warehouses,
        isLoading: false,
        error: null
      })

    } catch (err) {
      console.error('Error fetching filter data:', err)
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'فشل في تحميل بيانات الفلاتر'
      }))
    }
  }, [])

  // جلب البيانات عند التحميل الأول
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  return { ...data, refetch: fetchAllData }
}
