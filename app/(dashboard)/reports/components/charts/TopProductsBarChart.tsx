'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TopProductData, DateFilter } from '../../types/reports';
import { reportsService } from '../../services/reportsService';
import { CATEGORY_COLORS, DARK_THEME, getChartConfig, formatCurrencyAr } from '../../utils/chartConfig';

interface TopProductsBarChartProps {
  dateFilter: DateFilter;
  height?: number;
  limit?: number;
  externalData?: TopProductData[];
}

export default function TopProductsBarChart({ dateFilter, height = 300, limit = 10, externalData }: TopProductsBarChartProps) {
  const [data, setData] = useState<TopProductData[]>([]);
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
        const products = await reportsService.fetchTopProducts(dateFilter, limit);
        setData(products);
      } catch (err) {
        console.error('Error fetching top products:', err);
        setError('خطأ في تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateFilter, limit, externalData]);

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
        <h3 className="text-white font-semibold mb-4 text-right">أفضل 10 منتجات</h3>
        <div className="flex items-center justify-center text-red-400" style={{ height }}>
          {error}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
        <h3 className="text-white font-semibold mb-4 text-right">أفضل 10 منتجات</h3>
        <div className="flex items-center justify-center text-gray-400" style={{ height }}>
          لا توجد بيانات للفترة المحددة
        </div>
      </div>
    );
  }

  // Reverse for RTL display
  const chartData = [...data].reverse();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
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
          <p className="text-white font-semibold mb-2">{item.productName}</p>
          <p className="text-gray-400 text-xs mb-2">{item.categoryName}</p>
          <p className="text-gray-300">الإجمالي: {formatCurrencyAr(item.totalRevenue)}</p>
          <p className="text-gray-300">الكمية: {item.totalQuantity}</p>
          <p className="text-green-400">الربح: {formatCurrencyAr(item.totalProfit)}</p>
          <p className="text-blue-400">هامش الربح: {item.profitMargin.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
      <h3 className="text-white font-semibold mb-4 text-right">أفضل 10 منتجات</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid {...chartConfig.cartesianGrid} horizontal={true} vertical={false} />
          <XAxis
            type="number"
            {...chartConfig.xAxis}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <YAxis
            type="category"
            dataKey="productName"
            {...chartConfig.yAxis}
            width={120}
            tick={{ fill: DARK_THEME.textColor, fontSize: 11 }}
            tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
