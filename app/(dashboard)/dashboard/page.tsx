'use client';

import { useState, useMemo } from 'react';
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

// Date Filter Modal
import SimpleDateFilterModal from '@/app/components/SimpleDateFilterModal';

// Filter Modals
import SimpleFilterModal from '@/app/components/SimpleFilterModal';
import MultiFilterModal from '@/app/components/MultiFilterModal';

// Custom Hook
import { useDashboardData } from './hooks/useDashboardData';

// Types
import { DateFilter } from '../reports/types/reports';
import {
  SimpleFiltersResult,
  MultiFiltersResult,
  ActiveFilterType,
  initialSimpleFilters,
  initialMultiFilters,
  getSimpleFiltersCount,
  getMultiFiltersCount,
} from '@/app/types/filters';

// Utils
import { getDateFilterLabel } from '@/app/lib/utils/dateFilters';

// Helper to get period label for stats card titles
function getPeriodLabel(filter: DateFilter): string {
  switch (filter.type) {
    case 'today': return 'اليوم';
    case 'current_week': return 'هذا الأسبوع';
    case 'current_month': return 'هذا الشهر';
    case 'last_week': return 'الأسبوع الماضي';
    case 'last_month': return 'الشهر الماضي';
    case 'custom': return getDateFilterLabel(filter);
    case 'all': return 'الكل';
    default: return 'اليوم';
  }
}

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'today' });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  // Entity filter state
  const [simpleFilters, setSimpleFilters] = useState<SimpleFiltersResult>(initialSimpleFilters);
  const [multiFilters, setMultiFilters] = useState<MultiFiltersResult>(initialMultiFilters);
  const [activeFilterType, setActiveFilterType] = useState<ActiveFilterType>(null);
  const [showSimpleFilter, setShowSimpleFilter] = useState(false);
  const [showMultiFilter, setShowMultiFilter] = useState(false);

  const simpleFiltersCount = useMemo(() => getSimpleFiltersCount(simpleFilters), [simpleFilters]);
  const multiFiltersCount = useMemo(() => getMultiFiltersCount(multiFilters), [multiFilters]);

  const { data, loading, error, lastUpdated, refresh } = useDashboardData(dateFilter, {
    activeFilterType,
    simpleFilters,
    multiFilters,
  });

  // Check if entity filters are active (for passing externalData to charts)
  const filtersActive = (activeFilterType === 'simple' && simpleFiltersCount > 0) ||
    (activeFilterType === 'multi' && multiFiltersCount > 0);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle simple filter apply - clears multi filter
  const handleSimpleFilterApply = (filters: SimpleFiltersResult) => {
    setSimpleFilters(filters);
    setMultiFilters(initialMultiFilters);
    const count = getSimpleFiltersCount(filters);
    setActiveFilterType(count > 0 ? 'simple' : null);
  };

  // Handle multi filter apply - clears simple filter
  const handleMultiFilterApply = (filters: MultiFiltersResult) => {
    setMultiFilters(filters);
    setSimpleFilters(initialSimpleFilters);
    const count = getMultiFiltersCount(filters);
    setActiveFilterType(count > 0 ? 'multi' : null);
  };

  const periodLabel = getPeriodLabel(dateFilter);

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
          dateFilter={dateFilter}
          onDateFilterClick={() => setIsDateFilterOpen(true)}
          onSimpleFilterClick={() => setShowSimpleFilter(true)}
          onMultiFilterClick={() => setShowMultiFilter(true)}
          activeFilterType={activeFilterType}
          simpleFiltersCount={simpleFiltersCount}
          multiFiltersCount={multiFiltersCount}
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
                  title={`مبيعات ${periodLabel}`}
                  value={data.kpis?.totalSales || 0}
                  previousValue={calcChange(data.kpis?.totalSales || 0, data.kpis?.previousPeriod?.totalSales || 0)}
                  icon={CurrencyDollarIcon}
                  color="blue"
                  format="currency"
                  loading={loading}
                />
                <StatsCard
                  title={`طلبات ${periodLabel}`}
                  value={data.kpis?.orderCount || 0}
                  previousValue={calcChange(data.kpis?.orderCount || 0, data.kpis?.previousPeriod?.orderCount || 0)}
                  icon={ShoppingCartIcon}
                  color="green"
                  format="number"
                  loading={loading}
                />
                <StatsCard
                  title={`عملاء ${periodLabel}`}
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
                {/* Sales Trend Chart */}
                <SalesTrendChart
                  dateFilter={dateFilter}
                  height={280}
                  externalData={filtersActive ? data.salesTrend : undefined}
                />

                {/* Category Distribution Pie Chart */}
                <CategoryPieChart
                  dateFilter={dateFilter}
                  height={280}
                  externalData={filtersActive ? data.categoryDistribution : undefined}
                />
              </div>

              {/* Top Products Bar Chart */}
              <TopProductsBarChart
                dateFilter={dateFilter}
                height={250}
                limit={5}
                externalData={filtersActive ? data.topProducts : undefined}
              />

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

      {/* Date Filter Modal */}
      <SimpleDateFilterModal
        isOpen={isDateFilterOpen}
        onClose={() => setIsDateFilterOpen(false)}
        onDateFilterChange={setDateFilter}
        currentFilter={dateFilter}
      />

      {/* Simple Filter Modal */}
      <SimpleFilterModal
        isOpen={showSimpleFilter}
        onClose={() => setShowSimpleFilter(false)}
        onApply={handleSimpleFilterApply}
        initialFilters={simpleFilters}
      />

      {/* Multi Filter Modal */}
      <MultiFilterModal
        isOpen={showMultiFilter}
        onClose={() => setShowMultiFilter(false)}
        onApply={handleMultiFilterApply}
        initialFilters={multiFilters}
      />
    </div>
  );
}
