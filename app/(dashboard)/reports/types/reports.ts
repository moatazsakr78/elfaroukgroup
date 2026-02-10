// TypeScript interfaces for Reports module

export interface DateFilter {
  type: 'all' | 'today' | 'current_week' | 'last_week' | 'current_month' | 'last_month' | 'custom';
  startDate?: Date;
  endDate?: Date;
}

export interface KPIData {
  totalSales: number;
  totalProfit: number;
  orderCount: number;
  customerCount: number;
  avgOrderValue: number;
  invoiceCount: number;
  invoiceTotal: number;
  returnCount: number;
  returnTotal: number;
  previousPeriod: {
    totalSales: number;
    totalProfit: number;
    orderCount: number;
    customerCount: number;
    avgOrderValue: number;
    invoiceCount: number;
    invoiceTotal: number;
    returnCount: number;
    returnTotal: number;
  };
}

export interface SalesTrendPoint {
  date: string;
  displayDate: string;
  sales: number;
  profit: number;
  orderCount: number;
}

export interface TopProductData {
  id: string;
  productName: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
}

export interface TopCustomerData {
  id: string;
  customerName: string;
  phone: string;
  invoiceCount: number;
  totalSpent: number;
  avgOrder: number;
  accountBalance: number;
}

export interface CategoryDistribution {
  id: string;
  categoryName: string;
  totalRevenue: number;
  percentage: number;
  invoiceCount: number;
  [key: string]: string | number;
}

export interface PaymentMethodData {
  method: string;
  methodAr: string;
  count: number;
  totalAmount: number;
  percentage: number;
  [key: string]: string | number;
}

export interface HourlySalesData {
  hour: number;
  hourLabel: string;
  saleCount: number;
  totalSales: number;
  avgSale: number;
  percentage: number;
}

export interface DayOfWeekData {
  dayOfWeek: number;
  dayName: string;
  saleCount: number;
  totalSales: number;
  avgSale: number;
  percentage: number;
}

export interface ReceivableData {
  id: string;
  customerName: string;
  phone: string;
  accountBalance: number;
  totalPurchases: number;
  totalPayments: number;
  lastTransactionDate: string | null;
}

export interface PayableData {
  id: string;
  supplierName: string;
  phone: string;
  accountBalance: number;
  totalPurchases: number;
  totalPayments: number;
  lastTransactionDate: string | null;
}

export interface ExpenseData {
  category: string;
  totalAmount: number;
  expenseCount: number;
  percentage: number;
}

export interface RevenueVsProfitData {
  date: string;
  displayDate: string;
  revenue: number;
  profit: number;
  profitMargin: number;
}

export interface DashboardData {
  kpis: KPIData;
  salesTrend: SalesTrendPoint[];
  topProducts: TopProductData[];
  topCustomers: TopCustomerData[];
  categoryDistribution: CategoryDistribution[];
  paymentMethods: PaymentMethodData[];
  hourlySales: HourlySalesData[];
  dayOfWeekSales: DayOfWeekData[];
}

export interface ReportConfig {
  id: string;
  title: string;
  titleAr: string;
  category: 'sales' | 'purchases' | 'financial' | 'inventory';
  hasChart: boolean;
  chartType?: 'bar' | 'line' | 'pie' | 'area';
}

// Sale Type Breakdown (ground vs online)
export interface SaleTypeBreakdownData {
  ground: {
    invoiceCount: number; invoiceTotal: number;
    returnCount: number; returnTotal: number;
    total: number; profit: number; percentage: number;
  };
  online: {
    invoiceCount: number; invoiceTotal: number;
    returnCount: number; returnTotal: number;
    total: number; profit: number; percentage: number;
    shippingTotal: number;
  };
}

export interface SaleTypeTrendPoint {
  date: string;
  displayDate: string;
  groundSales: number;
  onlineSales: number;
  groundCount: number;
  onlineCount: number;
}

// Helper type for chart data
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}
