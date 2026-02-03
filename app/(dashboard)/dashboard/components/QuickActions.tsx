'use client';

import Link from 'next/link';
import {
  PlusIcon,
  ShoppingCartIcon,
  UserPlusIcon,
  CubeIcon,
  DocumentTextIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

const actions: QuickAction[] = [
  {
    label: 'بيع جديد',
    href: '/pos',
    icon: ShoppingCartIcon,
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'افتح نقطة البيع',
  },
  {
    label: 'منتج جديد',
    href: '/products?action=add',
    icon: CubeIcon,
    color: 'bg-green-500 hover:bg-green-600',
    description: 'أضف منتج للمخزون',
  },
  {
    label: 'عميل جديد',
    href: '/customers?action=add',
    icon: UserPlusIcon,
    color: 'bg-purple-500 hover:bg-purple-600',
    description: 'سجل عميل جديد',
  },
  {
    label: 'فاتورة مشتريات',
    href: '/suppliers?action=purchase',
    icon: DocumentTextIcon,
    color: 'bg-orange-500 hover:bg-orange-600',
    description: 'أضف فاتورة مشتريات',
  },
  {
    label: 'مصروف جديد',
    href: '/safes?action=expense',
    icon: BanknotesIcon,
    color: 'bg-red-500 hover:bg-red-600',
    description: 'سجل مصروف',
  },
];

export default function QuickActions() {
  return (
    <div className="bg-[#374151] rounded-xl border border-gray-600 p-5">
      <h3 className="text-lg font-semibold text-white mb-4">إجراءات سريعة</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex flex-col items-center p-4 bg-[#2B3544] rounded-xl hover:bg-[#323d4d] transition-all duration-200"
          >
            <div className={`p-3 rounded-xl ${action.color} text-white mb-3 transition-transform group-hover:scale-110`}>
              <action.icon className="w-6 h-6" />
            </div>
            <span className="text-white text-sm font-medium text-center">{action.label}</span>
            <span className="text-gray-500 text-xs text-center mt-1 hidden sm:block">
              {action.description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
