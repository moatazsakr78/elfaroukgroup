'use client';

import { ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { LowStockProduct } from '../hooks/useDashboardData';

interface LowStockCardProps {
  products: LowStockProduct[];
  loading?: boolean;
}

export default function LowStockCard({ products, loading = false }: LowStockCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">تنبيهات المخزون</h3>
          <ExclamationTriangleIcon className="w-5 h-5 text-orange-400" />
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

  if (products.length === 0) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">تنبيهات المخزون</h3>
          <ExclamationTriangleIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-green-400" />
          </div>
          <p className="text-green-400">المخزون في حالة جيدة</p>
          <p className="text-xs text-gray-500 mt-1">لا توجد منتجات منخفضة المخزون</p>
        </div>
      </div>
    );
  }

  // Determine severity
  const getSeverity = (quantity: number, minStock: number) => {
    const ratio = quantity / minStock;
    if (ratio === 0) return 'critical'; // Out of stock
    if (ratio < 0.25) return 'high';
    if (ratio < 0.5) return 'medium';
    return 'low';
  };

  const severityConfig = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'نفذ' },
    high: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'حرج' },
    medium: { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'منخفض' },
    low: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'تحذير' },
  };

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">تنبيهات المخزون</h3>
          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
            {products.length}
          </span>
        </div>
        <ExclamationTriangleIcon className="w-5 h-5 text-orange-400" />
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
        {products.map((product) => {
          const severity = getSeverity(product.quantity, product.min_stock);
          const config = severityConfig[severity];

          return (
            <div
              key={product.id}
              className={`flex items-center justify-between p-3 rounded-lg ${config.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{product.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <span>الكمية: <span className={config.text}>{product.quantity}</span></span>
                  <span>|</span>
                  <span>الحد الأدنى: {product.min_stock}</span>
                  {product.branch_name && (
                    <>
                      <span>|</span>
                      <span>{product.branch_name}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
                {config.label}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href="/inventory"
        className="flex items-center justify-center gap-2 mt-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        <span>عرض المخزون الكامل</span>
        <ArrowLeftIcon className="w-4 h-4" />
      </Link>
    </div>
  );
}
