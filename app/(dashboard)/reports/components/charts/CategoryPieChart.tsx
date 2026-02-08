'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { CategoryDistribution, DateFilter } from '../../types/reports';
import { reportsService } from '../../services/reportsService';
import { CATEGORY_COLORS, DARK_THEME, formatCurrencyAr, formatPercentage } from '../../utils/chartConfig';

interface CategoryPieChartProps {
  dateFilter: DateFilter;
  height?: number;
  externalData?: CategoryDistribution[];
}

export default function CategoryPieChart({ dateFilter, height = 300, externalData }: CategoryPieChartProps) {
  const [data, setData] = useState<CategoryDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCategories = (categories: CategoryDistribution[]) => {
      if (categories.length > 8) {
        const top7 = categories.slice(0, 7);
        const others = categories.slice(7);
        const othersTotal = others.reduce((sum, c) => sum + c.totalRevenue, 0);
        const othersPercentage = others.reduce((sum, c) => sum + c.percentage, 0);
        setData([
          ...top7,
          {
            id: 'others',
            categoryName: 'أخرى',
            totalRevenue: othersTotal,
            percentage: othersPercentage,
            invoiceCount: others.reduce((sum, c) => sum + c.invoiceCount, 0),
          },
        ]);
      } else {
        setData(categories);
      }
    };

    if (externalData) {
      processCategories(externalData);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const categories = await reportsService.fetchCategoryDistribution(dateFilter);
        processCategories(categories);
      } catch (err) {
        console.error('Error fetching category distribution:', err);
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
        <h3 className="text-white font-semibold mb-4 text-right">توزيع التصنيفات</h3>
        <div className="flex items-center justify-center text-red-400" style={{ height }}>
          {error}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
        <h3 className="text-white font-semibold mb-4 text-right">توزيع التصنيفات</h3>
        <div className="flex items-center justify-center text-gray-400" style={{ height }}>
          لا توجد بيانات للفترة المحددة
        </div>
      </div>
    );
  }

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
          <p className="text-white font-semibold mb-2">{item.categoryName}</p>
          <p className="text-gray-300">الإجمالي: {formatCurrencyAr(item.totalRevenue)}</p>
          <p className="text-gray-300">النسبة: {formatPercentage(item.percentage)}</p>
          <p className="text-gray-300">عدد الفواتير: {item.invoiceCount}</p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-2 mt-2" style={{ direction: 'rtl' }}>
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-300 text-xs">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-[#374151] rounded-lg border border-gray-600 p-4">
      <h3 className="text-white font-semibold mb-4 text-right">توزيع التصنيفات</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="totalRevenue"
            nameKey="categoryName"
            label={(props: any) => {
              const { payload, percent } = props;
              return percent > 0.05 ? `${payload.categoryName} (${(percent * 100).toFixed(1)}%)` : '';
            }}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
