'use client';

export default function DashboardSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-gray-600 rounded w-64 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-48"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#374151] rounded-xl border border-gray-600 p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-600 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-600 rounded w-1/3"></div>
              </div>
              <div className="w-14 h-14 bg-gray-600 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Trend Chart */}
        <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-700 rounded"></div>
        </div>
      </div>

      {/* Top Products Chart Skeleton */}
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5 mb-6">
        <div className="h-6 bg-gray-600 rounded w-1/4 mb-4"></div>
        <div className="h-48 bg-gray-700 rounded"></div>
      </div>

      {/* Cards Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Orders */}
        <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-600 rounded w-1/3"></div>
                </div>
                <div className="h-4 bg-gray-600 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
                <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-600 rounded w-1/3"></div>
                </div>
                <div className="h-4 bg-gray-600 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Skeleton */}
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="h-6 bg-gray-600 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
              <div className="flex-1">
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/2"></div>
              </div>
              <div className="h-6 bg-gray-600 rounded w-12"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
