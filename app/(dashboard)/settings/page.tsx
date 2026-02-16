'use client';

import { useState, useEffect } from 'react';
import {
  CogIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  BellIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  PhotoIcon,
  BuildingStorefrontIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import BackupSettings from '@/app/components/settings/BackupSettings';
import TopHeader from '@/app/components/layout/TopHeader';
import Sidebar from '@/app/components/layout/Sidebar';
import { Currency, DEFAULT_SYSTEM_CURRENCY, DEFAULT_WEBSITE_CURRENCY, DEFAULT_UNIFIED_CURRENCY, CURRENCY_MODES } from '@/lib/constants/currencies';
import { useCurrencySettings } from '@/lib/hooks/useCurrency';
import { useCurrencySettings as useDbCurrencySettings } from '@/lib/hooks/useSystemSettings';
import { useRatingsDisplay } from '@/lib/hooks/useRatingSettings';
import { useStoreDisplaySettings } from '@/lib/hooks/useStoreDisplaySettings';
import { useCompanySettings } from '@/lib/hooks/useCompanySettings';
import { useStoreThemes } from '@/lib/hooks/useStoreTheme';
import { supabase } from '@/app/lib/supabase/client';
import { clearSettingsCache } from '@/lib/hooks/useProductFilter';
import LogoEditor from '@/app/components/LogoEditor';

// Custom dropdown component with delete buttons
const CurrencyDropdownWithDelete = ({
  value,
  onChange,
  isCustom,
  onCustomToggle,
  customValue,
  onCustomChange,
  placeholder,
  arabicCurrencies,
  onDeleteCurrency,
  allowCustomInput = true,  // New prop to control custom input availability
  allowDelete = true  // New prop to control delete button visibility
}: {
  value: string;
  onChange: (value: string) => void;
  isCustom: boolean;
  onCustomToggle: (custom: boolean) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  placeholder: string;
  arabicCurrencies: string[];
  onDeleteCurrency: (currency: string) => void;
  allowCustomInput?: boolean;  // Optional prop
  allowDelete?: boolean;  // Optional prop
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Main dropdown button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-right flex items-center justify-between"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{isCustom ? 'كتابة مخصصة...' : value || 'اختر العملة'}</span>
      </button>

      {/* Custom dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#2B3544] border border-gray-600 rounded shadow-lg z-50 max-h-60 overflow-y-auto scrollbar-hide">
          {/* Currency options */}
          {arabicCurrencies.map((currency, index) => (
            <div
              key={currency}
              className="flex items-center justify-between p-2 hover:bg-[#374151] group"
            >
              <button
                onClick={() => {
                  onCustomToggle(false);
                  onChange(currency);
                  setIsOpen(false);
                }}
                className="flex-1 text-right text-white text-sm py-1 px-2 hover:bg-[#374151] rounded"
              >
                {currency}
              </button>
              <div className="flex items-center gap-2">
                {allowDelete && index > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCurrency(currency);
                    }}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title={`حذف ${currency}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Custom option - only show if allowed */}
          {allowCustomInput && (
            <div className="border-t border-gray-600 p-2">
              <button
                onClick={() => {
                  onCustomToggle(true);
                  setIsOpen(false);
                }}
                className="w-full text-right text-white text-sm py-1 px-2 hover:bg-[#374151] rounded"
              >
                كتابة مخصصة...
              </button>
            </div>
          )}
        </div>
      )}

      {/* Custom input field */}
      {isCustom && allowCustomInput && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder={placeholder}
          className="w-full mt-2 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-right"
        />
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

interface SettingsCategory {
  id: string;
  name: string;
  icon: any;
  description: string;
}

const settingsCategories: SettingsCategory[] = [
  {
    id: 'system',
    name: 'تصميم النظام',
    icon: CogIcon,
    description: 'إعدادات عامة للنظام والواجهة'
  },
  {
    id: 'language',
    name: 'اللغة',
    icon: GlobeAltIcon,
    description: 'إعدادات اللغة والترجمة'
  },
  {
    id: 'theme',
    name: 'المظهر',
    icon: PaintBrushIcon,
    description: 'إعدادات المظهر والألوان'
  },
  {
    id: 'notifications',
    name: 'الإشعارات',
    icon: BellIcon,
    description: 'إعدادات الإشعارات والتنبيهات'
  },
  {
    id: 'company',
    name: 'شركتي',
    icon: BuildingOfficeIcon,
    description: 'إعدادات معلومات الشركة والعلامة التجارية'
  },
  {
    id: 'store',
    name: 'المتجر',
    icon: BuildingStorefrontIcon,
    description: 'إعدادات ظهور المنتجات في المتجر'
  },
  {
    id: 'security',
    name: 'الأمان',
    icon: ShieldCheckIcon,
    description: 'إعدادات الأمان وكلمات المرور'
  },
  {
    id: 'backup',
    name: 'النسخ الاحتياطي',
    icon: ArrowDownTrayIcon,
    description: 'تصدير واستيراد نسخة احتياطية من البيانات'
  }
];


export default function SettingsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('system');

  // System Settings State
  const [language, setLanguage] = useState('Arabic');
  const [direction, setDirection] = useState('rtl');
  const [theme, setTheme] = useState('dark');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [enableSounds, setEnableSounds] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [showToday, setShowToday] = useState(true);
  const [position, setPosition] = useState('top');
  const [selectedColumns, setSelectedColumns] = useState({
    product: true,
    category: true,
    price: false,
    quantity: true,
    actions: false
  });

  // Currency Settings using database hook
  const {
    currencyMode: dbCurrencyMode,
    systemCurrency: dbSystemCurrency,
    websiteCurrency: dbWebsiteCurrency,
    unifiedCurrency: dbUnifiedCurrency,
    updateCurrencySettings: updateDbCurrencySettings,
    isLoading: isCurrencyLoading,
    availableCurrencies,
    addNewCustomCurrency,
    deleteCustomCurrency
  } = useDbCurrencySettings();

  // Local state for pending changes (not saved until user clicks save)
  const [pendingCurrencyMode, setPendingCurrencyMode] = useState<'separate' | 'unified'>(dbCurrencyMode);
  const [pendingSystemCurrency, setPendingSystemCurrency] = useState(dbSystemCurrency);
  const [pendingWebsiteCurrency, setPendingWebsiteCurrency] = useState(dbWebsiteCurrency);
  const [pendingUnifiedCurrency, setPendingUnifiedCurrency] = useState(dbUnifiedCurrency);

  const [isCustomSystemCurrency, setIsCustomSystemCurrency] = useState(false);
  const [isCustomWebsiteCurrency, setIsCustomWebsiteCurrency] = useState(false);
  const [isCustomUnifiedCurrency, setIsCustomUnifiedCurrency] = useState(false);
  const [customSystemCurrency, setCustomSystemCurrency] = useState('');
  const [customWebsiteCurrency, setCustomWebsiteCurrency] = useState('');
  const [customUnifiedCurrency, setCustomUnifiedCurrency] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Ratings settings using hook
  const { showRatings, updateRatingSettings, isLoading: isRatingsLoading } = useRatingsDisplay();

  // Product display settings state
  const [productDisplayMode, setProductDisplayMode] = useState<'show_all' | 'show_with_stock' | 'show_with_stock_and_vote'>('show_all');
  const [isLoadingDisplayMode, setIsLoadingDisplayMode] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);

  // Company Settings using hook
  const {
    companyName: dbCompanyName,
    logoUrl: dbLogoUrl,
    logoShape: dbLogoShape,
    socialMedia: dbSocialMedia,
    branches: dbBranches,
    updateCompanySettings,
    isLoading: isCompanyLoading
  } = useCompanySettings();

  // Store Theme Settings using hook
  const {
    themes: storeThemes,
    isLoading: isThemesLoading,
    addTheme,
    activateTheme,
    deleteTheme,
    updateTheme
  } = useStoreThemes();

  // Local state for pending changes (not saved until user clicks save)
  const [companyName, setCompanyName] = useState(dbCompanyName);
  const [logoUrl, setLogoUrl] = useState(dbLogoUrl);
  const [logoShape, setLogoShape] = useState<'square' | 'circle'>(dbLogoShape);
  const [socialMedia, setSocialMedia] = useState(dbSocialMedia);
  const [branches, setBranches] = useState(dbBranches);

  // State for database branches
  const [dbBranchesFromDB, setDbBranchesFromDB] = useState<any[]>([]);

  // Store Theme Settings State
  const [isAddThemeModalOpen, setIsAddThemeModalOpen] = useState(false);
  const [isEditThemeModalOpen, setIsEditThemeModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<any | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [newPrimaryColor, setNewPrimaryColor] = useState('#5d1f1f');
  const [newPrimaryHoverColor, setNewPrimaryHoverColor] = useState('#4A1616');
  const [newInteractiveColor, setNewInteractiveColor] = useState('#EF4444');
  const [newButtonColor, setNewButtonColor] = useState('#5d1f1f');
  const [newButtonHoverColor, setNewButtonHoverColor] = useState('#4A1616');

  // Logo Editor State
  const [isLogoEditorOpen, setIsLogoEditorOpen] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);

  // Security Settings State
  const [wasenderTokenConfigured, setWasenderTokenConfigured] = useState(false);
  const [wasenderTokenLastUpdated, setWasenderTokenLastUpdated] = useState<string | null>(null);
  const [isLoadingSecuritySettings, setIsLoadingSecuritySettings] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [showTokenValue, setShowTokenValue] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);

  // Store Display Settings using hook
  const {
    showQuantityInStore,
    showProductStarRating,
    updateStoreDisplaySettings,
    isLoading: isLoadingStoreSettings
  } = useStoreDisplaySettings();

  // Update pending state when database values change
  useEffect(() => {
    setPendingCurrencyMode(dbCurrencyMode);
    setPendingSystemCurrency(dbSystemCurrency);
    setPendingWebsiteCurrency(dbWebsiteCurrency);
    setPendingUnifiedCurrency(dbUnifiedCurrency);
  }, [dbCurrencyMode, dbSystemCurrency, dbWebsiteCurrency, dbUnifiedCurrency]);

  // Update company settings when database values change
  useEffect(() => {
    setCompanyName(dbCompanyName);
    setLogoUrl(dbLogoUrl);
    setSocialMedia(dbSocialMedia);
    setBranches(dbBranches);
  }, [dbCompanyName, dbLogoUrl, dbSocialMedia, dbBranches]);

  // Load branches from database
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('branches')
          .select('id, name, name_en, address, phone')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (error) {
          console.error('Error loading branches:', error);
          return;
        }

        setDbBranchesFromDB(data || []);
      } catch (err) {
        console.error('Error loading branches:', err);
      }
    };

    loadBranches();
  }, []);

  // Load security settings (API key status)
  useEffect(() => {
    const loadSecuritySettings = async () => {
      try {
        const response = await fetch('/api/settings/api-keys?key=wasender_api_token');
        const data = await response.json();
        setWasenderTokenConfigured(data.isConfigured || false);
        setWasenderTokenLastUpdated(data.updatedAt || null);
      } catch (error) {
        console.error('Error loading security settings:', error);
      } finally {
        setIsLoadingSecuritySettings(false);
      }
    };

    loadSecuritySettings();
  }, []);

  // Load product display mode and branches from database
  useEffect(() => {
    const loadProductDisplaySettings = async () => {
      try {
        // Load display settings
        const { data, error } = await supabase
          .from('product_display_settings')
          .select('display_mode, selected_branches')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading product display mode:', error);
        } else if (data) {
          setProductDisplayMode((data.display_mode || 'show_all') as 'show_all' | 'show_with_stock' | 'show_with_stock_and_vote');
          setSelectedBranches(data.selected_branches || []);
        }

        // Load available branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (branchesError) {
          console.error('Error loading branches:', branchesError);
        } else {
          setAvailableBranches(branchesData || []);
        }

        setIsLoadingDisplayMode(false);
      } catch (err) {
        console.error('Error loading product display settings:', err);
        setIsLoadingDisplayMode(false);
      }
    };

    loadProductDisplaySettings();
  }, []);

  // Use dynamic currency list from database
  const arabicCurrencies = availableCurrencies;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCheckboxChange = (column: string, checked: boolean) => {
    setSelectedColumns(prev => ({
      ...prev,
      [column]: checked
    }));
  };

  const renderSystemSettings = () => {
    return (
      <div className="space-y-6 max-w-4xl">

        {/* Settings Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Language Settings */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">اللغة</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="Arabic">Arabic</option>
                <option value="English">English</option>
              </select>
            </div>

            {/* Direction */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">اتجاه المحتوى</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="rtl">من اليمين إلى اليسار</option>
                <option value="ltr">من اليسار إلى اليمين</option>
              </select>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">نظام الألوان</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="dark">داكن عالي</option>
                <option value="light">فاتح ليالي</option>
              </select>
            </div>

            {/* Text Size */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">حجم النص / صف صغير</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize(Math.max(50, fontSize - 10))}
                  className="px-2 py-1 bg-[#374151] hover:bg-gray-600 rounded text-white"
                >
                  -
                </button>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setFontSize(Math.min(150, fontSize + 10))}
                  className="px-2 py-1 bg-[#374151] hover:bg-gray-600 rounded text-white"
                >
                  +
                </button>
              </div>
              <div className="text-center text-white text-sm mt-1">{fontSize}%</div>
            </div>

            {/* Rows per page */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">عدد الصفوف / لصفحة</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRowsPerPage(Math.max(1, rowsPerPage - 1))}
                  className="px-2 py-1 bg-[#374151] hover:bg-gray-600 rounded text-white"
                >
                  -
                </button>
                <input
                  type="number"
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="w-20 px-2 py-1 bg-[#2B3544] border border-gray-600 rounded text-white text-center"
                />
                <button
                  onClick={() => setRowsPerPage(rowsPerPage + 1)}
                  className="px-2 py-1 bg-[#374151] hover:bg-gray-600 rounded text-white"
                >
                  +
                </button>
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">موقع الإشعار</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="top">أعلى</option>
                <option value="bottom">أسفل</option>
              </select>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Animations Toggle */}
            <div className="flex justify-between items-center">
              <label className="text-white text-sm font-medium">إظهار الرسوم</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAnimations}
                  onChange={(e) => setEnableAnimations(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Sounds Toggle */}
            <div className="flex justify-between items-center">
              <label className="text-white text-sm font-medium">تبريج</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSounds}
                  onChange={(e) => setEnableSounds(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Show Line Numbers Toggle */}
            <div className="flex justify-between items-center">
              <label className="text-white text-sm font-medium">عرض الرقم عند بلن نظام</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLineNumbers}
                  onChange={(e) => setShowLineNumbers(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Show Today Toggle */}
            <div className="flex justify-between items-center">
              <label className="text-white text-sm font-medium">تحديد رقم يوم على بين نظام</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showToday}
                  onChange={(e) => setShowToday(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Columns Selection */}
            <div>
              <h4 className="text-white text-sm font-medium mb-3">الأعمدة في نهاية البيع</h4>
              <div className="text-xs text-gray-400 mb-3">اختر المرور عرضها في جهة اليسر &quot;ولاية اليسار&quot; جدي</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries({
                  product: 'بين *',
                  category: 'تحويل *',
                  price: 'حجم *',
                  quantity: 'ملطبة *',
                  actions: 'قائمة جديدة *'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id={key}
                      checked={selectedColumns[key as keyof typeof selectedColumns]}
                      onChange={(e) => handleCheckboxChange(key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-[#2B3544] border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor={key} className="text-white text-sm cursor-pointer">
                      {label}
                    </label>
                  </div>
                ))}
                <div className="col-span-2 text-xs text-red-400 mt-2">
                  * يعتمد على مخططة &quot;جهة اليسار&quot; جدي
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPlaceholderContent = (categoryId: string) => {
    const category = settingsCategories.find(c => c.id === categoryId);
    if (!category) return null;

    const Icon = category.icon;

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <Icon className="h-24 w-24 text-gray-500 mb-6" />
        <h2 className="text-2xl font-medium text-white mb-3">{category.name}</h2>
        <p className="text-gray-400 mb-8 max-w-md">{category.description}</p>
        <div className="bg-[#374151] rounded-lg p-6 border border-gray-600">
          <p className="text-gray-300 text-sm">
            هذا القسم قيد التطوير. سيتم إضافة المزيد من الإعدادات قريباً.
          </p>
        </div>
      </div>
    );
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Save based on current category
      if (selectedCategory === 'theme') {
        // Prepare currency settings from pending state
        const newCurrencySettings = {
          currency_mode: pendingCurrencyMode,
          system_currency: isCustomSystemCurrency ? customSystemCurrency : pendingSystemCurrency,
          website_currency: isCustomWebsiteCurrency ? customWebsiteCurrency : pendingWebsiteCurrency,
          unified_currency: isCustomUnifiedCurrency ? customUnifiedCurrency : pendingUnifiedCurrency
        };

        // Update currency settings in database
        await updateDbCurrencySettings(newCurrencySettings);

        // Save product display mode
        // First, try to get existing record
        const { data: existingData } = await supabase
          .from('product_display_settings')
          .select('id')
          .single();

        if (existingData?.id) {
          // Update existing record
          const { error: displayModeError } = await supabase
            .from('product_display_settings')
            .update({
              display_mode: productDisplayMode,
              selected_branches: selectedBranches,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingData.id);

          if (displayModeError) {
            console.error('Error saving product display mode:', displayModeError);
            throw displayModeError;
          }
        } else {
          // Insert new record
          const { error: displayModeError } = await supabase
            .from('product_display_settings')
            .insert({
              display_mode: productDisplayMode,
              selected_warehouses: [],
              selected_branches: selectedBranches
            });

          if (displayModeError) {
            console.error('Error saving product display mode:', displayModeError);
            throw displayModeError;
          }
        }

        // Reset custom currency states
        setIsCustomSystemCurrency(false);
        setIsCustomWebsiteCurrency(false);
        setIsCustomUnifiedCurrency(false);
        setCustomSystemCurrency('');
        setCustomWebsiteCurrency('');
        setCustomUnifiedCurrency('');
      } else if (selectedCategory === 'company') {
        // Save company settings
        await updateCompanySettings({
          name: companyName,
          logoUrl: logoUrl,
          logoShape: logoShape,
          socialMedia: socialMedia,
          branches: branches
        });
      } else if (selectedCategory === 'store') {
        // Save product display mode
        const { data: existingData } = await supabase
          .from('product_display_settings')
          .select('id')
          .single();

        if (existingData?.id) {
          const { error: displayModeError } = await supabase
            .from('product_display_settings')
            .update({
              display_mode: productDisplayMode,
              selected_branches: selectedBranches,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingData.id);

          if (displayModeError) {
            console.error('Error saving product display mode:', displayModeError);
            throw displayModeError;
          }
        } else {
          const { error: displayModeError } = await supabase
            .from('product_display_settings')
            .insert({
              display_mode: productDisplayMode,
              selected_warehouses: [],
              selected_branches: selectedBranches
            });

          if (displayModeError) {
            console.error('Error saving product display mode:', displayModeError);
            throw displayModeError;
          }
        }
      }

      // Clear the product display settings cache so the store reflects changes immediately
      clearSettingsCache();

      alert('تم حفظ الإعدادات بنجاح!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSettings = () => {
    // Reset currency settings
    setPendingCurrencyMode(dbCurrencyMode);
    setPendingSystemCurrency(dbSystemCurrency);
    setPendingWebsiteCurrency(dbWebsiteCurrency);
    setPendingUnifiedCurrency(dbUnifiedCurrency);

    setIsCustomSystemCurrency(false);
    setIsCustomWebsiteCurrency(false);
    setIsCustomUnifiedCurrency(false);
    setCustomSystemCurrency('');
    setCustomWebsiteCurrency('');
    setCustomUnifiedCurrency('');

    // Reset company settings
    setCompanyName(dbCompanyName);
    setLogoUrl(dbLogoUrl);
    setSocialMedia(dbSocialMedia);
    setBranches(dbBranches);
  };

  const handleDeleteCurrency = async (currency: string) => {
    try {
      const confirmDelete = window.confirm(`هل تريد حذف العملة "${currency}" نهائياً؟`);
      if (!confirmDelete) return;

      await deleteCustomCurrency(currency);

      // If the deleted currency was selected in pending state, reset to default
      if (pendingSystemCurrency === currency) {
        setPendingSystemCurrency(dbSystemCurrency);
      }
      if (pendingWebsiteCurrency === currency) {
        setPendingWebsiteCurrency(dbWebsiteCurrency);
      }
      if (pendingUnifiedCurrency === currency) {
        setPendingUnifiedCurrency(dbUnifiedCurrency);
      }

      alert(`تم حذف العملة "${currency}" بنجاح!`);
    } catch (error) {
      console.error('Error deleting currency:', error);
      alert('حدث خطأ أثناء حذف العملة');
    }
  };


  const renderThemeSettings = () => {
    return (
      <div className="space-y-6 max-w-6xl">
        {/* Currency Settings */}
        <div className="space-y-6">
          <h3 className="text-white font-medium text-lg">إعدادات العملة</h3>

          {/* Currency Mode Selection */}
          <div className="space-y-3">
            <label className="block text-white text-sm font-medium">نطاق العملة</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="currencyMode"
                  value={CURRENCY_MODES.SEPARATE}
                  checked={pendingCurrencyMode === CURRENCY_MODES.SEPARATE}
                  onChange={(e) => setPendingCurrencyMode(e.target.value as 'separate' | 'unified')}
                  className="w-4 h-4 text-blue-600 bg-[#2B3544] border-gray-600 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-white text-sm">منفصل</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="currencyMode"
                  value={CURRENCY_MODES.UNIFIED}
                  checked={pendingCurrencyMode === CURRENCY_MODES.UNIFIED}
                  onChange={(e) => setPendingCurrencyMode(e.target.value as 'separate' | 'unified')}
                  className="w-4 h-4 text-blue-600 bg-[#2B3544] border-gray-600 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-white text-sm">كلاهما</span>
              </label>
            </div>
          </div>

          {/* Currency Fields - Horizontal Layout */}
          {pendingCurrencyMode === CURRENCY_MODES.UNIFIED && (
            <div className="space-y-3">
              <label className="block text-white text-sm font-medium">عملة النظام و الموقع</label>
              <CurrencyDropdownWithDelete
                value={pendingUnifiedCurrency}
                onChange={setPendingUnifiedCurrency}
                isCustom={isCustomUnifiedCurrency}
                onCustomToggle={setIsCustomUnifiedCurrency}
                customValue={customUnifiedCurrency}
                onCustomChange={setCustomUnifiedCurrency}
                placeholder="اكتب العملة..."
                arabicCurrencies={arabicCurrencies}
                onDeleteCurrency={handleDeleteCurrency}
              />
            </div>
          )}

          {pendingCurrencyMode === CURRENCY_MODES.SEPARATE && (
            <div className="grid grid-cols-2 gap-6">
              {/* System Currency */}
              <div className="space-y-3">
                <label className="block text-white text-sm font-medium">عملة النظام</label>
                <CurrencyDropdownWithDelete
                  value={pendingSystemCurrency}
                  onChange={setPendingSystemCurrency}
                  isCustom={isCustomSystemCurrency}
                  onCustomToggle={setIsCustomSystemCurrency}
                  customValue={customSystemCurrency}
                  onCustomChange={setCustomSystemCurrency}
                  placeholder="اكتب العملة..."
                  arabicCurrencies={arabicCurrencies}
                  onDeleteCurrency={handleDeleteCurrency}
                  allowCustomInput={false}
                  allowDelete={false}
                />
              </div>

              {/* Website Currency */}
              <div className="space-y-3">
                <label className="block text-white text-sm font-medium">عملة الموقع</label>
                <CurrencyDropdownWithDelete
                  value={pendingWebsiteCurrency}
                  onChange={setPendingWebsiteCurrency}
                  isCustom={isCustomWebsiteCurrency}
                  onCustomToggle={setIsCustomWebsiteCurrency}
                  customValue={customWebsiteCurrency}
                  onCustomChange={setCustomWebsiteCurrency}
                  placeholder="اكتب العملة..."
                  arabicCurrencies={arabicCurrencies}
                  onDeleteCurrency={handleDeleteCurrency}
                  allowCustomInput={false}
                  allowDelete={false}
                />
              </div>
            </div>
          )}

          {/* Ratings Settings */}
          <div className="space-y-3 mt-6">
            <h3 className="text-white font-medium text-lg">إعدادات التقييمات</h3>
            <div className="flex justify-between items-center">
              <label className="text-white text-sm font-medium">إظهار تقييمات المنتجات (النجوم)</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRatings}
                  onChange={async (e) => {
                    try {
                      await updateRatingSettings(e.target.checked);
                    } catch (error) {
                      console.error('Error updating rating settings:', error);
                    }
                  }}
                  disabled={isRatingsLoading}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 ${isRatingsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
              </label>
            </div>
          </div>

          {/* Product Display Settings */}
          <div className="space-y-4 mt-6 p-4 bg-[#374151] rounded-lg border border-gray-600">
            <h3 className="text-white font-medium text-lg">إعدادات ظهور المنتجات في المتجر</h3>
            <p className="text-sm text-gray-400">طريقة عرض المنتجات</p>

            <div className="space-y-3">
              {/* Option 1: Show All */}
              <div className="p-4 bg-[#2B3544] rounded-lg border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="productDisplayMode"
                    value="show_all"
                    checked={productDisplayMode === 'show_all'}
                    onChange={(e) => setProductDisplayMode(e.target.value as any)}
                    disabled={isLoadingDisplayMode}
                    className="mt-1 w-5 h-5 text-blue-600 bg-[#2B3544] border-gray-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-white font-medium">ظهور كلي</span>
                    <p className="text-xs text-gray-400 mt-1">
                      تظهر جميع المنتجات في المتجر حتى إن كانت كميتها في المخزون تساوي صفر
                    </p>
                  </div>
                </label>
              </div>

              {/* Option 2: Show In Stock */}
              <div className="p-4 bg-[#2B3544] rounded-lg border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="productDisplayMode"
                    value="show_with_stock"
                    checked={productDisplayMode === 'show_with_stock'}
                    onChange={(e) => setProductDisplayMode(e.target.value as any)}
                    disabled={isLoadingDisplayMode}
                    className="mt-1 w-5 h-5 text-blue-600 bg-[#2B3544] border-gray-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-white font-medium">ظهور بالمخزون</span>
                    <p className="text-xs text-gray-400 mt-1">
                      تظهر فقط المنتجات المتوفرة في المخزون. المنتجات المنتهية لن تظهر
                    </p>
                  </div>
                </label>
              </div>

              {/* Option 3: Show In Stock with Voting */}
              <div className="p-4 bg-[#2B3544] rounded-lg border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="productDisplayMode"
                    value="show_with_stock_and_vote"
                    checked={productDisplayMode === 'show_with_stock_and_vote'}
                    onChange={(e) => setProductDisplayMode(e.target.value as any)}
                    disabled={isLoadingDisplayMode}
                    className="mt-1 w-5 h-5 text-blue-600 bg-[#2B3544] border-gray-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-white font-medium">ظهور بالمخزون مع التصويت</span>
                    <p className="text-xs text-gray-400 mt-1">
                      المنتجات المتوفرة تظهر عادي، والمنتجات المنتهية تظهر مع إمكانية التصويت لإعادة توفيرها
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Branches Selection - Show when "show_with_stock" or "show_with_stock_and_vote" is selected */}
            {(productDisplayMode === 'show_with_stock' || productDisplayMode === 'show_with_stock_and_vote') && (
              <div className="mt-4 p-4 bg-[#2B3544] rounded-lg border border-gray-600">
                <div className="flex items-start gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-blue-300 text-sm font-medium">إتمام المخازن والفروع لحساب المخزون</p>
                    <p className="text-gray-400 text-xs mt-1">
                      حدد الفروع/المخازن المطلوب احتساب الكمية الكلية منها لتحديد ما سيتم إظهاره في المتجر
                    </p>
                  </div>
                </div>

                {/* Branches Checkboxes */}
                <div className="space-y-2 mt-4">
                  <p className="text-white text-sm font-medium mb-2">الفروع</p>
                  {availableBranches.length === 0 ? (
                    <p className="text-gray-400 text-xs">لا توجد فروع متاحة</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {availableBranches.map((branch) => (
                        <label
                          key={branch.id}
                          className="flex items-center gap-2 p-3 bg-[#374151] rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBranches.includes(branch.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBranches([...selectedBranches, branch.id]);
                              } else {
                                setSelectedBranches(selectedBranches.filter(id => id !== branch.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-[#2B3544] border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-white text-sm">{branch.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Select All / Deselect All buttons */}
                  {availableBranches.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setSelectedBranches(availableBranches.map(b => b.id))}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        تحديد الكل
                      </button>
                      <button
                        onClick={() => setSelectedBranches([])}
                        className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Store Colors Settings */}
          <div className="space-y-4 mt-8 p-4 bg-[#374151] rounded-lg border border-gray-600">
            <h3 className="text-white font-medium text-lg">لون المتجر (الشريط الرئيسي)</h3>
            <p className="text-sm text-gray-400">تخصيص ألوان الشريط الرئيسي والأزرار في المتجر</p>

            {/* Current Active Theme */}
            {!isThemesLoading && storeThemes.length > 0 && (
              <div className="space-y-3">
                {storeThemes.map((theme: any) => (
                  <div
                    key={theme.id}
                    className={`p-4 bg-[#2B3544] rounded-lg border-2 transition-all ${
                      theme.is_active
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Theme Info */}
                      <div className="flex items-center gap-4 flex-1">
                        {/* Theme Name and Status */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-medium">{theme.name}</h4>
                            {theme.is_active && (
                              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                                نشط
                              </span>
                            )}
                            {theme.is_default && (
                              <span className="px-2 py-0.5 bg-gray-600 text-white text-xs rounded-full">
                                افتراضي
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Color Preview */}
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-400">اللون الرئيسي</span>
                            <div className="flex gap-1">
                              <div
                                className="w-12 h-8 rounded border-2 border-gray-600"
                                style={{ backgroundColor: theme.primary_color }}
                                title={theme.primary_color}
                              ></div>
                              <div
                                className="w-12 h-8 rounded border-2 border-gray-600"
                                style={{ backgroundColor: theme.primary_hover_color }}
                                title={`Hover: ${theme.primary_hover_color}`}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {/* Activate Button */}
                        {!theme.is_active && (
                          <button
                            onClick={async () => {
                              try {
                                await activateTheme(theme.id);
                                alert('تم تفعيل الثيم بنجاح!');
                              } catch (error) {
                                console.error('Error activating theme:', error);
                                alert('حدث خطأ أثناء تفعيل الثيم');
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                          >
                            تفعيل
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingTheme(theme);
                            setNewThemeName(theme.name);
                            setNewPrimaryColor(theme.primary_color);
                            setNewPrimaryHoverColor(theme.primary_hover_color);
                            setNewInteractiveColor(theme.interactive_color || '#EF4444');
                            setNewButtonColor(theme.button_color || theme.primary_color);
                            setNewButtonHoverColor(theme.button_hover_color || theme.primary_hover_color);
                            setIsEditThemeModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                        >
                          تعديل
                        </button>

                        {/* Delete Button - Only for non-default themes */}
                        {!theme.is_default && (
                          <button
                            onClick={async () => {
                              const confirmDelete = window.confirm(`هل تريد حذف الثيم "${theme.name}" نهائياً؟`);
                              if (!confirmDelete) return;

                              try {
                                await deleteTheme(theme.id);
                                alert('تم حذف الثيم بنجاح!');
                              } catch (error) {
                                console.error('Error deleting theme:', error);
                                alert('حدث خطأ أثناء حذف الثيم');
                              }
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Theme Button */}
            <button
              onClick={() => {
                setNewThemeName('');
                setNewPrimaryColor('#5d1f1f');
                setNewPrimaryHoverColor('#4A1616');
                setNewInteractiveColor('#EF4444');
                setNewButtonColor('#5d1f1f');
                setNewButtonHoverColor('#4A1616');
                setIsAddThemeModalOpen(true);
              }}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              إضافة لون جديد
            </button>
          </div>

        </div>

      </div>
    );
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم الملف كبير جداً. الحد الأقصى 2 ميجابايت');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار صورة فقط');
        return;
      }

      // Open logo editor instead of directly setting the URL
      setSelectedLogoFile(file);
      setIsLogoEditorOpen(true);
    }
  };

  const handleLogoSave = (croppedImage: string, shape: 'square' | 'circle') => {
    setLogoUrl(croppedImage);
    setLogoShape(shape);
    setIsLogoEditorOpen(false);
    setSelectedLogoFile(null);
  };

  const handleLogoCancel = () => {
    setIsLogoEditorOpen(false);
    setSelectedLogoFile(null);
  };

  const renderCompanySettings = () => {
    return (
      <div className="space-y-6 max-w-4xl">
        <h3 className="text-white font-medium text-lg mb-6">إعدادات الشركة</h3>

        {/* Company Name */}
        <div>
          <label className="block text-white text-sm font-medium mb-2">اسم الشركة</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="اسم شركتك"
            className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-right"
          />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-white text-sm font-medium mb-2">شعار الشركة (Logo)</label>
          <div className="flex items-start gap-4">
            {/* Logo Preview */}
            <div className="w-32 h-32 bg-[#374151] rounded-lg flex items-center justify-center overflow-hidden border-2 border-gray-600">
              {logoUrl ? (
                <img src={logoUrl} alt="Company Logo" className="w-full h-full object-contain" />
              ) : (
                <PhotoIcon className="w-16 h-16 text-gray-500" />
              )}
            </div>

            {/* Upload Button */}
            <div className="flex-1">
              <label className="cursor-pointer">
                <div className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 w-fit">
                  <PhotoIcon className="w-5 h-5" />
                  اختر صورة
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-2">
                الحد الأقصى: 2 ميجابايت • الأنواع المدعومة: JPG, PNG, GIF, WebP
              </p>
              {logoUrl && (
                <button
                  onClick={() => setLogoUrl('')}
                  className="mt-2 text-red-400 hover:text-red-300 text-sm"
                >
                  حذف الشعار
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div>
          <label className="block text-white text-sm font-medium mb-3">وسائل التواصل الاجتماعي</label>
          <div className="space-y-3">
            {socialMedia.map((social, index) => {
              const getPlatformIcon = (platform: string) => {
                const icons: Record<string, string> = {
                  facebook: '📘',
                  instagram: '📷',
                  twitter: '🐦',
                  linkedin: '💼',
                  youtube: '📺',
                  tiktok: '🎵',
                  snapchat: '👻',
                  whatsapp: '💬',
                  telegram: '✈️'
                };
                return icons[platform] || '🌐';
              };

              return (
                <div key={index} className="flex gap-3 items-center p-3 bg-[#374151] rounded-lg">
                  <select
                    value={social.platform}
                    onChange={(e) => {
                      const newSocialMedia = [...socialMedia];
                      newSocialMedia[index].platform = e.target.value;
                      setSocialMedia(newSocialMedia);
                    }}
                    className="w-48 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  >
                    <option value="">Select Platform</option>
                    <option value="facebook">📘 Facebook</option>
                    <option value="instagram">📷 Instagram</option>
                    <option value="twitter">🐦 Twitter (X)</option>
                    <option value="linkedin">💼 LinkedIn</option>
                    <option value="youtube">📺 YouTube</option>
                    <option value="tiktok">🎵 TikTok</option>
                    <option value="snapchat">👻 Snapchat</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="telegram">✈️ Telegram</option>
                  </select>

                  {social.platform && (
                    <span className="text-2xl">{getPlatformIcon(social.platform)}</span>
                  )}

                  <input
                    type="text"
                    value={social.link}
                    onChange={(e) => {
                      const newSocialMedia = [...socialMedia];
                      newSocialMedia[index].link = e.target.value;
                      setSocialMedia(newSocialMedia);
                    }}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                  />

                  <button
                    onClick={() => {
                      if (socialMedia.length > 1) {
                        setSocialMedia(socialMedia.filter((_, i) => i !== index));
                      }
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    حذف
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setSocialMedia([...socialMedia, { platform: '', link: '' }])}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              + إضافة وسيلة تواصل
            </button>
          </div>
        </div>

        {/* Branches */}
        <div>
          <label className="block text-white text-sm font-medium mb-3">الفروع والعناوين</label>
          <p className="text-sm text-gray-400 mb-4">
            يمكنك إضافة رابط الموقع على الخريطة لكل فرع من فروعك المسجلة في النظام
          </p>

          {dbBranchesFromDB.length === 0 ? (
            <div className="p-6 bg-[#374151] rounded-lg text-center">
              <p className="text-gray-400">لا توجد فروع مسجلة في النظام</p>
              <p className="text-sm text-gray-500 mt-2">قم بإضافة فروع من قسم إدارة الفروع أولاً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dbBranchesFromDB.map((branch) => {
                // Find existing location link for this branch
                const existingBranch = branches.find((b: any) => b.branchId === branch.id);
                const locationLink = existingBranch?.locationLink || '';

                return (
                  <div key={branch.id} className="p-4 bg-[#374151] rounded-lg space-y-3">
                    {/* Branch Info (Read-only) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">اسم الفرع</label>
                        <div className="px-3 py-2 bg-[#2B3544] border border-gray-700 rounded text-white text-sm">
                          {branch.name}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">رقم الهاتف</label>
                        <div className="px-3 py-2 bg-[#2B3544] border border-gray-700 rounded text-white text-sm">
                          {branch.phone || '-'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">العنوان</label>
                      <div className="px-3 py-2 bg-[#2B3544] border border-gray-700 rounded text-white text-sm">
                        {branch.address || '-'}
                      </div>
                    </div>

                    {/* Location Link (Editable) */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        رابط الموقع على الخريطة (Google Maps / Apple Maps)
                      </label>
                      <input
                        type="text"
                        value={locationLink}
                        onChange={(e) => {
                          const newBranches = [...branches];
                          const branchIndex = newBranches.findIndex((b: any) => b.branchId === branch.id);

                          if (branchIndex >= 0) {
                            newBranches[branchIndex].locationLink = e.target.value;
                          } else {
                            newBranches.push({
                              branchId: branch.id,
                              branchName: branch.name,
                              address: branch.address,
                              locationLink: e.target.value
                            });
                          }

                          setBranches(newBranches);
                        }}
                        placeholder="https://maps.google.com/..."
                        className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        style={{ direction: 'ltr', textAlign: 'left' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleStoreSettingChange = async (settingKey: string, value: boolean) => {
    try {
      if (settingKey === 'show_quantity_in_store') {
        await updateStoreDisplaySettings({ showQuantityInStore: value });
      } else if (settingKey === 'show_product_star_rating') {
        await updateStoreDisplaySettings({ showProductStarRating: value });
      }
    } catch (err) {
      console.error('Error saving store setting:', err);
    }
  };

  const renderStoreSettings = () => {
    return (
      <div className="space-y-6 max-w-4xl">
        <h3 className="text-white font-medium text-lg mb-6">إعدادات المتجر</h3>
        <p className="text-sm text-gray-400 mb-6">
          تحكم في ما يظهر للعملاء في متجرك الإلكتروني
        </p>

        <div className="space-y-4 p-4 bg-[#374151] rounded-lg border border-gray-600">
          {/* Show Quantity in Store Toggle */}
          <div className="flex justify-between items-center p-3 bg-[#2B3544] rounded-lg">
            <div className="flex-1">
              <label className="text-white text-sm font-medium">ظهور الكمية في المتجر</label>
              <p className="text-xs text-gray-400 mt-1">
                عند التفعيل، سيظهر للعميل عدد القطع المتبقية من كل منتج
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showQuantityInStore}
                onChange={(e) => handleStoreSettingChange('show_quantity_in_store', e.target.checked)}
                disabled={isLoadingStoreSettings}
                className="sr-only peer"
              />
              <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 ${isLoadingStoreSettings ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
            </label>
          </div>

          {/* Show Product Star Rating Toggle */}
          <div className="flex justify-between items-center p-3 bg-[#2B3544] rounded-lg">
            <div className="flex-1">
              <label className="text-white text-sm font-medium">ظهور نجمة المنتج</label>
              <p className="text-xs text-gray-400 mt-1">
                عند التفعيل، ستظهر تقييمات النجوم على المنتجات للعملاء
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showProductStarRating}
                onChange={(e) => handleStoreSettingChange('show_product_star_rating', e.target.checked)}
                disabled={isLoadingStoreSettings}
                className="sr-only peer"
              />
              <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 ${isLoadingStoreSettings ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
            </label>
          </div>
        </div>

        {/* Additional Info */}
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-300 text-sm font-medium">ملاحظة</p>
              <p className="text-gray-400 text-xs mt-1">
                التغييرات يتم حفظها تلقائياً عند تبديل أي خيار
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveToken = async () => {
    if (!newToken.trim()) {
      alert('الرجاء إدخال الـ Token');
      return;
    }

    setIsSavingToken(true);
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'wasender_api_token',
          value: newToken.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setWasenderTokenConfigured(true);
        setWasenderTokenLastUpdated(new Date().toISOString());
        setShowTokenInput(false);
        setNewToken('');
        alert('تم حفظ الـ Token بنجاح!');
      } else {
        throw new Error(data.error || 'Failed to save token');
      }
    } catch (error) {
      console.error('Error saving token:', error);
      alert('حدث خطأ أثناء حفظ الـ Token');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleDeleteToken = async () => {
    const confirmDelete = window.confirm('هل أنت متأكد من حذف الـ Token؟ سيتوقف إرسال رسائل الواتساب.');
    if (!confirmDelete) return;

    try {
      const response = await fetch('/api/settings/api-keys?key=wasender_api_token', {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setWasenderTokenConfigured(false);
        setWasenderTokenLastUpdated(null);
        alert('تم حذف الـ Token بنجاح');
      } else {
        throw new Error(data.error || 'Failed to delete token');
      }
    } catch (error) {
      console.error('Error deleting token:', error);
      alert('حدث خطأ أثناء حذف الـ Token');
    }
  };

  const renderSecuritySettings = () => {
    return (
      <div className="space-y-6 max-w-4xl">
        <h3 className="text-white font-medium text-lg mb-6">إعدادات الأمان</h3>

        {/* WasenderAPI Token Section */}
        <div className="p-6 bg-[#374151] rounded-lg border border-gray-600">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#2B3544] rounded-lg">
              <KeyIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium text-lg">WasenderAPI Token</h4>
              <p className="text-gray-400 text-sm mt-1">
                مفتاح API للاتصال بخدمة WasenderAPI لإرسال رسائل الواتساب
              </p>

              {isLoadingSecuritySettings ? (
                <div className="mt-4 flex items-center gap-2 text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                  جاري التحميل...
                </div>
              ) : wasenderTokenConfigured && !showTokenInput ? (
                // Token is configured - show status
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                    <CheckCircleIcon className="h-6 w-6 text-green-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-green-300 font-medium">Token مُعد بنجاح</p>
                      {wasenderTokenLastUpdated && (
                        <p className="text-gray-400 text-xs mt-1">
                          آخر تحديث: {new Date(wasenderTokenLastUpdated).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <p className="text-amber-300 text-sm">
                      الـ Token مشفر ومحفوظ بأمان. لا يمكن عرضه مرة أخرى لأسباب أمنية.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowTokenInput(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <KeyIcon className="h-4 w-4" />
                      تغيير Token
                    </button>
                    <button
                      onClick={handleDeleteToken}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      حذف Token
                    </button>
                  </div>
                </div>
              ) : (
                // Show token input form
                <div className="mt-4 space-y-4">
                  {wasenderTokenConfigured && (
                    <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                      <ExclamationTriangleIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
                      <p className="text-blue-300 text-sm">
                        سيتم استبدال الـ Token الحالي بالـ Token الجديد
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-white text-sm font-medium">
                      {wasenderTokenConfigured ? 'Token جديد' : 'أدخل الـ Token'}
                    </label>
                    <div className="relative">
                      <input
                        type={showTokenValue ? 'text' : 'password'}
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        placeholder="الصق الـ Token هنا..."
                        className="w-full px-4 py-3 bg-[#2B3544] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm pr-12"
                        style={{ direction: 'ltr', textAlign: 'left' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowTokenValue(!showTokenValue)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showTokenValue ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      احصل على الـ Token من لوحة تحكم WasenderAPI
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveToken}
                      disabled={isSavingToken || !newToken.trim()}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        isSavingToken || !newToken.trim()
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {isSavingToken ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4" />
                          حفظ Token
                        </>
                      )}
                    </button>
                    {wasenderTokenConfigured && (
                      <button
                        onClick={() => {
                          setShowTokenInput(false);
                          setNewToken('');
                        }}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-300 text-sm font-medium">معلومات الأمان</p>
              <ul className="text-gray-400 text-xs mt-2 space-y-1 list-disc list-inside">
                <li>جميع الـ API Keys يتم تشفيرها قبل حفظها في قاعدة البيانات</li>
                <li>لا يتم عرض أو إرسال الـ Token بعد الحفظ لأسباب أمنية</li>
                <li>يمكنك تغيير أو حذف الـ Token في أي وقت</li>
                <li>في حالة فقدان الـ Token، ستحتاج لإنشاء واحد جديد من WasenderAPI</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderSettingsContent = () => {
    switch (selectedCategory) {
      case 'system':
        return renderSystemSettings();
      case 'theme':
        return renderThemeSettings();
      case 'company':
        return renderCompanySettings();
      case 'store':
        return renderStoreSettings();
      case 'security':
        return renderSecuritySettings();
      case 'backup':
        return <BackupSettings />;
      default:
        return renderPlaceholderContent(selectedCategory);
    }
  };

  return (
    <>
      {/* Logo Editor Modal */}
      {isLogoEditorOpen && selectedLogoFile && (
        <LogoEditor
          imageFile={selectedLogoFile}
          onSave={handleLogoSave}
          onCancel={handleLogoCancel}
        />
      )}

      {/* Add Theme Modal */}
      {isAddThemeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-[#2B3544] rounded-lg p-6 w-full max-w-lg border border-gray-600">
            <h3 className="text-white text-xl font-bold mb-6">إضافة لون جديد للمتجر</h3>

            <div className="space-y-4">
              {/* Theme Name */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">اسم اللون</label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="مثال: أزرق سماوي"
                  className="w-full px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                />
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">اللون الرئيسي (الشريط)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="w-20 h-10 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Primary Hover Color */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">لون Hover للشريط (أغمق قليلاً)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newPrimaryHoverColor}
                    onChange={(e) => setNewPrimaryHoverColor(e.target.value)}
                    className="w-20 h-10 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newPrimaryHoverColor}
                    onChange={(e) => setNewPrimaryHoverColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Interactive Color */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">لون التفاعل (الأزرار والأيقونات)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newInteractiveColor}
                    onChange={(e) => setNewInteractiveColor(e.target.value)}
                    className="w-20 h-10 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newInteractiveColor}
                    onChange={(e) => setNewInteractiveColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 bg-[#374151] rounded-lg border border-gray-600">
                <p className="text-white text-sm mb-3">معاينة اللون:</p>
                <div
                  className="w-full h-16 rounded-lg flex items-center justify-center text-white font-bold transition-all"
                  style={{ backgroundColor: newPrimaryColor }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = newPrimaryHoverColor}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = newPrimaryColor}
                >
                  مرر الماوس لرؤية تأثير Hover
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsAddThemeModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  if (!newThemeName.trim()) {
                    alert('الرجاء إدخال اسم للون');
                    return;
                  }

                  try {
                    await addTheme(newThemeName, newPrimaryColor, newPrimaryHoverColor, newInteractiveColor, newButtonColor, newButtonHoverColor);
                    alert('تم إضافة اللون بنجاح!');
                    setIsAddThemeModalOpen(false);
                  } catch (error) {
                    console.error('Error adding theme:', error);
                    alert('حدث خطأ أثناء إضافة اللون');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Theme Modal */}
      {isEditThemeModalOpen && editingTheme && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-[#2B3544] rounded-lg p-6 w-full max-w-lg border border-gray-600">
            <h3 className="text-white text-xl font-bold mb-6">تعديل لون المتجر</h3>

            <div className="space-y-4">
              {/* Theme Name - Read Only for default theme */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">اسم اللون</label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  disabled={editingTheme.is_default}
                  className="w-full px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right disabled:opacity-50"
                />
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">اللون الرئيسي (الشريط)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="w-20 h-10 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Primary Hover Color */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">لون Hover للشريط (أغمق قليلاً)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newPrimaryHoverColor}
                    onChange={(e) => setNewPrimaryHoverColor(e.target.value)}
                    className="w-20 h-10 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newPrimaryHoverColor}
                    onChange={(e) => setNewPrimaryHoverColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Interactive Color */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">لون التفاعل (الأزرار والأيقونات)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={newInteractiveColor}
                    onChange={(e) => setNewInteractiveColor(e.target.value)}
                    className="w-20 h-10 rounded border border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newInteractiveColor}
                    onChange={(e) => setNewInteractiveColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#374151] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    style={{ direction: 'ltr' }}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 bg-[#374151] rounded-lg border border-gray-600">
                <p className="text-white text-sm mb-3">معاينة اللون:</p>
                <div
                  className="w-full h-16 rounded-lg flex items-center justify-center text-white font-bold transition-all"
                  style={{ backgroundColor: newPrimaryColor }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = newPrimaryHoverColor}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = newPrimaryColor}
                >
                  مرر الماوس لرؤية تأثير Hover
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsEditThemeModalOpen(false);
                  setEditingTheme(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateTheme(editingTheme.id, newPrimaryColor, newPrimaryHoverColor, newInteractiveColor, newButtonColor, newButtonHoverColor);
                    alert('تم تحديث اللون بنجاح!');
                    setIsEditThemeModalOpen(false);
                    setEditingTheme(null);
                  } catch (error) {
                    console.error('Error updating theme:', error);
                    alert('حدث خطأ أثناء تحديث اللون');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-screen bg-[#2B3544] overflow-hidden relative">
        <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />
        <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

        <div className="h-full pt-12 overflow-hidden flex flex-col relative">

          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar - Settings Categories */}
            <div className="w-64 bg-[#374151] border-l border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-600">
                <h3 className="text-white font-medium mb-3">إعدادات النظام</h3>
                <div className="space-y-2">
                {settingsCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings Stats */}
            <div className="p-4">
              <h4 className="text-gray-300 text-sm font-medium mb-3">معلومات الإعدادات</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white font-medium">{settingsCategories.length}</span>
                  <span className="text-gray-400">أقسام الإعدادات:</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">1</span>
                  <span className="text-gray-400">الأقسام المكتملة:</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-400 font-medium">{settingsCategories.length - 1}</span>
                  <span className="text-gray-400">قيد التطوير:</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">

            {/* Settings Content Container */}
            <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#2B3544] p-6 pb-20">
              {renderSettingsContent()}
            </div>

            {/* Settings Action Bar - Limited to main content area width */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#2B3544] border-t border-gray-600/30">
              <div className="flex gap-2 justify-end">
                {/* Cancel and Save buttons - exact styling from ProductSidebar */}
                <button
                  onClick={handleCancelSettings}
                  className="bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500 px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  إلغاء
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 min-w-[80px] flex items-center gap-2 ${
                    isSaving
                      ? 'bg-gray-600/50 text-gray-400 border border-gray-600 cursor-not-allowed'
                      : 'bg-transparent hover:bg-gray-600/10 text-gray-300 border border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      حفظ الإعدادات
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}