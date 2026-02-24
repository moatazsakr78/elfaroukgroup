'use client';

import { useState } from 'react';
import TopHeader from '@/app/components/layout/TopHeader';
import Sidebar from '@/app/components/layout/Sidebar';
import SimpleDateFilterModal from '@/app/components/SimpleDateFilterModal';
import ActivityLogsHeader from './components/ActivityLogsHeader';
import ActivityLogsList from './components/ActivityLogsList';
import ActivityLogFilters from './components/ActivityLogFilters';
import { useActivityLogs } from './hooks/useActivityLogs';
import type { DateFilter } from '@/app/components/SimpleDateFilterModal';

export default function ActivityLogsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [isEntityFilterOpen, setIsEntityFilterOpen] = useState(false);
  const [isActionFilterOpen, setIsActionFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>({ type: 'all' });

  const {
    logs,
    loading,
    error,
    total,
    page,
    totalPages,
    setPage,
    filters,
    setFilters,
    refresh,
  } = useActivityLogs();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);

    let startDate: string | undefined;
    let endDate: string | undefined;

    if (filter.type !== 'all') {
      if (filter.type === 'custom') {
        startDate = filter.startDate?.toISOString();
        endDate = filter.endDate?.toISOString();
      } else {
        // Calculate dates from filter type
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (filter.type) {
          case 'today':
            startDate = today.toISOString();
            endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
            break;
          case 'current_week': {
            const dayOfWeek = today.getDay();
            const diffToSat = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - diffToSat);
            startDate = startOfWeek.toISOString();
            break;
          }
          case 'current_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            break;
          case 'last_week': {
            const dayOfWeek2 = today.getDay();
            const diffToSat2 = dayOfWeek2 === 6 ? 0 : dayOfWeek2 + 1;
            const startOfThisWeek = new Date(today);
            startOfThisWeek.setDate(today.getDate() - diffToSat2);
            const endOfLastWeek = new Date(startOfThisWeek.getTime() - 1);
            const startOfLastWeek = new Date(startOfThisWeek);
            startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
            startDate = startOfLastWeek.toISOString();
            endDate = endOfLastWeek.toISOString();
            break;
          }
          case 'last_month': {
            const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
            const startOfLastMonth = new Date(endOfLastMonth.getFullYear(), endOfLastMonth.getMonth(), 1);
            startDate = startOfLastMonth.toISOString();
            endDate = endOfLastMonth.toISOString();
            break;
          }
        }
      }
    }

    setFilters({
      ...filters,
      startDate,
      endDate,
    });
  };

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <div className="h-full pt-12 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <ActivityLogsHeader
            filters={filters}
            onFiltersChange={setFilters}
            onDateFilterClick={() => setIsDateFilterOpen(true)}
            onEntityFilterClick={() => setIsEntityFilterOpen(true)}
            onActionFilterClick={() => setIsActionFilterOpen(true)}
            onRefresh={refresh}
            total={total}
            loading={loading}
            hasDateFilter={dateFilter.type !== 'all'}
          />
        </div>

        <div className="flex-1 overflow-auto scrollbar-hide p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-400">
              <p className="text-lg">{error}</p>
              <button
                onClick={refresh}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <ActivityLogsList
              logs={logs}
              loading={loading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <SimpleDateFilterModal
        isOpen={isDateFilterOpen}
        onClose={() => setIsDateFilterOpen(false)}
        onDateFilterChange={handleDateFilterChange}
        currentFilter={dateFilter}
      />

      <ActivityLogFilters
        isOpen={isEntityFilterOpen}
        onClose={() => setIsEntityFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
        mode="entity"
      />

      <ActivityLogFilters
        isOpen={isActionFilterOpen}
        onClose={() => setIsActionFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
        mode="action"
      />
    </div>
  );
}
