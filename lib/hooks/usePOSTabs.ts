import { useState, useCallback, useEffect, useRef } from 'react';
import { posTabsService } from '@/lib/services/posTabsService';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/services/posTabsLocalStorage';
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
    priceType?: 'price' | 'wholesale_price' | 'price1' | 'price2' | 'price3' | 'price4';
  };
  isPurchaseMode?: boolean;
  isTransferMode?: boolean;
  isReturnMode?: boolean;
  selectedSupplier?: any;
  selectedWarehouse?: any;
  transferFromLocation?: any;
  transferToLocation?: any;
  isPostponed?: boolean;
  postponedAt?: string;
}

interface InheritedSelections {
  customer?: any;
  branch?: any;
  record?: any;
  priceType?: string;
}

interface UsePOSTabsReturn {
  tabs: POSTab[];
  activeTab: POSTab | undefined;
  activeTabId: string;
  addTab: (title: string, inheritedSelections?: InheritedSelections) => void;
  addTabWithCustomer: (customer: any, inheritedSelections?: InheritedSelections) => void;
  addTabWithCustomerAndCart: (customer: any, cartItems: any[], title: string, inheritedSelections?: InheritedSelections) => string;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateActiveTabCart: (cartItems: any[]) => void;
  updateActiveTabSelections: (selections: any) => void;
  updateActiveTabMode: (updates: Partial<POSTab>) => void;
  clearActiveTabCart: () => void;
  postponeTab: (tabId: string) => void;
  restoreTab: (tabId: string) => void;
  postponedTabs: POSTab[];
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
  const dbSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const lastDbSavedDataRef = useRef<string>('');
  const userIdRef = useRef<string | null>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // ============================================
  // INSTANT LOCAL STORAGE SAVE (synchronous)
  // ============================================
  const saveToLocal = useCallback((tabsToSave: POSTab[], activeId: string) => {
    if (!userIdRef.current) return;
    saveToLocalStorage(userIdRef.current, tabsToSave, activeId);
  }, []);

