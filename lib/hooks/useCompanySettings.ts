'use client';

import { useSystemSettings } from './useSystemSettings';
import { CompanySettings, SocialMedia, Branch } from '../types/settings';

// Hook for managing company information
export function useCompanySettings() {
  const { getCompanySettings, updateSettings, isLoading } = useSystemSettings();

  // Get company settings from system settings
  const companySettings = getCompanySettings();

  const updateCompanySettings = async (settings: Partial<CompanySettings>) => {
    try {
      await updateSettings({
        company: settings
      });
    } catch (error) {
      console.error('Error updating company settings:', error);
      throw error;
    }
  };

  return {
    companyName: companySettings.name,
    logoUrl: companySettings.logoUrl,
    logoShape: companySettings.logoShape,
    socialMedia: companySettings.socialMedia,
    branches: companySettings.branches,
    updateCompanySettings,
    isLoading
  };
}

// Export types for convenience
export type { CompanySettings, SocialMedia, Branch };
