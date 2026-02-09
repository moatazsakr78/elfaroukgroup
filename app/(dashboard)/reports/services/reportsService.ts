// Reports Service - Data fetching from Supabase
// All queries use elfaroukgroup schema

import { supabase } from '@/app/lib/supabase/client';
import { toEgyptDateString, toEgyptHour, toEgyptDayOfWeek } from '@/app/lib/utils/date-utils';
import {
  DateFilter,
  KPIData,
  SalesTrendPoint,
  TopProductData,
  TopCustomerData,
  CategoryDistribution,
  PaymentMethodData,
  HourlySalesData,
  DayOfWeekData,
  ReceivableData,
  PayableData,
  ExpenseData,
  RevenueVsProfitData,
  SaleTypeBreakdownData,
} from '../types/reports';
import { getArabicDayName, formatHourRange, getPaymentMethodAr } from '../utils/chartConfig';

// Helper function to get date range from filter
const getDateRange = (filter: DateFilter): { startDate: string; endDate: string } => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (filter.type) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'current_week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'last_week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59);
      break;
    case 'current_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'custom':
      startDate = filter.startDate ? new Date(filter.startDate) : new Date(2024, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = filter.endDate ? new Date(filter.endDate) : now;
      endDate.setHours(23, 59, 59, 999);
      break;
    default: // 'all'
      startDate = new Date(2024, 0, 1); // Default start from 2024
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

// Get previous period for comparison
const getPreviousPeriodRange = (filter: DateFilter): { startDate: string; endDate: string } => {
  const { startDate, endDate } = getDateRange(filter);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = end.getTime() - start.getTime();

  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);

  return {
    startDate: prevStart.toISOString(),
    endDate: prevEnd.toISOString(),
  };
};

// Fetch KPIs (Total Sales, Profit, Order Count, etc.)
export const fetchKPIs = async (filter: DateFilter, brandId?: string | null): Promise<KPIData> => {
  const { startDate, endDate } = getDateRange(filter);
  const prevPeriod = getPreviousPeriodRange(filter);

  // Current period
  let currentQuery = supabase
    .from('sales')
    .select('id, total_amount, profit, customer_id, invoice_type')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (brandId) currentQuery = currentQuery.eq('brand_id', brandId);

  const { data: currentData, error: currentError } = await currentQuery;

  if (currentError) throw currentError;

  // Previous period
  let prevQuery = supabase
    .from('sales')
    .select('id, total_amount, profit, customer_id, invoice_type')
    .gte('created_at', prevPeriod.startDate)
    .lte('created_at', prevPeriod.endDate);

  if (brandId) prevQuery = prevQuery.eq('brand_id', brandId);

  const { data: prevData, error: prevError } = await prevQuery;

  if (prevError) throw prevError;

  const currentSales = currentData || [];
  const prevSales = prevData || [];

  const calcKPIs = (sales: typeof currentSales) => {
    const totalSales = sales.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + (parseFloat(String(s.profit ?? 0)) || 0), 0);
    const orderCount = sales.length;
    const uniqueCustomers = new Set(sales.map(s => s.customer_id).filter(Boolean));
    const customerCount = uniqueCustomers.size;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    const invoices = sales.filter(s => s.invoice_type !== 'Sale Return');
    const returns = sales.filter(s => s.invoice_type === 'Sale Return');
    const invoiceCount = invoices.length;
    const invoiceTotal = invoices.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
    const returnCount = returns.length;
    const returnTotal = Math.abs(returns.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0));

    return { totalSales, totalProfit, orderCount, customerCount, avgOrderValue, invoiceCount, invoiceTotal, returnCount, returnTotal };
  };

  const current = calcKPIs(currentSales);
  const prev = calcKPIs(prevSales);

  return {
    ...current,
    previousPeriod: prev,
  };
};

