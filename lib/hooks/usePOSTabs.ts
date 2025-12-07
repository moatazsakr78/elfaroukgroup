import { useState, useCallback, useEffect, useRef } from 'react';
import { posTabsService } from '@/lib/services/posTabsService';
import { supabase } from '@/app/lib/supabase/client';
import { useAuth } from '@/lib/useAuth';

export interface POSTab {
  id: string;
  title: string;
  active: boolean;
  cartItems: any[];
  selections: {
    customer: any;
    branch: any;
    record: any;
  };
  isPurchaseMode?: boolean;
  isTransferMode?: boolean;
  isReturnMode?: boolean;
  selectedSupplier?: any;
  selectedWarehouse?: any;
  transferFromLocation?: any;
  transferToLocation?: any;
}

interface UsePOSTabsReturn {
  tabs: POSTab[];
  activeTab: POSTab | undefined;
  activeTabId: string;
  addTab: (title: string) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateActiveTabCart: (cartItems: any[]) => void;
  updateActiveTabSelections: (selections: any) => void;
  updateActiveTabMode: (updates: Partial<POSTab>) => void;
  clearActiveTabCart: () => void;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

const DEFAULT_TAB: POSTab = {
  id: 'main',
  title: 'نقطة البيع',
  active: true,
  cartItems: [],
  selections: {
    customer: null,
    branch: null,
    record: null,
  },
};

export function usePOSTabs(): UsePOSTabsReturn {
  // Get user from NextAuth
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [tabs, setTabs] = useState<POSTab[]>([DEFAULT_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('main');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const lastSavedDataRef = useRef<string>('');
  const userIdRef = useRef<string | null>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Function to save tabs state immediately
  const saveTabsStateNow = useCallback(async (tabsToSave: POSTab[], activeId: string, userId?: string) => {
    const effectiveUserId = userId || userIdRef.current;
    if (!effectiveUserId) {
      console.warn('POS Tabs: Cannot save - no user ID');
      return false;
    }

    const dataToSave = JSON.stringify({ tabs: tabsToSave, activeTabId: activeId });

    // Skip if data hasn't changed
    if (dataToSave === lastSavedDataRef.current) {
      return true;
    }

    try {
      setIsSaving(true);
      const success = await posTabsService.saveTabsState(effectiveUserId, tabsToSave, activeId);
      if (success) {
        lastSavedDataRef.current = dataToSave;
        setLastSaved(new Date());
      }
      return success;
    } catch (error) {
      console.error('Failed to save POS tabs state:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const addTab = useCallback((title: string) => {
    const newTabId = `pos-${Date.now()}`;
    setTabs(prev => {
      const newTabs = [
        ...prev.map(tab => ({ ...tab, active: false })),
        {
          id: newTabId,
          title,
          active: true,
          cartItems: [],
          selections: {
            customer: null,
            branch: null,
            record: null,
          },
        },
      ];
      return newTabs;
    });
    setActiveTabId(newTabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    if (tabId === 'main') return;

    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);

      if (activeTabId === tabId) {
        const lastTab = newTabs[newTabs.length - 1];
        const newActiveId = lastTab?.id || 'main';
        setActiveTabId(newActiveId);
        return newTabs.map(tab => ({
          ...tab,
          active: tab.id === newActiveId,
        }));
      }

      return newTabs;
    });
  }, [activeTabId]);

  const switchTab = useCallback((tabId: string) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      active: tab.id === tabId,
    })));
    setActiveTabId(tabId);
  }, []);

  const updateActiveTabCart = useCallback((cartItems: any[]) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, cartItems }
        : tab
    ));
  }, [activeTabId]);

  const updateActiveTabSelections = useCallback((selections: any) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, selections }
        : tab
    ));
  }, [activeTabId]);

  const updateActiveTabMode = useCallback((updates: Partial<POSTab>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, ...updates }
        : tab
    ));
  }, [activeTabId]);

  const clearActiveTabCart = useCallback(() => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, cartItems: [] }
        : tab
    ));
  }, [activeTabId]);

  // Load tabs state from database when user is authenticated
  useEffect(() => {
    const loadTabsState = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      // Check if user is authenticated
      if (!isAuthenticated || !user?.id) {
        console.log('POS Tabs: No user logged in, using default tabs');
        setIsLoading(false);
        isInitialMount.current = false;
        userIdRef.current = null;
        return;
      }

      // Skip if already loaded for this user
      if (userIdRef.current === user.id && !isInitialMount.current) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        userIdRef.current = user.id;

        console.log('POS Tabs: Loading state for user:', user.id);
        const savedState = await posTabsService.loadTabsState(user.id);

        if (savedState && savedState.tabs && savedState.tabs.length > 0) {
          // Restore saved tabs
          setTabs(savedState.tabs);
          setActiveTabId(savedState.active_tab_id || 'main');
          lastSavedDataRef.current = JSON.stringify({ tabs: savedState.tabs, activeTabId: savedState.active_tab_id });
          console.log('POS Tabs: Loaded', savedState.tabs.length, 'tabs from database');
        } else {
          console.log('POS Tabs: No saved state found, using defaults');
        }
      } catch (error) {
        console.error('Failed to load POS tabs state:', error);
      } finally {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    };

    loadTabsState();
  }, [user?.id, isAuthenticated, authLoading]);

  // Real-time subscription for cross-device sync
  useEffect(() => {
    if (!userIdRef.current) return;

    const userId = userIdRef.current;

    const subscription = supabase
      .channel(`pos_tabs_state_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_tabs_state',
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          // Only update if the change came from another device/tab
          const newData = payload.new;
          if (newData && newData.tabs) {
            const incomingData = JSON.stringify({ tabs: newData.tabs, activeTabId: newData.active_tab_id });

            // If data is different from what we just saved, update local state
            if (incomingData !== lastSavedDataRef.current) {
              console.log('POS Tabs: Received update from another device');
              setTabs(newData.tabs);
              setActiveTabId(newData.active_tab_id || 'main');
              lastSavedDataRef.current = incomingData;
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Auto-save tabs state to database with debounce
  useEffect(() => {
    // Skip saving on initial mount or while loading
    if (isInitialMount.current || isLoading || authLoading) {
      return;
    }

    // Skip if no user
    if (!userIdRef.current) {
      return;
    }

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save operation (save after 300ms of no changes - faster!)
    saveTimeoutRef.current = setTimeout(async () => {
      await saveTabsStateNow(tabs, activeTabId);
    }, 300);

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, activeTabId, isLoading, authLoading, saveTabsStateNow]);

  // Save immediately when page is about to unload or becomes hidden
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Synchronous save attempt before unload
      if (!isInitialMount.current && userIdRef.current) {
        const dataToSave = JSON.stringify({ tabs, activeTabId });
        if (dataToSave !== lastSavedDataRef.current) {
          posTabsService.saveTabsState(userIdRef.current, tabs, activeTabId);
        }
      }
    };

    const handleVisibilityChange = () => {
      // Save when tab becomes hidden (user switches tabs or minimizes)
      if (document.visibilityState === 'hidden' && !isInitialMount.current && userIdRef.current) {
        saveTabsStateNow(tabs, activeTabId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tabs, activeTabId, saveTabsStateNow]);

  return {
    tabs,
    activeTab,
    activeTabId,
    addTab,
    closeTab,
    switchTab,
    updateActiveTabCart,
    updateActiveTabSelections,
    updateActiveTabMode,
    clearActiveTabCart,
    isLoading,
    isSaving,
    lastSaved,
  };
}
