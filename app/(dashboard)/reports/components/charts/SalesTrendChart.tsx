'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SalesTrendPoint, DateFilter } from '../../types/reports';
import { reportsService } from '../../services/reportsService';
import { CHART_COLORS, DARK_THEME, getChartConfig, formatCurrencyAr } from '../../utils/chartConfig';

interface SalesTrendChartProps {
  dateFilter: DateFilter;
  height?: number;
  externalData?: SalesTrendPoint[];
}

export default function SalesTrendChart({ dateFilter, height = 300, externalData }: SalesTrendChartProps) {
  const [data, setData] = useState<SalesTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartConfig = getChartConfig();

  useEffect(() => {
    if (externalData) {
      setData(externalData);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const trend = await reportsService.fetchSalesTrend(dateFilter, 30);
        setData(trend);
      } catch (err) {
        console.error('Error fetching sales trend:', err);
        setError('خطأ في تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateFilter, externalData]);

  if (loading) {
    return (
      <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
        <div className="h-8 bg-gray-600 rounded w-1/3 mb-4"></div>
        <div className="animate-pulse bg-gray-600 rounded" style={{ height }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
        <h3 className="text-white font-semibold mb-4 text-right">ترند المبيعات</h3>
        <div className="flex items-center justify-center text-red-400" style={{ height }}>
          {error}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
        <h3 className="text-white font-semibold mb-4 text-right">ترند المبيعات</h3>
        <div className="flex items-center justify-center text-gray-400" style={{ height }}>
          لا توجد بيانات للفترة المحددة
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: DARK_THEME.tooltipBackground,
            border: `1px solid ${DARK_THEME.tooltipBorder}`,
            borderRadius: '8px',
            padding: '12px',
            direction: 'rtl',
          }}
        >
          <p className="text-white font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name === 'sales' ? 'المبيعات' : 'الربح'}: {formatCurrencyAr(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
      <h3 className="text-white font-semibold mb-4 text-right">ترند المبيعات</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...chartConfig.cartesianGrid} />
          <XAxis
            dataKey="displayDate"
            {...chartConfig.xAxis}
            reversed={true}
          />
          <YAxis
            {...chartConfig.yAxis}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            orientation="left"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ direction: 'rtl', paddingTop: '10px' }}
            formatter={(value) => (value === 'sales' ? 'المبيعات' : 'الربح')}
          />
          <Area
            type="monotone"
            dataKey="sales"
            name="sales"
            stroke={CHART_COLORS.primary}
            fillOpacity={1}
            fill="url(#colorSales)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="profit"
            name="profit"
            stroke={CHART_COLORS.success}
            fillOpacity={1}
            fill="url(#colorProfit)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
