'use client';

import { BanknotesIcon } from '@heroicons/react/24/outline';
import { CapitalData } from '../hooks/useDashboardData';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface PurchasesStatsCardProps {
  data: CapitalData | null;
  loading?: boolean;
}

export default function PurchasesStatsCard({ data, loading = false }: PurchasesStatsCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded w-1/2 mb-3"></div>
              <div className="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-2/3 mb-1.5"></div>
              <div className="h-4 bg-gray-600 rounded w-2/3"></div>
            </div>
            <div className="w-14 h-14 bg-gray-600 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const total = data?.totalCapital || 0;
  const branches = data?.branches || [];

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5 bg-green-500/10 hover:border-gray-500 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-sm font-medium mb-2">مشتريات الفترة</p>
          <p className="text-white font-bold text-lg mb-2">{formatCurrencyAr(total)}</p>
          {branches.length > 0 && (
            <div className="space-y-1.5 max-h-[88px] overflow-y-auto scrollbar-hide">
              {branches.map((location) => {
                const percentage = total > 0 ? (location.capital / total) * 100 : 0;
                const isBranch = location.type === 'branch';
                return (
                  <div key={`${location.type}:${location.id}`} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isBranch ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                    <span className="text-white text-xs truncate">{location.name}</span>
                    <span className={`text-xs font-bold mr-auto truncate ${isBranch ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {formatCurrencyAr(location.capital)}
                    </span>
                    <span className="text-gray-400 text-xs flex-shrink-0">({percentage.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl bg-green-500/20 flex-shrink-0">
          <BanknotesIcon className="w-8 h-8 text-green-400" />
        </div>
      </div>
    </div>
  );
}