  // ============================================
  // DATABASE SAVE (async, debounced)
  // ============================================
  const saveToDatabase = useCallback(async (tabsToSave: POSTab[], activeId: string) => {
    const userId = userIdRef.current;
    if (!userId) {
      console.warn('POS Tabs: Cannot save to DB - no user ID');
      return false;
    }

    const dataToSave = JSON.stringify({ tabs: tabsToSave, activeTabId: activeId });

    // Skip if data hasn't changed
    if (dataToSave === lastDbSavedDataRef.current) {
      return true;
    }

    try {
      setIsSaving(true);
      const success = await posTabsService.saveTabsState(userId, tabsToSave, activeId);
      if (success) {
        lastDbSavedDataRef.current = dataToSave;
        setLastSaved(new Date());
        console.log('POS Tabs: Saved to database');
      }
      return success;
    } catch (error) {
      console.error('POS Tabs: Failed to save to database:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ============================================
  // COMBINED SAVE: localStorage (instant) + DB (debounced)
  // ============================================
  const saveState = useCallback((newTabs: POSTab[], newActiveTabId: string) => {
    // 1. INSTANT: Save to localStorage (synchronous, never fails)
    saveToLocal(newTabs, newActiveTabId);

    // 2. DEBOUNCED: Save to database (async, for cross-device sync)
    if (dbSaveTimeoutRef.current) {
      clearTimeout(dbSaveTimeoutRef.current);
    }
    dbSaveTimeoutRef.current = setTimeout(() => {
      saveToDatabase(newTabs, newActiveTabId);
    }, 2000); // 2 seconds debounce for DB (localStorage is instant)
  }, [saveToLocal, saveToDatabase]);

  // ============================================
  // TAB MANAGEMENT FUNCTIONS
  // ============================================
  const addTab = useCallback((title: string, inheritedSelections?: InheritedSelections) => {
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
            customer: inheritedSelections?.customer || null,
            branch: inheritedSelections?.branch || null,
            record: inheritedSelections?.record || null,
            priceType: inheritedSelections?.priceType as any || 'price',
          },
        },
      ];
      // Instant save
      saveState(newTabs, newTabId);
      return newTabs;
    });
    setActiveTabId(newTabId);
  }, [saveState]);

  // Add tab with customer already selected
  // Uses customer's default record and price type if available
  // Falls back to inherited selections (from main tab)
  const addTabWithCustomer = useCallback((customer: any, inheritedSelections?: InheritedSelections) => {
    const newTabId = `pos-${Date.now()}`;
    const title = customer?.name || 'فاتورة جديدة';

    // Get customer's default record if set
    let customerRecord = null;
    if (customer?.default_record_id) {
      customerRecord = { id: customer.default_record_id };
    } else if (inheritedSelections?.record) {
      customerRecord = inheritedSelections.record;
    }

    // Get customer's default price type if set
    const customerPriceType = customer?.default_price_type || inheritedSelections?.priceType || 'price';

    setTabs(prev => {
      const newTabs = [
        ...prev.map(tab => ({ ...tab, active: false })),
        {
          id: newTabId,
          title,
          active: true,
          cartItems: [],
          selections: {
            customer: customer,
            branch: inheritedSelections?.branch || null,
            record: customerRecord,
            priceType: customerPriceType as any,
          },
        },
      ];
      // Instant save
      saveState(newTabs, newTabId);
      return newTabs;
    });
    setActiveTabId(newTabId);
  }, [saveState]);

  // Add tab with customer, cart items, and custom title (for edit invoice mode)
  // Returns the new tab ID
  const addTabWithCustomerAndCart = useCallback((customer: any, cartItems: any[], title: string, inheritedSelections?: InheritedSelections): string => {
    const newTabId = `pos-${Date.now()}`;
    const tabTitle = title || customer?.name || 'فاتورة جديدة';

    // Get customer's default record if set
    let customerRecord = null;
    if (customer?.default_record_id) {
      customerRecord = { id: customer.default_record_id };
    } else if (inheritedSelections?.record) {
      customerRecord = inheritedSelections.record;
    }

    // Get customer's default price type if set
    const customerPriceType = customer?.default_price_type || inheritedSelections?.priceType || 'price';

    setTabs(prev => {
      const newTabs = [
        ...prev.map(tab => ({ ...tab, active: false })),
        {
          id: newTabId,
          title: tabTitle,
          active: true,
          cartItems: cartItems,
          selections: {
            customer: customer,
            branch: inheritedSelections?.branch || null,
            record: customerRecord,
            priceType: customerPriceType as any,
          },
        },
      ];
      // Instant save
      saveState(newTabs, newTabId);
      return newTabs;
    });
    setActiveTabId(newTabId);
    return newTabId;
  }, [saveState]);

  const closeTab = useCallback((tabId: string) => {
    if (tabId === 'main') return;

    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      let newActiveId = activeTabId;

      if (activeTabId === tabId) {
        const lastTab = newTabs[newTabs.length - 1];
        newActiveId = lastTab?.id || 'main';
        setActiveTabId(newActiveId);
      }

      const finalTabs = newTabs.map(tab => ({
        ...tab,
        active: tab.id === newActiveId,
      }));

      // Instant save
      saveState(finalTabs, newActiveId);
      return finalTabs;
    });
  }, [activeTabId, saveState]);

  const switchTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.map(tab => ({
        ...tab,
        active: tab.id === tabId,
      }));
      // Instant save
      saveState(newTabs, tabId);
      return newTabs;
    });
    setActiveTabId(tabId);
  }, [saveState]);

  const updateActiveTabCart = useCallback((cartItems: any[]) => {
    setTabs(prev => {
      const newTabs = prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, cartItems }
          : tab
      );
      // Instant save
      saveState(newTabs, activeTabId);
      return newTabs;
    });
  }, [activeTabId, saveState]);

  const updateActiveTabSelections = useCallback((selections: any) => {
    setTabs(prev => {
      const newTabs = prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, selections }
          : tab
      );
      // Instant save
      saveState(newTabs, activeTabId);
      return newTabs;
    });
  }, [activeTabId, saveState]);

  const updateActiveTabMode = useCallback((updates: Partial<POSTab>) => {
    setTabs(prev => {
      const newTabs = prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, ...updates }
          : tab
      );
      // Instant save
      saveState(newTabs, activeTabId);
      return newTabs;
    });
  }, [activeTabId, saveState]);

  const clearActiveTabCart = useCallback(() => {
    setTabs(prev => {
      const newTabs = prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, cartItems: [] }
          : tab
      );
      // Instant save
      saveState(newTabs, activeTabId);
      return newTabs;
    });
  }, [activeTabId, saveState]);

  // ============================================
  // POSTPONE TAB: Mark tab as postponed and switch to another tab
  // ============================================
  const postponeTab = useCallback((tabId: string) => {
    // Cannot postpone the main tab
    if (tabId === 'main') return;

    setTabs(prev => {
      const tabToPostpone = prev.find(tab => tab.id === tabId);
      if (!tabToPostpone || tabToPostpone.cartItems.length === 0) return prev;

      // Mark tab as postponed
      const newTabs = prev.map(tab => {
        if (tab.id === tabId) {
          return {
            ...tab,
            isPostponed: true,
            postponedAt: new Date().toISOString(),
            active: false,
          };
        }
        return tab;
      });

      // If the postponed tab was active, switch to main tab
      let newActiveId = activeTabId;
      if (activeTabId === tabId) {
        newActiveId = 'main';
        // Mark main as active
        const finalTabs = newTabs.map(tab => ({
          ...tab,
          active: tab.id === 'main',
        }));
        saveState(finalTabs, newActiveId);
        setActiveTabId(newActiveId);
        return finalTabs;
      }

      saveState(newTabs, activeTabId);
      return newTabs;
    });
  }, [activeTabId, saveState]);

  // ============================================
  // RESTORE TAB: Restore a postponed tab and switch to it
  // ============================================
  const restoreTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.map(tab => {
        if (tab.id === tabId) {
          return {
            ...tab,
            isPostponed: false,
            postponedAt: undefined,
            active: true,
          };
        }
        return { ...tab, active: false };
      });

      saveState(newTabs, tabId);
      setActiveTabId(tabId);
      return newTabs;
    });
  }, [saveState]);

  // Get postponed tabs
  const postponedTabs = tabs.filter(tab => tab.isPostponed === true);

  // ============================================
  // LOAD STATE: localStorage first, then DB sync
  // ============================================
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

        // STEP 1: Load from localStorage FIRST (instant)
        const localState = loadFromLocalStorage(user.id);

        if (localState && localState.tabs && localState.tabs.length > 0) {
          console.log('POS Tabs: Loaded from localStorage:', localState.tabs.length, 'tabs');
          setTabs(localState.tabs);
          setActiveTabId(localState.activeTabId || 'main');
        }

        // STEP 2: Sync with database in background
        const dbState = await posTabsService.loadTabsState(user.id);

        if (dbState && dbState.tabs && dbState.tabs.length > 0) {
          // If no local state, use DB state
          if (!localState || !localState.tabs || localState.tabs.length === 0) {
            console.log('POS Tabs: Using database state:', dbState.tabs.length, 'tabs');
            setTabs(dbState.tabs);
            setActiveTabId(dbState.active_tab_id || 'main');
            // Also save to localStorage for next time
            saveToLocalStorage(user.id, dbState.tabs, dbState.active_tab_id || 'main');
          }
          lastDbSavedDataRef.current = JSON.stringify({ tabs: dbState.tabs, activeTabId: dbState.active_tab_id });
        }

      } catch (error) {
        console.error('POS Tabs: Failed to load state:', error);
      } finally {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    };

    loadTabsState();
  }, [user?.id, isAuthenticated, authLoading]);

  // ============================================
  // REAL-TIME SYNC FROM OTHER DEVICES
  // ============================================
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
          const newData = payload.new;
          if (newData && newData.tabs) {
            const incomingData = JSON.stringify({ tabs: newData.tabs, activeTabId: newData.active_tab_id });

            // Only update if change came from another device
            if (incomingData !== lastDbSavedDataRef.current) {
              console.log('POS Tabs: Received update from another device');
              setTabs(newData.tabs);
              setActiveTabId(newData.active_tab_id || 'main');
              lastDbSavedDataRef.current = incomingData;
              // Update localStorage too
              saveToLocalStorage(userId, newData.tabs, newData.active_tab_id || 'main');
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // ============================================
  // CLEANUP: Clear DB timeout on unmount
  // ============================================
  useEffect(() => {
    return () => {
      if (dbSaveTimeoutRef.current) {
        clearTimeout(dbSaveTimeoutRef.current);
        // Force immediate DB save on unmount
        if (userIdRef.current && !isInitialMount.current) {
          posTabsService.saveTabsState(userIdRef.current, tabs, activeTabId);
        }
      }
    };
  }, [tabs, activeTabId]);

  // Filter out postponed tabs from active tabs display
  const activeTabs = tabs.filter(tab => !tab.isPostponed);

  return {
    tabs: activeTabs,
    activeTab,
    activeTabId,
    addTab,
    addTabWithCustomer,
    addTabWithCustomerAndCart,
    closeTab,
    switchTab,
    updateActiveTabCart,
    updateActiveTabSelections,
    updateActiveTabMode,
    clearActiveTabCart,
    postponeTab,
    restoreTab,
    postponedTabs,
    isLoading,
    isSaving,
    lastSaved,
  };
}
