'use client';

import { UserGroupIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { TopCustomerData } from '../../reports/types/reports';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface TopCustomersCardProps {
  customers: TopCustomerData[];
  loading?: boolean;
}

export default function TopCustomersCard({ customers, loading = false }: TopCustomersCardProps) {
  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">أفضل العملاء</h3>
          <UserGroupIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg">
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
    );
  }

  if (customers.length === 0) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">أفضل العملاء</h3>
          <UserGroupIcon className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <UserGroupIcon className="w-12 h-12 mb-3 opacity-50" />
          <p>لا توجد بيانات للعملاء</p>
        </div>
      </div>
    );
  }

  // Generate avatar background color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Get initials from name
  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return words[0][0] + words[1][0];
    }
    return name.substring(0, 2);
  };

  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">أفضل العملاء</h3>
        <UserGroupIcon className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-2">
        {customers.map((customer, index) => (
          <div
            key={customer.id}
            className="flex items-center gap-3 p-3 bg-[#2B3544] rounded-lg hover:bg-[#323d4d] transition-colors"
          >
            {/* Rank Badge */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              index === 0 ? 'bg-yellow-500 text-yellow-900' :
              index === 1 ? 'bg-gray-300 text-gray-700' :
              index === 2 ? 'bg-orange-400 text-orange-900' :
              'bg-gray-600 text-gray-300'
            }`}>
              {index + 1}
            </div>

            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full ${getAvatarColor(customer.customerName)} flex items-center justify-center text-white text-sm font-medium`}>
              {getInitials(customer.customerName)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{customer.customerName}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{customer.invoiceCount} فاتورة</span>
                {customer.phone && (
                  <>
                    <span>•</span>
                    <span dir="ltr">{customer.phone}</span>
                  </>
                )}
              </div>
            </div>

            {/* Total Spent */}
            <div className="text-left">
              <p className="text-green-400 font-semibold text-sm whitespace-nowrap">
                {formatCurrencyAr(customer.totalSpent)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/customers"
        className="flex items-center justify-center gap-2 mt-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        <span>عرض جميع العملاء</span>
        <ArrowLeftIcon className="w-4 h-4" />
      </Link>
    </div>
  );
}
