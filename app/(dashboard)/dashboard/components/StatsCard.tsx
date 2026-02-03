'use client';

import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { formatCurrencyAr } from '../../reports/utils/chartConfig';

interface StatsCardProps {
  title: string;
  value: number;
  previousValue?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange';
  format?: 'currency' | 'number';
  loading?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
  green: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    iconBg: 'bg-green-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/20',
  },
  red: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    iconBg: 'bg-red-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    iconBg: 'bg-orange-500/20',
  },
};

export default function StatsCard({
  title,
  value,
  previousValue,
  icon: Icon,
  color,
  format = 'number',
  loading = false,
}: StatsCardProps) {
  const colors = colorClasses[color];

  // Calculate percentage change
  const calculateChange = () => {
    if (previousValue === undefined || previousValue === 0) return null;
    const change = ((value - previousValue) / previousValue) * 100;
    return change;
  };

  const change = calculateChange();
  const isPositive = change !== null && change >= 0;

  // Format the value
  const formatValue = (val: number) => {
    if (format === 'currency') {
      return formatCurrencyAr(val);
    }
    return val.toLocaleString('ar-EG');
  };

  if (loading) {
    return (
      <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gray-600 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-600 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-1/3"></div>
            </div>
            <div className="w-14 h-14 bg-gray-600 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#374151] rounded-xl border border-gray-600 p-5 ${colors.bg} hover:border-gray-500 transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-white mb-2">
            {formatValue(value)}
          </p>
          {change !== null && (
            <div className="flex items-center gap-1">
              {isPositive ? (
                <ArrowTrendingUpIcon className="w-4 h-4 text-green-400" />
              ) : (
                <ArrowTrendingDownIcon className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-gray-500 text-xs mr-1">من السابق</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colors.iconBg}`}>
          <Icon className={`w-8 h-8 ${colors.text}`} />
        </div>
      </div>
    </div>
  );
}