// Fetch Sales Trend (daily data for line chart)
export const fetchSalesTrend = async (filter: DateFilter, days: number = 30, brandId?: string | null): Promise<SalesTrendPoint[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select('created_at, total_amount, profit')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Group by date
  const dailyMap = new Map<string, { sales: number; profit: number; orderCount: number }>();

  (data || []).forEach(sale => {
    if (!sale.created_at) return;
    const date = toEgyptDateString(new Date(sale.created_at));
    const existing = dailyMap.get(date) || { sales: 0, profit: 0, orderCount: 0 };
    existing.sales += parseFloat(String(sale.total_amount)) || 0;
    existing.profit += parseFloat(String(sale.profit ?? 0)) || 0;
    existing.orderCount += 1;
    dailyMap.set(date, existing);
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
      sales: data.sales,
      profit: data.profit,
      orderCount: data.orderCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Fetch Top Products
export const fetchTopProducts = async (filter: DateFilter, limit: number = 10, brandId?: string | null): Promise<TopProductData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sale_items')
    .select(`
      product_id,
      quantity,
      unit_price,
      cost_price,
      products!inner(id, name, category_id, categories(name)),
      sales!inner(created_at, brand_id)
    `)
    .gte('sales.created_at', startDate)
    .lte('sales.created_at', endDate);

  if (brandId) query = query.eq('sales.brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Group by product
  const productMap = new Map<string, TopProductData>();

  (data || []).forEach((item: any) => {
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

  return Array.from(productMap.values())
    .map(p => ({
      ...p,
      profitMargin: p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
};

// Fetch Top Customers
export const fetchTopCustomers = async (filter: DateFilter, limit: number = 10, brandId?: string | null): Promise<TopCustomerData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select(`
      customer_id,
      total_amount,
      customers!inner(id, name, phone, account_balance)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .not('customer_id', 'is', null);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Group by customer
  const customerMap = new Map<string, TopCustomerData>();

  (data || []).forEach((sale: any) => {
    const customerId = sale.customer_id;
    const existing = customerMap.get(customerId) || {
      id: customerId,
      customerName: sale.customers?.name || 'عميل غير معروف',
      phone: sale.customers?.phone || '',
      invoiceCount: 0,
      totalSpent: 0,
      avgOrder: 0,
      accountBalance: parseFloat(sale.customers?.account_balance) || 0,
    };

    existing.invoiceCount += 1;
    existing.totalSpent += parseFloat(sale.total_amount) || 0;

    customerMap.set(customerId, existing);
  });

  return Array.from(customerMap.values())
    .map(c => ({
      ...c,
      avgOrder: c.invoiceCount > 0 ? c.totalSpent / c.invoiceCount : 0,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
};

// Fetch Category Distribution (for Pie chart)
export const fetchCategoryDistribution = async (filter: DateFilter, brandId?: string | null): Promise<CategoryDistribution[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sale_items')
    .select(`
      quantity,
      unit_price,
      products!inner(category_id, categories(id, name)),
      sales!inner(created_at, brand_id)
    `)
    .gte('sales.created_at', startDate)
    .lte('sales.created_at', endDate);

  if (brandId) query = query.eq('sales.brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Group by category
  const categoryMap = new Map<string, CategoryDistribution>();
  let totalRevenue = 0;

  (data || []).forEach((item: any) => {
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

  return Array.from(categoryMap.values())
    .map(c => ({
      ...c,
      percentage: totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
};

// Fetch Payment Methods Distribution
export const fetchPaymentMethods = async (filter: DateFilter, brandId?: string | null): Promise<PaymentMethodData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select('payment_method, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Group by payment method
  const methodMap = new Map<string, PaymentMethodData>();
  let totalAmount = 0;

  (data || []).forEach(sale => {
    const method = sale.payment_method || 'نقدي';
    const amount = parseFloat(String(sale.total_amount)) || 0;

    totalAmount += amount;

    const existing = methodMap.get(method) || {
      method,
      methodAr: getPaymentMethodAr(method),
      count: 0,
      totalAmount: 0,
      percentage: 0,
    };

    existing.count += 1;
    existing.totalAmount += amount;

    methodMap.set(method, existing);
  });

  return Array.from(methodMap.values())
    .map(m => ({
      ...m,
      percentage: totalAmount > 0 ? (m.totalAmount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

// Fetch Hourly Sales Distribution
export const fetchHourlySales = async (filter: DateFilter, brandId?: string | null): Promise<HourlySalesData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select('created_at, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Initialize all hours
  const hourlyMap = new Map<number, HourlySalesData>();
  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, {
      hour: i,
      hourLabel: formatHourRange(i),
      saleCount: 0,
      totalSales: 0,
      avgSale: 0,
      percentage: 0,
    });
  }

  let totalSales = 0;

  (data || []).forEach(sale => {
    if (!sale.created_at) return;
    const hour = toEgyptHour(new Date(sale.created_at));
    const amount = parseFloat(String(sale.total_amount)) || 0;
    totalSales += amount;

    const hourData = hourlyMap.get(hour)!;
    hourData.saleCount += 1;
    hourData.totalSales += amount;
  });

  return Array.from(hourlyMap.values())
    .filter(h => h.saleCount > 0) // Only hours with sales
    .map(h => ({
      ...h,
      avgSale: h.saleCount > 0 ? h.totalSales / h.saleCount : 0,
      percentage: totalSales > 0 ? (h.totalSales / totalSales) * 100 : 0,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);
};

// Fetch Day of Week Sales (Best Day Analysis)
export const fetchDayOfWeekSales = async (filter: DateFilter, brandId?: string | null): Promise<DayOfWeekData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select('created_at, total_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Initialize all days
  const dayMap = new Map<number, DayOfWeekData>();
  for (let i = 0; i < 7; i++) {
    dayMap.set(i, {
      dayOfWeek: i,
      dayName: getArabicDayName(i),
      saleCount: 0,
      totalSales: 0,
      avgSale: 0,
      percentage: 0,
    });
  }

  let totalSales = 0;

  (data || []).forEach(sale => {
    if (!sale.created_at) return;
    const dayOfWeek = toEgyptDayOfWeek(new Date(sale.created_at));
    const amount = parseFloat(String(sale.total_amount)) || 0;
    totalSales += amount;

    const dayData = dayMap.get(dayOfWeek)!;
    dayData.saleCount += 1;
    dayData.totalSales += amount;
  });

  return Array.from(dayMap.values())
    .map(d => ({
      ...d,
      avgSale: d.saleCount > 0 ? d.totalSales / d.saleCount : 0,
      percentage: totalSales > 0 ? (d.totalSales / totalSales) * 100 : 0,
    }))
    .sort((a, b) => b.totalSales - a.totalSales);
};

// Fetch Customer Receivables (Money owed BY customers)
export const fetchReceivables = async (): Promise<ReceivableData[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, account_balance')
    .gt('account_balance', 0)
    .order('account_balance', { ascending: false });

  if (error) throw error;

  return (data || []).map(c => ({
    id: c.id,
    customerName: c.name,
    phone: c.phone || '',
    accountBalance: parseFloat(String(c.account_balance ?? 0)) || 0,
    totalPurchases: 0, // Can be calculated separately if needed
    totalPayments: 0,
    lastTransactionDate: null,
  }));
};

// Fetch Supplier Payables (Money owed TO suppliers)
export const fetchPayables = async (): Promise<PayableData[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, phone, account_balance')
    .neq('account_balance', 0)
    .order('account_balance', { ascending: false });

  if (error) throw error;

  return (data || []).map(s => ({
    id: s.id,
    supplierName: s.name,
    phone: s.phone || '',
    accountBalance: parseFloat(String(s.account_balance ?? 0)) || 0,
    totalPurchases: 0,
    totalPayments: 0,
    lastTransactionDate: null,
  }));
};

// Fetch Expenses by Category
export const fetchExpenses = async (filter: DateFilter, brandId?: string | null): Promise<ExpenseData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('expenses')
    .select('category, amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by category
  const categoryMap = new Map<string, ExpenseData>();
  let totalExpenses = 0;

  (data || []).forEach(expense => {
    const category = expense.category || 'أخرى';
    const amount = parseFloat(String(expense.amount)) || 0;
    totalExpenses += amount;

    const existing = categoryMap.get(category) || {
      category,
      totalAmount: 0,
      expenseCount: 0,
      percentage: 0,
    };

    existing.totalAmount += amount;
    existing.expenseCount += 1;

    categoryMap.set(category, existing);
  });

  return Array.from(categoryMap.values())
    .map(e => ({
      ...e,
      percentage: totalExpenses > 0 ? (e.totalAmount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

// Fetch Revenue vs Profit Trend
export const fetchRevenueVsProfit = async (filter: DateFilter, brandId?: string | null): Promise<RevenueVsProfitData[]> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select('created_at, total_amount, profit')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  // Group by date
  const dailyMap = new Map<string, { revenue: number; profit: number }>();

  (data || []).forEach(sale => {
    if (!sale.created_at) return;
    const date = toEgyptDateString(new Date(sale.created_at));
    const existing = dailyMap.get(date) || { revenue: 0, profit: 0 };
    existing.revenue += parseFloat(String(sale.total_amount)) || 0;
    existing.profit += parseFloat(String(sale.profit ?? 0)) || 0;
    dailyMap.set(date, existing);
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      displayDate: new Date(date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
      revenue: data.revenue,
      profit: data.profit,
      profitMargin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Fetch Sale Type Breakdown (ground vs online)
export const fetchSaleTypeBreakdown = async (filter: DateFilter, brandId?: string | null): Promise<SaleTypeBreakdownData> => {
  const { startDate, endDate } = getDateRange(filter);

  let query = supabase
    .from('sales')
    .select('id, total_amount, profit, sale_type, shipping_amount')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;

  if (error) throw error;

  const sales = data || [];
  const totalCount = sales.length;

  const groundSales = sales.filter(s => s.sale_type !== 'online');
  const onlineSales = sales.filter(s => s.sale_type === 'online');

  const groundTotal = groundSales.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
  const groundProfit = groundSales.reduce((sum, s) => sum + (parseFloat(String(s.profit ?? 0)) || 0), 0);

  const onlineTotal = onlineSales.reduce((sum, s) => sum + (parseFloat(String(s.total_amount)) || 0), 0);
  const onlineProfit = onlineSales.reduce((sum, s) => sum + (parseFloat(String(s.profit ?? 0)) || 0), 0);
  const onlineShipping = onlineSales.reduce((sum, s) => sum + (parseFloat(String(s.shipping_amount ?? 0)) || 0), 0);

  return {
    ground: {
      count: groundSales.length,
      total: groundTotal,
      profit: groundProfit,
      percentage: totalCount > 0 ? (groundSales.length / totalCount) * 100 : 0,
    },
    online: {
      count: onlineSales.length,
      total: onlineTotal,
      profit: onlineProfit,
      percentage: totalCount > 0 ? (onlineSales.length / totalCount) * 100 : 0,
      shippingTotal: onlineShipping,
    },
  };
};

// Export all functions as a service object
export const reportsService = {
  fetchKPIs,
  fetchSalesTrend,
  fetchTopProducts,
  fetchTopCustomers,
  fetchCategoryDistribution,
  fetchPaymentMethods,
  fetchHourlySales,
  fetchDayOfWeekSales,
  fetchReceivables,
  fetchPayables,
  fetchExpenses,
  fetchRevenueVsProfit,
  fetchSaleTypeBreakdown,
};

export default reportsService;
