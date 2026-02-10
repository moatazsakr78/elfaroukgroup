'use client';

import { BanknotesIcon, BuildingStorefrontIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { CapitalData } from '../hooks/useDashboardData';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface CapitalCardProps {
  data: CapitalData | null;
  loading?: boolean;
}

export default function CapitalCard({ data, loading = false }: CapitalCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">مشتريات الفترة</h3>
          <BanknotesIcon className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
              <div className="flex-1">
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.branches.length === 0) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">مشتريات الفترة</h3>
          <BanknotesIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center mb-3">
            <BanknotesIcon className="w-6 h-6 text-gray-500" />
          </div>
          <p className="text-gray-400">لا توجد مشتريات في هذه الفترة</p>
        </div>
      </div>
    );
  }

  const branchCount = data.branches.filter(b => b.type === 'branch').length;
  const warehouseCount = data.branches.filter(b => b.type === 'warehouse').length;

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">مشتريات الفترة</h3>
          <div className="flex items-center gap-1">
            {branchCount > 0 && (
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">
                {branchCount} فرع
              </span>
            )}
            {warehouseCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                {warehouseCount} مخزن
              </span>
            )}
          </div>
        </div>
        <BanknotesIcon className="w-5 h-5 text-emerald-400" />
      </div>

      {/* Total */}
      <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-gray-400 text-xs mb-1">إجمالي المشتريات</p>
        <p className="text-2xl font-bold text-emerald-400">{formatCurrencyAr(data.totalCapital)}</p>
      </div>

      {/* Location Breakdown */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
        {data.branches.map((location) => {
          const percentage = data.totalCapital > 0 ? (location.capital / data.totalCapital) * 100 : 0;
          const isBranch = location.type === 'branch';

          return (
            <div
              key={`${location.type}:${location.id}`}
              className="p-3 bg-[#2B3544] rounded-lg"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {isBranch ? (
                    <BuildingStorefrontIcon className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <BuildingOffice2Icon className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-white text-sm font-medium">{location.name}</span>
                </div>
                <span className={`text-sm font-semibold ${isBranch ? 'text-emerald-300' : 'text-blue-300'}`}>
                  {formatCurrencyAr(location.capital)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isBranch ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-gray-400 text-xs min-w-[40px] text-left">{percentage.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
