'use client';

import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface InvoiceStatsCardProps {
  periodLabel: string;
  invoiceCount: number;
  invoiceTotal: number;
  returnCount: number;
  returnTotal: number;
  loading?: boolean;
}

export default function InvoiceStatsCard({
  periodLabel,
  invoiceCount,
  invoiceTotal,
  returnCount,
  returnTotal,
  loading = false,
}: InvoiceStatsCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded w-1/2 mb-3"></div>
              <div className="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-600 rounded w-3/4"></div>
            </div>
            <div className="w-14 h-14 bg-gray-600 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5 bg-green-500/10 hover:border-gray-500 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-sm font-medium mb-2">{`فواتير ${periodLabel}`}</p>
          {/* Invoice row */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0"></span>
            <span className="text-white font-bold text-sm">{invoiceCount.toLocaleString('ar-EG')}</span>
            <span className="text-gray-400 text-xs">فاتورة</span>
            <span className="text-green-400 font-bold text-sm mr-auto truncate">{formatCurrencyAr(invoiceTotal)}</span>
          </div>
          {/* Return row */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0"></span>
            <span className="text-white font-bold text-sm">{returnCount.toLocaleString('ar-EG')}</span>
            <span className="text-gray-400 text-xs">مرتجع</span>
            <span className="text-red-400 font-bold text-sm mr-auto truncate">{returnTotal > 0 ? `-${formatCurrencyAr(returnTotal)}` : formatCurrencyAr(0)}</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-green-500/20 flex-shrink-0">
          <DocumentTextIcon className="w-8 h-8 text-green-400" />
        </div>
      </div>
    </div>
  );
}
