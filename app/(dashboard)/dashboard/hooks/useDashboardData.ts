'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import {
  fetchKPIs,
  fetchSalesTrend,
  fetchTopProducts,
  fetchTopCustomers,
} from '../../reports/services/reportsService';
import { KPIData, SalesTrendPoint, TopProductData, TopCustomerData, DateFilter } from '../../reports/types/reports';

// Recent Order interface
export interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

// Low Stock Product interface
export interface LowStockProduct {
  id: string;
  name: string;
  quantity: number;
  min_stock: number;
  branch_name?: string;
}

// Dashboard Data interface
export interface DashboardData {
  kpis: KPIData | null;
  salesTrend: SalesTrendPoint[];
  topProducts: TopProductData[];
  topCustomers: TopCustomerData[];
  recentOrders: RecentOrder[];
  lowStockProducts: LowStockProduct[];
}

// Initial empty state
const initialData: DashboardData = {
  kpis: null,
  salesTrend: [],
  topProducts: [],
  topCustomers: [],
  recentOrders: [],
  lowStockProducts: [],
};

// Fetch recent orders
const fetchRecentOrders = async (limit: number = 5): Promise<RecentOrder[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, total_amount, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent orders:', error);
    return [];
  }

  return (data || []).map((order: any) => ({
    id: order.id,
    order_number: order.order_number || `#${order.id.slice(0, 8)}`,
    customer_name: order.customer_name || 'عميل غير معروف',
    total_amount: parseFloat(order.total_amount) || 0,
    status: order.status || 'pending',
    created_at: order.created_at,
  }));
};

// Fetch low stock products
const fetchLowStockProducts = async (limit: number = 10): Promise<LowStockProduct[]> => {
  const { data, error } = await supabase
    .from('branch_stocks')
    .select(`
      quantity,
      min_stock,
      product_id,
      branch_id,
      products!inner(id, name),
      branches(name)
    `)
    .order('quantity', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Error fetching low stock products:', error);
    return [];
  }

  // Filter products where quantity < min_stock
  const lowStock = (data || [])
    .filter((item: any) => {
      const qty = parseFloat(item.quantity) || 0;
      const minStock = parseFloat(item.min_stock) || 0;
      return qty < minStock && minStock > 0;
    })
    .map((item: any) => ({
      id: item.products?.id || item.product_id,
      name: item.products?.name || 'منتج غير معروف',
      quantity: parseFloat(item.quantity) || 0,
      min_stock: parseFloat(item.min_stock) || 0,
      branch_name: item.branches?.name,
    }))
    .slice(0, limit);

  return lowStock;
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const todayFilter: DateFilter = { type: 'today' };
  const weekFilter: DateFilter = { type: 'current_week' };
  const monthFilter: DateFilter = { type: 'current_month' };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [
        kpisResult,
        salesTrendResult,
        topProductsResult,
        topCustomersResult,
        recentOrdersResult,
        lowStockResult,
      ] = await Promise.allSettled([
        fetchKPIs(todayFilter),
        fetchSalesTrend(weekFilter, 7),
        fetchTopProducts(monthFilter, 5),
        fetchTopCustomers(monthFilter, 5),
        fetchRecentOrders(5),
        fetchLowStockProducts(10),
      ]);

      setData({
        kpis: kpisResult.status === 'fulfilled' ? kpisResult.value : null,
        salesTrend: salesTrendResult.status === 'fulfilled' ? salesTrendResult.value : [],
        topProducts: topProductsResult.status === 'fulfilled' ? topProductsResult.value : [],
        topCustomers: topCustomersResult.status === 'fulfilled' ? topCustomersResult.value : [],
        recentOrders: recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : [],
        lowStockProducts: lowStockResult.status === 'fulfilled' ? lowStockResult.value : [],
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}

export default useDashboardData;
