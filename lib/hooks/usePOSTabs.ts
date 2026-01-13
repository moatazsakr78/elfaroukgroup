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
  selectedCustomerForPurchase?: any;
  selectedWarehouse?: any;
  transferFromLocation?: any;
  transferToLocation?: any;
  isPostponed?: boolean;
  postponedAt?: string;
  // Edit Invoice Mode
  isEditMode?: boolean;
  editInvoiceData?: any;
}

interface InheritedSelections {
  customer?: any;
  branch?: any;
  record?: any;
  priceType?: string;
  isPurchaseMode?: boolean;
  selectedSupplier?: any;
  selectedCustomerForPurchase?: any;
}

interface EditModeOptions {
  isEditMode?: boolean;
  editInvoiceData?: any;
}

interface UsePOSTabsReturn {
  tabs: POSTab[];
  activeTab: POSTab | undefined;
  activeTabId: string;
  addTab: (title: string, inheritedSelections?: InheritedSelections) => void;
  addTabWithCustomer: (customer: any, inheritedSelections?: InheritedSelections) => void;
  addTabWithCustomerAndCart: (customer: any, cartItems: any[], title: string, inheritedSelections?: InheritedSelections, editModeOptions?: EditModeOptions) => string;
  createTabFromMainWithCart: (customer: any, cartItems: any[], inheritedSelections?: InheritedSelections, defaultCustomer?: any) => string;
  updateTabCustomerAndTitle: (tabId: string, customer: any, title: string) => void;
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
    priceType: 'price',
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
          isPurchaseMode: inheritedSelections?.isPurchaseMode || false,
          selectedSupplier: inheritedSelections?.selectedSupplier || null,
          selectedCustomerForPurchase: inheritedSelections?.selectedCustomerForPurchase || null,
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
    // Default customer gets "نقطة البيع" as title, others get customer name
    const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
    const isDefaultCustomer = customer?.id === DEFAULT_CUSTOMER_ID || customer?.name === 'عميل';
    const title = isDefaultCustomer ? 'نقطة البيع' : (customer?.name || 'فاتورة جديدة');

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
  // editModeOptions: Pass isEditMode and editInvoiceData directly to avoid race conditions
  const addTabWithCustomerAndCart = useCallback((customer: any, cartItems: any[], title: string, inheritedSelections?: InheritedSelections, editModeOptions?: EditModeOptions): string => {
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
          // Set edit mode directly when creating the tab (no setTimeout needed)
          isEditMode: editModeOptions?.isEditMode || false,
          editInvoiceData: editModeOptions?.editInvoiceData || null,
        },
      ];
      // Instant save
      saveState(newTabs, newTabId);
      return newTabs;
    });
    setActiveTabId(newTabId);
    return newTabId;
  }, [saveState]);

  // Create tab from main tab with cart transfer
  // This function transfers the cart from main tab to a new customer tab
  // and resets the main tab (clears cart and resets customer to default)
  const createTabFromMainWithCart = useCallback((
    customer: any,
    cartItems: any[],
    inheritedSelections?: InheritedSelections,
    defaultCustomer?: any
  ): string => {
    const newTabId = `pos-${Date.now()}`;
    // Default customer gets "نقطة البيع" as title, others get customer name
    const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
    const isDefaultCustomer = customer?.id === DEFAULT_CUSTOMER_ID || customer?.name === 'عميل';
    const tabTitle = isDefaultCustomer ? 'نقطة البيع' : (customer?.name || 'فاتورة جديدة');

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
      const newTabs: POSTab[] = [];

      // Process existing tabs
      for (const tab of prev) {
        if (tab.id === 'main') {
          // Reset main tab: clear cart and reset customer to default
          newTabs.push({
            ...tab,
            active: false,
            cartItems: [],
            selections: {
              ...tab.selections,
              customer: defaultCustomer || null,
            },
          });
        } else {
          newTabs.push({ ...tab, active: false });
        }
      }

      // Add the new customer tab with the cart items
      newTabs.push({
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
      });

      // Instant save
      saveState(newTabs, newTabId);
      return newTabs;
    });

    setActiveTabId(newTabId);
    return newTabId;
  }, [saveState]);

  // Update tab's customer and title (for changing customer from context menu)
  // Also applies customer's default record and price type if set
  const updateTabCustomerAndTitle = useCallback((tabId: string, customer: any, title: string) => {
    setTabs(prev => {
      const newTabs = prev.map(tab => {
        if (tab.id === tabId) {
          // Get customer's default record if set, otherwise keep existing
          let customerRecord = tab.selections.record;
          if (customer?.default_record_id) {
            customerRecord = { id: customer.default_record_id };
          }

          // Get customer's default price type if set, otherwise keep existing
          const customerPriceType = customer?.default_price_type || tab.selections.priceType || 'price';

          return {
            ...tab,
            title: title,
            selections: {
              ...tab.selections,
              customer: customer,
              record: customerRecord,
              priceType: customerPriceType as any,
            },
          };
        }
        return tab;
      });
      saveState(newTabs, activeTabId);
      return newTabs;
    });
  }, [activeTabId, saveState]);

  const closeTab = useCallback((tabId: string) => {
    if (tabId === 'main') return;

    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      let newActiveId = activeTabId;

      if (activeTabId === tabId) {
        // Always switch to main tab after closing current tab
        // This prevents auto-opening postponed tabs after completing a sale
        newActiveId = 'main';
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
          // Clean up any tabs: ensure main tab never has edit mode
          const cleanedTabs = localState.tabs.map(tab => {
            if (tab.id === 'main') {
              return { ...tab, isEditMode: false, editInvoiceData: null };
            }
            return tab;
          });
          setTabs(cleanedTabs);
          setActiveTabId(localState.activeTabId || 'main');
        }

        // STEP 2: Sync with database in background
        const dbState = await posTabsService.loadTabsState(user.id);

        if (dbState && dbState.tabs && dbState.tabs.length > 0) {
          // Clean up DB tabs: ensure main tab never has edit mode
          const cleanedDbTabs = dbState.tabs.map((tab: any) => {
            if (tab.id === 'main') {
              return { ...tab, isEditMode: false, editInvoiceData: null };
            }
            return tab;
          });

          // If no local state, use DB state
          if (!localState || !localState.tabs || localState.tabs.length === 0) {
            console.log('POS Tabs: Using database state:', cleanedDbTabs.length, 'tabs');
            setTabs(cleanedDbTabs);
            setActiveTabId(dbState.active_tab_id || 'main');
            // Also save to localStorage for next time
            saveToLocalStorage(user.id, cleanedDbTabs, dbState.active_tab_id || 'main');
          }
          lastDbSavedDataRef.current = JSON.stringify({ tabs: cleanedDbTabs, activeTabId: dbState.active_tab_id });
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
    createTabFromMainWithCart,
    updateTabCustomerAndTitle,
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
