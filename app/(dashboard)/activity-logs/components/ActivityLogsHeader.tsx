'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { ActivityLogsFilters } from '../hooks/useActivityLogs';

interface ActivityLogsHeaderProps {
  filters: ActivityLogsFilters;
  onFiltersChange: (filters: ActivityLogsFilters) => void;
  onDateFilterClick: () => void;
  onEntityFilterClick: () => void;
  onActionFilterClick: () => void;
  onRefresh: () => void;
  total: number;
  loading: boolean;
  hasDateFilter: boolean;
}

export default function ActivityLogsHeader({
  filters,
  onFiltersChange,
  onDateFilterClick,
  onEntityFilterClick,
  onActionFilterClick,
  onRefresh,
  total,
  loading,
  hasDateFilter,
}: ActivityLogsHeaderProps) {
  const [searchValue, setSearchValue] = useState(filters.search);

  const handleSearchSubmit = () => {
    onFiltersChange({ ...filters, search: searchValue });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchSubmit();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">سجل النشاط</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total > 0 ? `${total} سجل` : 'لا توجد سجلات'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search + Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchSubmit}
            placeholder="بحث في سجل النشاط..."
            className="w-full pr-10 pl-3 py-2 bg-[#2B3544] border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Date Filter */}
        <button
          onClick={onDateFilterClick}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            hasDateFilter
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
              : 'bg-[#2B3544] text-gray-300 hover:bg-[#323d4d] border border-gray-600'
          }`}
        >
          <CalendarDaysIcon className="w-4 h-4" />
          <span>التاريخ</span>
        </button>

        {/* Entity Type Filter */}
        <button
          onClick={onEntityFilterClick}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            filters.entityTypes.length > 0
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
              : 'bg-[#2B3544] text-gray-300 hover:bg-[#323d4d] border border-gray-600'
          }`}
        >
          <FunnelIcon className="w-4 h-4" />
          <span>النوع</span>
          {filters.entityTypes.length > 0 && (
            <span className="bg-blue-500 text-white text-xs px-1.5 rounded-full">{filters.entityTypes.length}</span>
          )}
        </button>

        {/* Action Type Filter */}
        <button
          onClick={onActionFilterClick}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            filters.actionTypes.length > 0
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
              : 'bg-[#2B3544] text-gray-300 hover:bg-[#323d4d] border border-gray-600'
          }`}
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          <span>الإجراء</span>
          {filters.actionTypes.length > 0 && (
            <span className="bg-blue-500 text-white text-xs px-1.5 rounded-full">{filters.actionTypes.length}</span>
          )}
        </button>
      </div>
    </div>
  );
}
