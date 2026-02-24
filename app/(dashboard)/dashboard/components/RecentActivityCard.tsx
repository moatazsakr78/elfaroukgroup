'use client';

import {
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export interface ActivityLog {
  id: string;
  user_name: string;
  entity_type: string;
  action_type: string;
  description: string;
  created_at: string;
}

interface RecentActivityCardProps {
  activities: ActivityLog[];
  loading?: boolean;
}

const actionConfig: Record<string, { icon: typeof PlusCircleIcon; color: string }> = {
  create: { icon: PlusCircleIcon, color: 'text-green-400' },
  update: { icon: PencilSquareIcon, color: 'text-blue-400' },
  delete: { icon: TrashIcon, color: 'text-red-400' },
};

const entityLabels: Record<string, string> = {
  product: 'المنتجات',
  sale: 'المبيعات',
  customer: 'العملاء',
  supplier: 'الموردين',
  inventory: 'المخزون',
  purchase: 'المشتريات',
  order: 'الطلبات',
  expense: 'المصروفات',
  cash_drawer: 'الخزن',
  payment_method: 'الدفع',
  category: 'الأصناف',
  setting: 'الإعدادات',
  permission: 'الصلاحيات',
  user: 'المستخدمين',
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

  return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
};

export default function RecentActivityCard({ activities, loading = false }: RecentActivityCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">آخر النشاط</h3>
          <ClipboardDocumentCheckIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
              <div className="w-8 h-8 bg-gray-600 rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">آخر النشاط</h3>
          <ClipboardDocumentCheckIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <ClipboardDocumentCheckIcon className="w-12 h-12 mb-3 opacity-50" />
          <p>لا يوجد نشاط حديث</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">آخر النشاط</h3>
        <ClipboardDocumentCheckIcon className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-2">
        {activities.map((activity) => {
          const config = actionConfig[activity.action_type] || actionConfig.update;
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg hover:bg-[#323d4d] transition-colors"
            >
              <div className={`flex-shrink-0 ${config.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{activity.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span className="truncate">{activity.user_name}</span>
                  <span>•</span>
                  <span className="whitespace-nowrap">{formatRelativeTime(activity.created_at)}</span>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600/50 text-gray-300 whitespace-nowrap flex-shrink-0">
                {entityLabels[activity.entity_type] || activity.entity_type}
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href="/activity-logs"
        className="flex items-center justify-center gap-2 mt-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        <span>عرض المزيد</span>
        <ArrowLeftIcon className="w-4 h-4" />
      </Link>
    </div>
  );
}
