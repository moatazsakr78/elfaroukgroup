'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import { cache, CacheTTL } from '@/app/lib/cache/memoryCache';
import {
  fetchKPIs,
  fetchSalesTrend,
  fetchTopProducts,
  fetchTopCustomers,
  fetchCategoryDistribution,
  fetchSaleTypeBreakdown,
} from '../../reports/services/reportsService';
import { KPIData, SalesTrendPoint, TopProductData, TopCustomerData, CategoryDistribution, DateFilter, SaleTypeBreakdownData } from '../../reports/types/reports';
import { getDateRangeFromFilter } from '@/app/lib/utils/dateFilters';
import { toEgyptDateString } from '@/app/lib/utils/date-utils';
import {
  SimpleFiltersResult,
  MultiFiltersResult,
  ActiveFilterType,
  initialSimpleFilters,
  initialMultiFilters,
  getSimpleFiltersCount,
  getMultiFiltersCount,
} from '@/app/types/filters';

// Recent Order interface
export interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

// Branch Capital interface
export interface BranchCapital {
  id: string;
  name: string;
  type: 'branch' | 'warehouse';
  capital: number;
}

export interface CapitalData {
  totalCapital: number;
  branches: BranchCapital[];
}

// Dashboard Data interface
export interface DashboardData {
  kpis: KPIData | null;
  salesTrend: SalesTrendPoint[];
  topProducts: TopProductData[];
  topCustomers: TopCustomerData[];
  categoryDistribution: CategoryDistribution[];
  recentOrders: RecentOrder[];
  capitalData: CapitalData | null;
  saleTypeBreakdown: SaleTypeBreakdownData | null;
}

// Initial empty state
const initialData: DashboardData = {
  kpis: null,
  salesTrend: [],
  topProducts: [],
  topCustomers: [],
  categoryDistribution: [],
  recentOrders: [],
  capitalData: null,
  saleTypeBreakdown: null,
};

