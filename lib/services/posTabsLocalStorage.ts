/**
 * POS Tabs Local Storage Service
 * Provides instant local persistence for POS tabs/cart data
 * Works offline and syncs with database in background
 */

import { POSTab } from '@/lib/hooks/usePOSTabs';

const STORAGE_KEY = 'pos_tabs_state';

export interface LocalPOSTabsState {
  tabs: POSTab[];
  activeTabId: string;
  userId: string;
  lastUpdated: number; // timestamp
}

/**
 * Save POS tabs state to localStorage (instant, synchronous)
 */
export function saveToLocalStorage(userId: string, tabs: POSTab[], activeTabId: string): boolean {
  if (!userId || typeof window === 'undefined') {
    return false;
  }

  try {
    const state: LocalPOSTabsState = {
      tabs,
      activeTabId,
      userId,
      lastUpdated: Date.now()
    };

    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state));
    console.log('POS Tabs: Saved to localStorage instantly');
    return true;
  } catch (error) {
    console.error('POS Tabs: Failed to save to localStorage:', error);
    return false;
  }
}

/**
 * Load POS tabs state from localStorage (instant, synchronous)
 */
export function loadFromLocalStorage(userId: string): LocalPOSTabsState | null {
  if (!userId || typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!stored) {
      return null;
    }

    const state: LocalPOSTabsState = JSON.parse(stored);

    // Verify the data belongs to this user
    if (state.userId !== userId) {
      console.warn('POS Tabs: localStorage data belongs to different user');
      return null;
    }

    console.log('POS Tabs: Loaded from localStorage, items:', state.tabs.length);
    return state;
  } catch (error) {
    console.error('POS Tabs: Failed to load from localStorage:', error);
    return null;
  }
}

/**
 * Clear POS tabs state from localStorage
 */
export function clearLocalStorage(userId: string): boolean {
  if (!userId || typeof window === 'undefined') {
    return false;
  }

  try {
    localStorage.removeItem(`${STORAGE_KEY}_${userId}`);
    return true;
  } catch (error) {
    console.error('POS Tabs: Failed to clear localStorage:', error);
    return false;
  }
}

/**
 * Check if localStorage has newer data than database
 */
export function isLocalStorageNewer(localState: LocalPOSTabsState | null, dbUpdatedAt: string | null): boolean {
  if (!localState) return false;
  if (!dbUpdatedAt) return true;

  const dbTimestamp = new Date(dbUpdatedAt).getTime();
  return localState.lastUpdated > dbTimestamp;
}

/**
 * Get the timestamp of last localStorage update
 */
export function getLocalStorageTimestamp(userId: string): number | null {
  const state = loadFromLocalStorage(userId);
  return state?.lastUpdated || null;
}
