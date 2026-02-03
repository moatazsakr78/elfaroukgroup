'use client';

import { useState } from 'react';
import TopHeader from '@/app/components/layout/TopHeader';
import Sidebar from '@/app/components/layout/Sidebar';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UsersIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// Dashboard Components
import {
  DashboardHeader,
  StatsCard,
  RecentOrdersCard,
  LowStockCard,
  TopCustomersCard,
  QuickActions,
  DashboardSkeleton,
} from './components';

// Report Charts (reusing from reports module)
import SalesTrendChart from '../reports/components/charts/SalesTrendChart';
import CategoryPieChart from '../reports/components/charts/CategoryPieChart';
import TopProductsBarChart from '../reports/components/charts/TopProductsBarChart';

// Custom Hook
import { useDashboardData } from './hooks/useDashboardData';

// Types
import { DateFilter } from '../reports/types/reports';

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data, loading, error, lastUpdated, refresh } = useDashboardData();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Date filters for charts
  const weekFilter: DateFilter = { type: 'current_week' };
  const monthFilter: DateFilter = { type: 'current_month' };

  // Calculate percentage change helper
  const calcChange = (current: number, previous: number): number | undefined => {
    if (previous === 0) return undefined;
    return previous;
  };

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <div className="h-full pt-12 overflow-hidden flex flex-col">
        {/* Dashboard Header */}
        <DashboardHeader
          onRefresh={refresh}
          lastUpdated={lastUpdated}
          isRefreshing={loading}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-auto scrollbar-hide">
          {loading && !data.kpis ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <ExclamationTriangleIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <p className="text-red-400 text-lg">{error}</p>
                <button
                  onClick={refresh}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="مبيعات اليوم"
                  value={data.kpis?.totalSales || 0}
                  previousValue={calcChange(data.kpis?.totalSales || 0, data.kpis?.previousPeriod?.totalSales || 0)}
                  icon={CurrencyDollarIcon}
                  color="blue"
                  format="currency"
                  loading={loading}
                />
                <StatsCard
                  title="طلبات اليوم"
                  value={data.kpis?.orderCount || 0}
                  previousValue={calcChange(data.kpis?.orderCount || 0, data.kpis?.previousPeriod?.orderCount || 0)}
                  icon={ShoppingCartIcon}
                  color="green"
                  format="number"
                  loading={loading}
                />
                <StatsCard
                  title="عملاء اليوم"
                  value={data.kpis?.customerCount || 0}
                  previousValue={calcChange(data.kpis?.customerCount || 0, data.kpis?.previousPeriod?.customerCount || 0)}
                  icon={UsersIcon}
                  color="purple"
                  format="number"
                  loading={loading}
                />
                <StatsCard
                  title="تنبيهات المخزون"
                  value={data.lowStockProducts.length}
                  icon={ExclamationTriangleIcon}
                  color={data.lowStockProducts.length > 0 ? 'red' : 'green'}
                  format="number"
                  loading={loading}
                />
              </div>

              {/* Quick Actions */}
              <QuickActions />

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend Chart - Last 7 days */}
                <SalesTrendChart dateFilter={weekFilter} height={280} />

                {/* Category Distribution Pie Chart */}
                <CategoryPieChart dateFilter={monthFilter} height={280} />
              </div>

              {/* Top Products Bar Chart */}
              <TopProductsBarChart dateFilter={monthFilter} height={250} limit={5} />

              {/* Orders and Customers Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <RecentOrdersCard
                  orders={data.recentOrders}
                  loading={loading}
                />

                {/* Top Customers */}
                <TopCustomersCard
                  customers={data.topCustomers}
                  loading={loading}
                />
              </div>

              {/* Low Stock Alerts */}
              {(data.lowStockProducts.length > 0 || loading) && (
                <LowStockCard
                  products={data.lowStockProducts}
                  loading={loading}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
