'use client';

import { useSystemSettings } from './useSystemSettings';

// Hook for components to use store display settings from the central system
export function useStoreDisplaySettings() {
  const { getSetting, updateSettings, isLoading } = useSystemSettings();

  // Get the current store display settings from the system settings
  const showQuantityInStore = getSetting('website.show_quantity_in_store', true);
  const showProductStarRating = getSetting('website.show_product_star_rating', true);

  const updateStoreDisplaySettings = async (settings: {
    showQuantityInStore?: boolean;
    showProductStarRating?: boolean;
  }) => {
    try {
      await updateSettings({
        website: {
          ...(settings.showQuantityInStore !== undefined && { show_quantity_in_store: settings.showQuantityInStore }),
          ...(settings.showProductStarRating !== undefined && { show_product_star_rating: settings.showProductStarRating })
        }
      });
    } catch (error) {
      console.error('Error updating store display settings:', error);
      throw error;
    }
  };

  return {
    showQuantityInStore,
    showProductStarRating,
    updateStoreDisplaySettings,
    isLoading
  };
}
