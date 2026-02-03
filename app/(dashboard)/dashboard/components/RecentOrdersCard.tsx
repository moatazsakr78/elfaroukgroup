'use client';

import { ClipboardDocumentListIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { RecentOrder } from '../hooks/useDashboardData';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface RecentOrdersCardProps {
  orders: RecentOrder[];
  loading?: boolean;
}

// Order status configuration
const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'معلق', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  processing: { label: 'جاري التجهيز', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  ready: { label: 'جاهز', bg: 'bg-green-500/20', text: 'text-green-400' },
  shipped: { label: 'تم الشحن', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  delivered: { label: 'تم التسليم', bg: 'bg-gray-500/20', text: 'text-gray-400' },
  cancelled: { label: 'ملغي', bg: 'bg-red-500/20', text: 'text-red-400' },
};

// Format relative time in Arabic
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'الآن';
  if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'منذ يوم';
  if (diffInDays < 7) return `منذ ${diffInDays} أيام`;

  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
};

export default function RecentOrdersCard({ orders, loading = false }: RecentOrdersCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">آخر الطلبات</h3>
          <ClipboardDocumentListIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
              <div className="flex-1">
                <div className="h-4 bg-gray-600 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/3"></div>
              </div>
              <div className="h-6 bg-gray-600 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">آخر الطلبات</h3>
          <ClipboardDocumentListIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <ClipboardDocumentListIcon className="w-12 h-12 mb-3 opacity-50" />
          <p>لا توجد طلبات حديثة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">آخر الطلبات</h3>
        <ClipboardDocumentListIcon className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-2">
        {orders.map((order) => {
          const status = statusConfig[order.status] || statusConfig.pending;

          return (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 bg-[#2B3544] rounded-lg hover:bg-[#323d4d] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-sm truncate">
                    {order.order_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="truncate">{order.customer_name}</span>
                  <span>•</span>
                  <span className="whitespace-nowrap">{formatRelativeTime(order.created_at)}</span>
                </div>
              </div>
              <div className="text-green-400 font-semibold text-sm whitespace-nowrap mr-2">
                {formatCurrencyAr(order.total_amount)}
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/customer-orders"
        className="flex items-center justify-center gap-2 mt-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        <span>عرض جميع الطلبات</span>
        <ArrowLeftIcon className="w-4 h-4" />
      </Link>
    </div>
  );
}
