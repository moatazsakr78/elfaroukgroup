'use client';

import {
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { ActivityLogEntry } from '../hooks/useActivityLogs';

interface ActivityLogsListProps {
  logs: ActivityLogEntry[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const actionConfig: Record<string, { icon: typeof PlusCircleIcon; color: string; bg: string }> = {
  create: { icon: PlusCircleIcon, color: 'text-green-400', bg: 'bg-green-500/10' },
  update: { icon: PencilSquareIcon, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  delete: { icon: TrashIcon, color: 'text-red-400', bg: 'bg-red-500/10' },
};

const entityLabels: Record<string, { label: string; color: string }> = {
  product: { label: 'المنتجات', color: 'bg-purple-500/20 text-purple-400' },
  sale: { label: 'المبيعات', color: 'bg-green-500/20 text-green-400' },
  customer: { label: 'العملاء', color: 'bg-blue-500/20 text-blue-400' },
  supplier: { label: 'الموردين', color: 'bg-orange-500/20 text-orange-400' },
  inventory: { label: 'المخزون', color: 'bg-yellow-500/20 text-yellow-400' },
  purchase: { label: 'المشتريات', color: 'bg-cyan-500/20 text-cyan-400' },
  order: { label: 'الطلبات', color: 'bg-indigo-500/20 text-indigo-400' },
  expense: { label: 'المصروفات', color: 'bg-red-500/20 text-red-400' },
  cash_drawer: { label: 'الخزن', color: 'bg-emerald-500/20 text-emerald-400' },
  payment_method: { label: 'الدفع', color: 'bg-teal-500/20 text-teal-400' },
  category: { label: 'الأصناف', color: 'bg-pink-500/20 text-pink-400' },
  setting: { label: 'الإعدادات', color: 'bg-gray-500/20 text-gray-400' },
  permission: { label: 'الصلاحيات', color: 'bg-amber-500/20 text-amber-400' },
  user: { label: 'المستخدمين', color: 'bg-sky-500/20 text-sky-400' },
};

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

  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ActivityLogsList({
  logs,
  loading,
  page,
  totalPages,
  onPageChange,
}: ActivityLogsListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
            <div className="w-9 h-9 bg-gray-600 rounded-full flex-shrink-0"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-600 rounded w-1/3"></div>
            </div>
            <div className="h-5 bg-gray-600 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <PencilSquareIcon className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg">لا توجد سجلات نشاط</p>
        <p className="text-sm mt-1">لم يتم تسجيل أي نشاط بعد</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {logs.map((log) => {
          const config = actionConfig[log.action_type] || actionConfig.update;
          const Icon = config.icon;
          const entity = entityLabels[log.entity_type] || { label: log.entity_type, color: 'bg-gray-500/20 text-gray-400' };

          return (
            <div
              key={log.id}
              className="flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg hover:bg-[#323d4d] transition-colors"
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                <Icon className={`w-5 h-5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{log.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span className="truncate">{log.user_name}</span>
                  <span>•</span>
                  <span className="whitespace-nowrap">{formatRelativeTime(log.created_at)}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${entity.color}`}>
                {entity.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                    page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