// Fetch recent orders
const fetchRecentOrders = async (dateFilter: DateFilter, limit: number = 5): Promise<RecentOrder[]> => {
  let query = supabase
    .from('orders')
    .select('id, order_number, customer_name, total_amount, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  const { startDate, endDate } = getDateRangeFromFilter(dateFilter);
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

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

// Fetch period purchases: sum of net_amount from purchase_invoices per branch/warehouse
const fetchPeriodPurchases = async (dateFilter: DateFilter): Promise<CapitalData> => {
  const { startDate, endDate } = getDateRangeFromFilter(dateFilter);

  let query = supabase
    .from('purchase_invoices')
    .select(`
      id,
      branch_id,
      warehouse_id,
      net_amount,
      branches(id, name),
      warehouses(id, name)
    `)
    .eq('invoice_type', 'Purchase Invoice');

  if (startDate) {
    query = query.gte('invoice_date', startDate.toISOString().split('T')[0]);
  }
  if (endDate) {
    query = query.lte('invoice_date', endDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching period purchases:', error);
    return { totalCapital: 0, branches: [] };
  }

  // Group by branch/warehouse and calculate totals
  const locationMap = new Map<string, { name: string; type: 'branch' | 'warehouse'; capital: number }>();

  (data || []).forEach((item: any) => {
    const amount = parseFloat(item.net_amount) || 0;
    if (amount <= 0) return;

    if (item.branch_id) {
      const key = `branch:${item.branch_id}`;
      const existing = locationMap.get(key) || {
        name: item.branches?.name || 'فرع غير معروف',
        type: 'branch' as const,
        capital: 0,
      };
      existing.capital += amount;
      locationMap.set(key, existing);
    }

    if (item.warehouse_id) {
      const key = `warehouse:${item.warehouse_id}`;
      const existing = locationMap.get(key) || {
        name: item.warehouses?.name || 'مخزن غير معروف',
        type: 'warehouse' as const,
        capital: 0,
      };
      existing.capital += amount;
      locationMap.set(key, existing);
    }
  });

  const branches: BranchCapital[] = Array.from(locationMap.entries())
    .map(([key, data]) => ({
      id: key.split(':')[1],
      name: data.name,
      type: data.type,
      capital: data.capital,
    }))
    .sort((a, b) => b.capital - a.capital);

  const totalCapital = branches.reduce((sum, b) => sum + b.capital, 0);

  return { totalCapital, branches };
};

// Check if entity filters are active
function hasEntityFilters(activeFilterType: ActiveFilterType, simpleFilters: SimpleFiltersResult, multiFilters: MultiFiltersResult): boolean {
  if (activeFilterType === 'simple') return getSimpleFiltersCount(simpleFilters) > 0;
  if (activeFilterType === 'multi') return getMultiFiltersCount(multiFilters) > 0;
  return false;
}

// Fetch raw sales with sale_items for filtered computation
async function fetchRawSalesData(dateFilter: DateFilter) {
  const { startDate, endDate } = getDateRangeFromFilter(dateFilter);

  let salesQuery = supabase
    .from('sales')
    .select('id, total_amount, profit, customer_id, cashier_id, branch_id, record_id, created_at, invoice_type, sale_type, shipping_amount');

  if (startDate) salesQuery = salesQuery.gte('created_at', startDate.toISOString());
  if (endDate) salesQuery = salesQuery.lte('created_at', endDate.toISOString());

  let itemsQuery = supabase
    .from('sale_items')
    .select(`
      sale_id,
      product_id,
      quantity,
      unit_price,
      cost_price,
      products!inner(id, name, category_id, categories(id, name)),
      sales!inner(created_at)
    `);

  if (startDate) itemsQuery = itemsQuery.gte('sales.created_at', startDate.toISOString());
  if (endDate) itemsQuery = itemsQuery.lte('sales.created_at', endDate.toISOString());

  const [salesRes, itemsRes] = await Promise.all([salesQuery, itemsQuery]);

  if (salesRes.error) throw salesRes.error;
  if (itemsRes.error) throw itemsRes.error;

  return {
    sales: (salesRes.data || []) as any[],
    saleItems: (itemsRes.data || []) as any[],
  };
}

// Fetch customer IDs for given customer group IDs
async function fetchCustomerIdsByGroups(groupIds: string[]): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('customers')
    .select('id, group_id')
    .in('group_id', groupIds);

  if (error) {
    console.error('Error fetching customers by group:', error);
    return new Set();
  }

  return new Set((data || []).map((c: any) => c.id));
}

// Apply filters to raw sales data
function applyFiltersToSales(
  sales: any[],
  saleItems: any[],
  activeFilterType: ActiveFilterType,
  simpleFilters: SimpleFiltersResult,
  multiFilters: MultiFiltersResult,
  customerGroupCustomerIds: Set<string> | null,
) {
  // Build filter sets based on active filter type
  let customerIds: Set<string> | null = null;
  let userIds: Set<string> | null = null;
  let locationIds: Set<string> | null = null;
  let safeIds: Set<string> | null = null;
  let productIds: Set<string> | null = null;
  let categoryIds: Set<string> | null = null;

  if (activeFilterType === 'simple') {
    if (simpleFilters.customerId) customerIds = new Set([simpleFilters.customerId]);
    if (simpleFilters.userId) userIds = new Set([simpleFilters.userId]);
    if (simpleFilters.locationId) locationIds = new Set([simpleFilters.locationId]);
    if (simpleFilters.safeId) safeIds = new Set([simpleFilters.safeId]);
    if (simpleFilters.productId) productIds = new Set([simpleFilters.productId]);
    if (simpleFilters.categoryId) categoryIds = new Set([simpleFilters.categoryId]);
    if (simpleFilters.customerGroupId && customerGroupCustomerIds) {
      customerIds = customerIds
        ? new Set([...customerIds, ...customerGroupCustomerIds])
        : customerGroupCustomerIds;
    }
  } else if (activeFilterType === 'multi') {
    if (multiFilters.customerIds.length > 0) customerIds = new Set(multiFilters.customerIds);
    if (multiFilters.userIds.length > 0) userIds = new Set(multiFilters.userIds);
    if (multiFilters.locationIds.length > 0) locationIds = new Set(multiFilters.locationIds);
    if (multiFilters.safeIds.length > 0) safeIds = new Set(multiFilters.safeIds);
    if (multiFilters.productIds.length > 0) productIds = new Set(multiFilters.productIds);
    if (multiFilters.categoryIds.length > 0) categoryIds = new Set(multiFilters.categoryIds);
    if (multiFilters.customerGroupIds.length > 0 && customerGroupCustomerIds) {
      customerIds = customerIds
        ? new Set([...customerIds, ...customerGroupCustomerIds])
        : customerGroupCustomerIds;
    }
  }

  // Filter sale-level fields first
  let filteredSales = sales;
  if (customerIds) filteredSales = filteredSales.filter(s => s.customer_id && customerIds!.has(s.customer_id));
  if (userIds) filteredSales = filteredSales.filter(s => s.cashier_id && userIds!.has(s.cashier_id));
  if (locationIds) filteredSales = filteredSales.filter(s => s.branch_id && locationIds!.has(s.branch_id));
  if (safeIds) filteredSales = filteredSales.filter(s => s.record_id && safeIds!.has(s.record_id));

  const filteredSaleIds = new Set(filteredSales.map(s => s.id));

  // Filter sale_items to match filtered sales AND item-level filters
  let filteredItems = saleItems.filter(item => filteredSaleIds.has(item.sale_id));
  if (productIds) filteredItems = filteredItems.filter(item => item.product_id && productIds!.has(item.product_id));
  if (categoryIds) filteredItems = filteredItems.filter(item => {
    const catId = item.products?.category_id;
    return catId && categoryIds!.has(catId);
  });

  // If product/category filters are active, narrow down sales to only those with matching items
  if (productIds || categoryIds) {
    const itemSaleIds = new Set(filteredItems.map(item => item.sale_id));
    filteredSales = filteredSales.filter(s => itemSaleIds.has(s.id));
  }

  return { filteredSales, filteredItems };
}

// Compute dashboard data from filtered raw data
function computeFilteredDashboardData(
  filteredSales: any[],
  filteredItems: any[],
): Omit<DashboardData, 'recentOrders' | 'capitalData'> {
  // KPIs
  const totalSales = filteredSales.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + (parseFloat(String(s.profit ?? 0)) || 0), 0);
  const orderCount = filteredSales.length;
  const uniqueCustomers = new Set(filteredSales.map(s => s.customer_id).filter(Boolean));
  const customerCount = uniqueCustomers.size;
  const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

  const invoices = filteredSales.filter(s => s.invoice_type !== 'Sale Return');
  const returns = filteredSales.filter(s => s.invoice_type === 'Sale Return');
  const invoiceCount = invoices.length;
  const invoiceTotal = invoices.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
  const returnCount = returns.length;
  const returnTotal = Math.abs(returns.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0));

  const kpis: KPIData = {
    totalSales,
    totalProfit,
    orderCount,
    customerCount,
    avgOrderValue,
    invoiceCount,
    invoiceTotal,
    returnCount,
    returnTotal,
    previousPeriod: {
      totalSales: 0,
      totalProfit: 0,
      orderCount: 0,
      customerCount: 0,
      avgOrderValue: 0,
      invoiceCount: 0,
      invoiceTotal: 0,
      returnCount: 0,
      returnTotal: 0,
    },
  };

  // Sales Trend - group by date
  const dailyMap = new Map<string, { sales: number; profit: number; orderCount: number }>();
  filteredSales.forEach(sale => {
    if (!sale.created_at) return;
    const date = toEgyptDateString(new Date(sale.created_at));
    const existing = dailyMap.get(date) || { sales: 0, profit: 0, orderCount: 0 };
    existing.sales += parseFloat(String(sale.total_amount)) || 0;
    existing.profit += parseFloat(String(sale.profit ?? 0)) || 0;
    existing.orderCount += 1;
    dailyMap.set(date, existing);
  });

  const salesTrend: SalesTrendPoint[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
      sales: data.sales,
      profit: data.profit,
      orderCount: data.orderCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top Products - group by product from sale_items
  const productMap = new Map<string, TopProductData>();
  filteredItems.forEach((item: any) => {
    const productId = item.product_id;
    const existing = productMap.get(productId) || {
      id: productId,
      productName: item.products?.name || 'منتج غير معروف',
      categoryName: item.products?.categories?.name || 'غير مصنف',
      totalQuantity: 0,
      totalRevenue: 0,
      totalProfit: 0,
      profitMargin: 0,
    };

    const qty = item.quantity || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const costPrice = parseFloat(item.cost_price) || 0;

    existing.totalQuantity += qty;
    existing.totalRevenue += qty * unitPrice;
    existing.totalProfit += qty * (unitPrice - costPrice);
    productMap.set(productId, existing);
  });

  const topProducts = Array.from(productMap.values())
    .map(p => ({
      ...p,
      profitMargin: p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Top Customers - group by customer from filtered sales
  const customerMap = new Map<string, TopCustomerData>();
  filteredSales.forEach((sale: any) => {
    if (!sale.customer_id) return;
    const customerId = sale.customer_id;
    const existing = customerMap.get(customerId) || {
      id: customerId,
      customerName: customerId, // Will be just ID - we don't have name from raw sales
      phone: '',
      invoiceCount: 0,
      totalSpent: 0,
      avgOrder: 0,
      accountBalance: 0,
    };
    existing.invoiceCount += 1;
    existing.totalSpent += parseFloat(String(sale.total_amount)) || 0;
    customerMap.set(customerId, existing);
  });

  const topCustomers = Array.from(customerMap.values())
    .map(c => ({
      ...c,
      avgOrder: c.invoiceCount > 0 ? c.totalSpent / c.invoiceCount : 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // Category Distribution - from sale_items
  const categoryMap = new Map<string, CategoryDistribution>();
  let totalRevenue = 0;

  filteredItems.forEach((item: any) => {
    const categoryId = item.products?.category_id || 'uncategorized';
    const categoryName = item.products?.categories?.name || 'غير مصنف';
    const revenue = (item.quantity || 0) * (parseFloat(item.unit_price) || 0);

    totalRevenue += revenue;

    const existing = categoryMap.get(categoryId) || {
      id: categoryId,
      categoryName,
      totalRevenue: 0,
      percentage: 0,
      invoiceCount: 0,
    };

    existing.totalRevenue += revenue;
    existing.invoiceCount += 1;
    categoryMap.set(categoryId, existing);
  });

  const categoryDistribution = Array.from(categoryMap.values())
    .map(c => ({
      ...c,
      percentage: totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Sale Type Breakdown
  const groundSales = filteredSales.filter(s => s.sale_type !== 'online');
  const onlineSalesArr = filteredSales.filter(s => s.sale_type === 'online');

  const groundInvoices = groundSales.filter(s => s.invoice_type !== 'Sale Return');
  const groundReturns = groundSales.filter(s => s.invoice_type === 'Sale Return');
  const onlineInvoices = onlineSalesArr.filter(s => s.invoice_type !== 'Sale Return');
  const onlineReturns = onlineSalesArr.filter(s => s.invoice_type === 'Sale Return');

  const sumAmt = (arr: typeof filteredSales) => arr.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
  const sumPrf = (arr: typeof filteredSales) => arr.reduce((sum, s) => sum + (parseFloat(String(s.profit ?? 0)) || 0), 0);
  const sumShp = (arr: typeof filteredSales) => arr.reduce((sum, s) => sum + (parseFloat(String(s.shipping_amount ?? 0)) || 0), 0);

  const saleTypeBreakdown: SaleTypeBreakdownData = {
    ground: {
      invoiceCount: groundInvoices.length,
      invoiceTotal: sumAmt(groundInvoices),
      returnCount: groundReturns.length,
      returnTotal: sumAmt(groundReturns),
      total: sumAmt(groundSales),
      profit: sumPrf(groundSales),
      percentage: orderCount > 0 ? (groundSales.length / orderCount) * 100 : 0,
    },
    online: {
      invoiceCount: onlineInvoices.length,
      invoiceTotal: sumAmt(onlineInvoices),
      returnCount: onlineReturns.length,
      returnTotal: sumAmt(onlineReturns),
      total: sumAmt(onlineSalesArr),
      profit: sumPrf(onlineSalesArr),
      percentage: orderCount > 0 ? (onlineSalesArr.length / orderCount) * 100 : 0,
      shippingTotal: sumShp(onlineSalesArr),
    },
  };

  return {
    kpis,
    salesTrend,
    topProducts,
    topCustomers,
    categoryDistribution,
    saleTypeBreakdown,
  };
}

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL = 30 * 1000;

interface UseDashboardDataOptions {
  activeFilterType?: ActiveFilterType;
  simpleFilters?: SimpleFiltersResult;
  multiFilters?: MultiFiltersResult;
}

export function useDashboardData(
  dateFilter: DateFilter = { type: 'today' },
  options: UseDashboardDataOptions = {},
) {
  const {
    activeFilterType = null,
    simpleFilters = initialSimpleFilters,
    multiFilters = initialMultiFilters,
  } = options;

  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);

  const filtersActive = hasEntityFilters(activeFilterType, simpleFilters, multiFilters);

  // Stable filter key for cache and dependency tracking
  const filterKey = useMemo(() => {
    const dateKey = dateFilter.type === 'custom'
      ? `custom:${dateFilter.startDate?.toISOString() || ''}:${dateFilter.endDate?.toISOString() || ''}`
      : dateFilter.type;

    if (!filtersActive) return dateKey;

    // Include entity filters in cache key
    const entityKey = activeFilterType === 'simple'
      ? `s:${JSON.stringify(simpleFilters)}`
      : `m:${JSON.stringify(multiFilters)}`;

    return `${dateKey}:${entityKey}`;
  }, [dateFilter.type, dateFilter.startDate, dateFilter.endDate, filtersActive, activeFilterType, simpleFilters, multiFilters]);

  const cacheKey = `dashboard:all:${filterKey}`;

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current && !forceRefresh) {
      return;
    }

    // 1. Stale-While-Revalidate: Show cached data immediately
    if (!forceRefresh) {
      const cachedData = cache.get<DashboardData>(cacheKey);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        // Continue to fetch fresh data in background
      }
    }

    isFetchingRef.current = true;

    // Only show loading spinner if no cached data
    if (!cache.has(cacheKey) || forceRefresh) {
      setLoading(true);
    }

    setError(null);

    try {
      let newData: DashboardData;

      if (filtersActive) {
        // FILTERED MODE: Fetch raw data and compute in JS
        // First, resolve customer group filter if needed
        let customerGroupCustomerIds: Set<string> | null = null;
        const groupIds = activeFilterType === 'simple'
          ? (simpleFilters.customerGroupId ? [simpleFilters.customerGroupId] : [])
          : multiFilters.customerGroupIds;

        if (groupIds.length > 0) {
          customerGroupCustomerIds = await fetchCustomerIdsByGroups(groupIds);
        }

        // Fetch raw data + recent orders + capital in parallel
        const [rawResult, recentOrdersResult, capitalResult] = await Promise.allSettled([
          fetchRawSalesData(dateFilter),
          fetchRecentOrders(dateFilter, 5),
          fetchPeriodPurchases(dateFilter),
        ]);

        if (rawResult.status === 'rejected') throw rawResult.reason;

        const { sales, saleItems } = rawResult.value;

        // Apply filters
        const { filteredSales, filteredItems } = applyFiltersToSales(
          sales,
          saleItems,
          activeFilterType,
          simpleFilters,
          multiFilters,
          customerGroupCustomerIds,
        );

        // Compute dashboard data from filtered results
        const computed = computeFilteredDashboardData(filteredSales, filteredItems);

        newData = {
          kpis: computed.kpis,
          salesTrend: computed.salesTrend,
          topProducts: computed.topProducts,
          topCustomers: computed.topCustomers,
          categoryDistribution: computed.categoryDistribution,
          saleTypeBreakdown: computed.saleTypeBreakdown,
          recentOrders: recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : [],
          capitalData: capitalResult.status === 'fulfilled' ? capitalResult.value : null,
        };
      } else {
        // UNFILTERED MODE: Use existing service functions (no change from original)
        const [
          kpisResult,
          salesTrendResult,
          topProductsResult,
          topCustomersResult,
          categoryDistResult,
          recentOrdersResult,
          capitalResult,
          saleTypeResult,
        ] = await Promise.allSettled([
          fetchKPIs(dateFilter),
          fetchSalesTrend(dateFilter, 30),
          fetchTopProducts(dateFilter, 5),
          fetchTopCustomers(dateFilter, 5),
          fetchCategoryDistribution(dateFilter),
          fetchRecentOrders(dateFilter, 5),
          fetchPeriodPurchases(dateFilter),
          fetchSaleTypeBreakdown(dateFilter),
        ]);

        newData = {
          kpis: kpisResult.status === 'fulfilled' ? kpisResult.value : null,
          salesTrend: salesTrendResult.status === 'fulfilled' ? salesTrendResult.value : [],
          topProducts: topProductsResult.status === 'fulfilled' ? topProductsResult.value : [],
          topCustomers: topCustomersResult.status === 'fulfilled' ? topCustomersResult.value : [],
          categoryDistribution: categoryDistResult.status === 'fulfilled' ? categoryDistResult.value : [],
          recentOrders: recentOrdersResult.status === 'fulfilled' ? recentOrdersResult.value : [],
          capitalData: capitalResult.status === 'fulfilled' ? capitalResult.value : null,
          saleTypeBreakdown: saleTypeResult.status === 'fulfilled' ? saleTypeResult.value : null,
        };
      }

      // 3. Save to cache
      cache.set(cacheKey, newData, CacheTTL.dashboardAll);

      setData(newData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [dateFilter, cacheKey, filtersActive, activeFilterType, simpleFilters, multiFilters]);

  // Initial fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh in background every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllData(false); // Silent refresh (uses cache first)
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Manual refresh function (force refresh, bypass cache)
  const refresh = useCallback(() => {
    fetchAllData(true);
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
