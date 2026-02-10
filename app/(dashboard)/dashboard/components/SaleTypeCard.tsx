'use client';

import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface SaleTypeCardProps {
  periodLabel: string;
  groundInvoiceCount: number;
  groundInvoiceTotal: number;
  groundReturnCount: number;
  groundReturnTotal: number;
  groundPercentage: number;
  onlineInvoiceCount: number;
  onlineInvoiceTotal: number;
  onlineReturnCount: number;
  onlineReturnTotal: number;
  onlinePercentage: number;
  onlineShippingTotal: number;
  loading?: boolean;
}

export default function SaleTypeCard({
  periodLabel,
  groundInvoiceCount,
  groundInvoiceTotal,
  groundReturnCount,
  groundReturnTotal,
  groundPercentage,
  onlineInvoiceCount,
  onlineInvoiceTotal,
  onlineReturnCount,
  onlineReturnTotal,
  onlinePercentage,
  onlineShippingTotal,
  loading = false,
}: SaleTypeCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded w-1/2 mb-3"></div>
              <div className="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
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
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5 bg-blue-500/10 hover:border-gray-500 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-sm font-medium mb-2">{`تصنيف مبيعات ${periodLabel}`}</p>
          {/* Ground invoices row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0"></span>
            <span className="text-white font-bold text-sm">{groundInvoiceCount.toLocaleString('ar-EG')}</span>
            <span className="text-gray-400 text-xs">فاتورة أرضي</span>
            <span className="text-green-400 font-bold text-sm mr-auto truncate">
              {formatCurrencyAr(groundInvoiceTotal)}
            </span>
            <span className="text-gray-500 text-xs">{groundPercentage.toFixed(0)}%</span>
          </div>
          {/* Ground returns row */}
          {groundReturnCount > 0 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0"></span>
              <span className="text-white font-bold text-sm">{groundReturnCount.toLocaleString('ar-EG')}</span>
              <span className="text-gray-400 text-xs">مرتجع أرضي</span>
              <span className="text-red-400 font-bold text-sm mr-auto truncate">
                -{formatCurrencyAr(Math.abs(groundReturnTotal))}
              </span>
            </div>
          )}
          {/* Online invoices row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0"></span>
            <span className="text-white font-bold text-sm">{onlineInvoiceCount.toLocaleString('ar-EG')}</span>
            <span className="text-gray-400 text-xs">فاتورة أون لاين</span>
            <span className="text-blue-400 font-bold text-sm mr-auto truncate">
              {formatCurrencyAr(onlineInvoiceTotal)}
            </span>
            <span className="text-gray-500 text-xs">{onlinePercentage.toFixed(0)}%</span>
          </div>
          {/* Online returns row */}
          {onlineReturnCount > 0 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0"></span>
              <span className="text-white font-bold text-sm">{onlineReturnCount.toLocaleString('ar-EG')}</span>
              <span className="text-gray-400 text-xs">مرتجع أون لاين</span>
              <span className="text-red-400 font-bold text-sm mr-auto truncate">
                -{formatCurrencyAr(Math.abs(onlineReturnTotal))}
              </span>
            </div>
          )}
          {/* Shipping total (only if > 0) */}
          {onlineShippingTotal > 0 && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2.5 h-2.5 flex-shrink-0"></span>
              <span className="text-gray-500 text-xs">شحن: {formatCurrencyAr(onlineShippingTotal)}</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl bg-blue-500/20 flex-shrink-0">
          <BuildingStorefrontIcon className="w-8 h-8 text-blue-400" />
        </div>
      </div>
    </div>
  );
}
