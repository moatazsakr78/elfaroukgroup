'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bars3Icon, GlobeAltIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { SignalIcon, SignalSlashIcon } from '@heroicons/react/24/solid';
import { useOfflineStatus } from '@/app/lib/hooks/useOfflineStatus';
import { triggerManualSync, isSyncInProgress } from '@/app/lib/offline/syncManager';
import PendingSalesModal from '../PendingSalesModal';

interface TopHeaderProps {
  onMenuClick?: () => void;
  isMenuOpen?: boolean;
  pageTitle?: string;
}

export default function TopHeader({ onMenuClick, isMenuOpen = false, pageTitle }: TopHeaderProps) {
  const pathname = usePathname();
  const { isOnline, pendingSalesCount, connectionQuality, isOfflineReady } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPendingSalesModal, setShowPendingSalesModal] = useState(false);

  // Function to get page title based on pathname
  const getPageTitle = (): string => {
    // If pageTitle prop is provided, use it
    if (pageTitle) {
      return pageTitle;
    }

    // Otherwise, determine title from pathname
    const pathMap: { [key: string]: string } = {
      '/pos': 'نقطة البيع',
      '/products': 'المنتجات',
      '/inventory': 'المخزون',
      '/customers': 'العملاء',
      '/suppliers': 'الموردين',
      '/safes': 'الخزن',
      '/reports': 'التقارير',
      '/permissions': 'الصلاحيات',
      '/settings': 'الإعدادات',
      '/dashboard': 'لوحة التحكم',
    };

    return pathMap[pathname || ''] || 'نظام نقاط البيع';
  };

  // Handle manual sync
  const handleSync = async () => {
    if (!isOnline || isSyncInProgress()) return;

    setIsSyncing(true);
    try {
      await triggerManualSync();
    } finally {
      setIsSyncing(false);
    }
  };

  // Hide header on website pages
  if (pathname === '/' ||
      (pathname?.startsWith('/product') && pathname !== '/products') ||
      pathname === '/cart' ||
      pathname?.startsWith('/auth/') ||
      pathname?.startsWith('/admin/products') ||
      pathname?.startsWith('/shipping') ||
      pathname === '/my-orders' ||
      pathname === '/profile' ||
      pathname === '/customer-orders' ||
      pathname === '/my-invoices' ||
      pathname === '/social-media') {
    return null;
  }

  // Get connection status indicator
  const getConnectionIndicator = () => {
    if (!isOnline) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full" title="غير متصل بالإنترنت">
          <SignalSlashIcon className="h-4 w-4 text-red-400" />
          <span className="text-xs text-red-400 hidden sm:inline">غير متصل</span>
        </div>
      );
    }

    if (connectionQuality === 'slow') {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-full" title="الاتصال بطيء">
          <SignalIcon className="h-4 w-4 text-yellow-400" />
          <span className="text-xs text-yellow-400 hidden sm:inline">بطيء</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full" title="متصل">
        <SignalIcon className="h-4 w-4 text-green-400" />
        <span className="text-xs text-green-400 hidden sm:inline">متصل</span>
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-[#374151] border-b border-gray-600 px-4">
      <div className="flex items-center justify-between h-full">
        {/* Left side - Menu button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            className="p-2 text-white"
            aria-label={isMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Connection status */}
          {getConnectionIndicator()}

          {/* Pending sales indicator */}
          {pendingSalesCount > 0 && (
            <button
              onClick={() => setShowPendingSalesModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-full transition-colors bg-orange-500/20 hover:bg-orange-500/30 cursor-pointer"
              title={`${pendingSalesCount} فواتير في الانتظار - اضغط للعرض`}
            >
              <CloudArrowUpIcon className={`h-4 w-4 text-orange-400 ${isSyncing ? 'animate-pulse' : ''}`} />
              <span className="text-xs text-orange-400 font-medium">{pendingSalesCount}</span>
            </button>
          )}
        </div>

        {/* Center - App title */}
        <div className="flex items-center">
          <h1 className="text-white text-lg font-semibold">{getPageTitle()}</h1>
        </div>

        {/* Right side - Website button */}
        <div className="flex items-center">
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 px-3 py-1.5 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors"
            title="انتقل إلى الموقع الإلكتروني"
          >
            <GlobeAltIcon className="h-5 w-5" />
            <span className="text-sm font-medium">الموقع</span>
          </button>
        </div>
      </div>

      {/* Pending Sales Modal */}
      <PendingSalesModal
        isOpen={showPendingSalesModal}
        onClose={() => setShowPendingSalesModal(false)}
      />
    </div>
  );
}
