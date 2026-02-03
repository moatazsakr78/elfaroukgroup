'use client';

import { useUserProfile } from '@/lib/contexts/UserProfileContext';
import {
  ArrowPathIcon,
  PlusIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface DashboardHeaderProps {
  onRefresh: () => void;
  lastUpdated: Date | null;
  isRefreshing: boolean;
}

export default function DashboardHeader({ onRefresh, lastUpdated, isRefreshing }: DashboardHeaderProps) {
  const { profile, loading } = useUserProfile();

  // Format current date in Arabic
  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format last updated time
  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'مساء الخير';
    return 'مساء الخير';
  };

  return (
    <div className="bg-[#374151] border-b border-gray-600 px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Greeting and Date */}
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-bold text-white">
            {getGreeting()}،{' '}
            <span className="text-blue-400">
              {loading ? '...' : profile?.full_name || 'مستخدم'}
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">{formatDate()}</p>
          {lastUpdated && (
            <p className="text-gray-500 text-xs mt-1">
              آخر تحديث: {formatLastUpdated(lastUpdated)}
            </p>
          )}
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isRefreshing
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-[#2B3544] text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>

          {/* New Sale Button */}
          <Link
            href="/pos"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">بيع جديد</span>
          </Link>

          {/* Reports Button */}
          <Link
            href="/reports"
            className="flex items-center gap-2 px-4 py-2 bg-[#2B3544] text-gray-300 rounded-lg hover:text-white hover:bg-gray-600 transition-colors"
          >
            <ChartBarIcon className="w-5 h-5" />
            <span className="hidden sm:inline">التقارير</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
