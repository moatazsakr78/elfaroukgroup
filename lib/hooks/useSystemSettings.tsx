'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import { updateCurrencyList, addCustomCurrency, CURRENCY_LIST } from '../constants/currencies';
import {
  SystemSettingsObject,
  DEFAULT_SETTINGS,
  SettingsUpdateInput,
  SettingsRow
} from '../types/settings';

// System Settings Context Interface
interface SystemSettingsContextType {
  // Main settings object
  settings: SystemSettingsObject;
  isLoading: boolean;
  error: string | null;

  // Core functions
  updateSettings: (updates: SettingsUpdateInput) => Promise<void>;
  getSetting: <T>(path: string, defaultValue?: T) => T;
  refreshSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;

  // Currency specific functions
  customCurrencies: string[];
  addNewCustomCurrency: (currency: string) => Promise<void>;
  deleteCustomCurrency: (currency: string) => Promise<void>;
  getAvailableCurrencies: () => string[];

  // Category specific getters
  getCurrencySettings: () => SystemSettingsObject['currency'];
  getWebsiteSettings: () => SystemSettingsObject['website'];
  getUISettings: () => SystemSettingsObject['ui'];
  getSystemSettings: () => SystemSettingsObject['system'];
  getPOSSettings: () => SystemSettingsObject['pos'];
  getReportsSettings: () => SystemSettingsObject['reports'];
  getSecuritySettings: () => SystemSettingsObject['security'];
  getCompanySettings: () => SystemSettingsObject['company'];
}

const SystemSettingsContext = createContext<SystemSettingsContextType | null>(null);

// System Settings Provider Component
interface SystemSettingsProviderProps {
  children: ReactNode;
}

export const SystemSettingsProvider: React.FC<SystemSettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettingsObject>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customCurrencies, setCustomCurrencies] = useState<string[]>([]);

  // Helper function to get nested property value with dot notation
  const getSetting = <T,>(path: string, defaultValue?: T): T => {
    const keys = path.split('.');
    let current: any = settings;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue as T;
      }
      current = current[key];
    }

    return current as T;
  };

  // Load custom currencies from database
  const loadCustomCurrencies = async () => {
    try {
      const { data: currencies, error } = await (supabase as any)
        .from('custom_currencies')
        .select('currency_name')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading custom currencies:', error);
        setCustomCurrencies([]);
        updateCurrencyList([]);
        return;
      }

      const currencyNames = currencies?.map((c: any) => c.currency_name) || [];
      setCustomCurrencies(currencyNames);
      updateCurrencyList(currencyNames);
    } catch (err) {
      console.error('Error loading custom currencies:', err);
      setCustomCurrencies([]);
      updateCurrencyList([]);
    }
  };

  // Load settings from database
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load system settings from new JSON structure
      const { data: settingsData, error: settingsError } = await (supabase as any)
        .from('system_settings')
        .select('settings_data')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        // Silently handle error and use default settings
        setSettings(DEFAULT_SETTINGS);
      } else if (settingsData?.settings_data) {
        // Merge with defaults to ensure all properties exist
        const loadedSettings = {
          ...DEFAULT_SETTINGS,
          ...settingsData.settings_data,
          // Ensure nested objects are properly merged
          currency: { ...DEFAULT_SETTINGS.currency, ...settingsData.settings_data.currency },
          website: { ...DEFAULT_SETTINGS.website, ...settingsData.settings_data.website },
          ui: { ...DEFAULT_SETTINGS.ui, ...settingsData.settings_data.ui },
          system: { ...DEFAULT_SETTINGS.system, ...settingsData.settings_data.system },
          pos: { ...DEFAULT_SETTINGS.pos, ...settingsData.settings_data.pos },
          reports: { ...DEFAULT_SETTINGS.reports, ...settingsData.settings_data.reports },
          security: { ...DEFAULT_SETTINGS.security, ...settingsData.settings_data.security },
          company: { ...DEFAULT_SETTINGS.company, ...settingsData.settings_data.company }
        };
        setSettings(loadedSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }

      // Load custom currencies
      await loadCustomCurrencies();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في تحميل الإعدادات');
      console.error('Error loading settings:', err);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  // Update settings in database
  const updateSettings = async (updates: SettingsUpdateInput) => {
    try {
      // Merge updates with current settings
      const updatedSettings = {
        ...settings,
        ...updates,
        // Deep merge for nested objects
        ...(updates.currency && { currency: { ...settings.currency, ...updates.currency } }),
        ...(updates.website && { website: { ...settings.website, ...updates.website } }),
        ...(updates.ui && { ui: { ...settings.ui, ...updates.ui } }),
        ...(updates.system && { system: { ...settings.system, ...updates.system } }),
        ...(updates.pos && { pos: { ...settings.pos, ...updates.pos } }),
        ...(updates.reports && { reports: { ...settings.reports, ...updates.reports } }),
        ...(updates.security && { security: { ...settings.security, ...updates.security } }),
        ...(updates.company && { company: { ...settings.company, ...updates.company } }),
        last_updated: new Date().toISOString()
      } as SystemSettingsObject;

      // Update in database
      const { error } = await (supabase as any)
        .from('system_settings')
        .update({
          settings_data: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true);

      if (error) {
        console.error('Error updating settings in database:', error);
        throw error;
      }

      // Update local state
      setSettings(updatedSettings);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في تحديث الإعدادات');
      console.error('Error updating settings:', err);
      throw err;
    }
  };

  // Add new custom currency
  const addNewCustomCurrency = async (currency: string) => {
    try {
      if (!currency || currency.trim() === '') {
        throw new Error('اسم العملة لا يمكن أن يكون فارغاً');
      }

      const trimmedCurrency = currency.trim();

      // Check if currency already exists
      if (customCurrencies.includes(trimmedCurrency)) {
        return;
      }

      // Insert into database
      const { error } = await (supabase as any)
        .from('custom_currencies')
        .insert({
          currency_name: trimmedCurrency,
          is_active: true,
          usage_count: 1
        });

      if (error) {
        console.error('Error adding custom currency to database:', error);
        throw error;
      }

      // Update local state
      const newCurrencies = [...customCurrencies, trimmedCurrency];
      setCustomCurrencies(newCurrencies);
      addCustomCurrency(trimmedCurrency);

    } catch (err) {
      console.error('Error adding custom currency:', err);
      throw err;
    }
  };

  // Delete custom currency
  const deleteCustomCurrency = async (currency: string) => {
    try {
      if (!currency || currency.trim() === '') {
        throw new Error('اسم العملة لا يمكن أن يكون فارغاً');
      }

      const trimmedCurrency = currency.trim();

      // Delete from database
      const { error } = await (supabase as any)
        .from('custom_currencies')
        .delete()
        .eq('currency_name', trimmedCurrency);

      if (error) {
        console.error('Error deleting custom currency from database:', error);
        throw error;
      }

      // Update local state
      const newCurrencies = customCurrencies.filter(c => c !== trimmedCurrency);
      setCustomCurrencies(newCurrencies);
      updateCurrencyList(newCurrencies);

    } catch (err) {
      console.error('Error deleting custom currency:', err);
      throw err;
    }
  };

  // Get available currencies (base + custom)
  const getAvailableCurrencies = () => {
    return [...CURRENCY_LIST];
  };

  // Refresh settings from database
  const refreshSettings = async () => {
    await loadSettings();
  };

  // Reset to default settings
  const resetToDefaults = async () => {
    try {
      const defaultsWithTimestamp = {
        ...DEFAULT_SETTINGS,
        last_updated: new Date().toISOString()
      };

      const { error } = await (supabase as any)
        .from('system_settings')
        .update({
          settings_data: defaultsWithTimestamp,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true);

      if (error) {
        console.error('Error resetting settings:', error);
        throw error;
      }

      setSettings(defaultsWithTimestamp);
    } catch (err) {
      console.error('Error resetting to defaults:', err);
      throw err;
    }
  };

  // Category specific getters
  const getCurrencySettings = () => settings.currency;
  const getWebsiteSettings = () => settings.website;
  const getUISettings = () => settings.ui;
  const getSystemSettings = () => settings.system;
  const getPOSSettings = () => settings.pos;
  const getReportsSettings = () => settings.reports;
  const getSecuritySettings = () => settings.security;
  const getCompanySettings = () => settings.company;

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Subscribe to settings changes (real-time)
  useEffect(() => {
    const subscription = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'elfaroukgroup',
          table: 'system_settings'
        },
        () => {
          // Reload settings when they change
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const contextValue: SystemSettingsContextType = {
    settings,
    isLoading,
    error,
    updateSettings,
    getSetting,
    refreshSettings,
    resetToDefaults,
    customCurrencies,
    addNewCustomCurrency,
    deleteCustomCurrency,
    getAvailableCurrencies,
    getCurrencySettings,
    getWebsiteSettings,
    getUISettings,
    getSystemSettings,
    getPOSSettings,
    getReportsSettings,
    getSecuritySettings,
    getCompanySettings
  };

  return (
    <SystemSettingsContext.Provider value={contextValue}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

// Custom hook to use system settings context
export const useSystemSettings = (): SystemSettingsContextType => {
  const context = useContext(SystemSettingsContext);

  if (!context) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }

  return context;
};

// Specialized hook for currency settings (backward compatibility)
export const useCurrencySettings = () => {
  const {
    getCurrencySettings,
    updateSettings,
    isLoading,
    getAvailableCurrencies,
    addNewCustomCurrency,
    deleteCustomCurrency
  } = useSystemSettings();

  const currencySettings = getCurrencySettings();

  const updateCurrencySettings = async (newSettings: {
    currency_mode?: string;
    system_currency?: string;
    website_currency?: string;
    unified_currency?: string;
  }) => {
    // Add custom currencies to database if they're new
    const promises = [];
    if (newSettings.system_currency && !getAvailableCurrencies().includes(newSettings.system_currency)) {
      promises.push(addNewCustomCurrency(newSettings.system_currency));
    }
    if (newSettings.website_currency && !getAvailableCurrencies().includes(newSettings.website_currency)) {
      promises.push(addNewCustomCurrency(newSettings.website_currency));
    }
    if (newSettings.unified_currency && !getAvailableCurrencies().includes(newSettings.unified_currency)) {
      promises.push(addNewCustomCurrency(newSettings.unified_currency));
    }

    await Promise.all(promises);

    // Update currency settings
    await updateSettings({
      currency: {
        ...(newSettings.currency_mode && { mode: newSettings.currency_mode as 'separate' | 'unified' }),
        ...(newSettings.system_currency && { system_currency: newSettings.system_currency }),
        ...(newSettings.website_currency && { website_currency: newSettings.website_currency }),
        ...(newSettings.unified_currency && { unified_currency: newSettings.unified_currency })
      }
    });
  };

  return {
    currencyMode: currencySettings.mode,
    systemCurrency: currencySettings.system_currency,
    websiteCurrency: currencySettings.website_currency,
    unifiedCurrency: currencySettings.unified_currency,
    updateCurrencySettings,
    isLoading,
    availableCurrencies: getAvailableCurrencies(),
    addNewCustomCurrency,
    deleteCustomCurrency
  };
};