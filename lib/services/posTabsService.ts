import { supabase } from '@/app/lib/supabase/client';
import { POSTab } from '@/lib/hooks/usePOSTabs';

export interface POSTabsState {
  tabs: POSTab[];
  active_tab_id: string;
}

/**
 * Service for managing POS tabs state in Supabase
 * Uses NextAuth user ID (not Supabase Auth)
 */
class POSTabsService {
  /**
   * Load POS tabs state from database
   */
  async loadTabsState(userId: string): Promise<POSTabsState | null> {
    if (!userId) {
      console.warn('POS Tabs: No user ID provided');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('pos_tabs_state')
        .select('tabs, active_tab_id')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found, return null
          console.log('POS Tabs: No saved state found for user');
          return null;
        }
        console.error('POS Tabs: Error loading state:', error);
        return null;
      }

      console.log('POS Tabs: State loaded successfully');
      return {
        tabs: data.tabs as unknown as POSTab[],
        active_tab_id: data.active_tab_id as string
      };
    } catch (error) {
      console.error('POS Tabs: Exception loading state:', error);
      return null;
    }
  }

  /**
   * Save POS tabs state to database
   */
  async saveTabsState(userId: string, tabs: POSTab[], activeTabId: string): Promise<boolean> {
    if (!userId) {
      console.warn('POS Tabs: Cannot save - no user ID provided');
      return false;
    }

    try {
      const { error } = await supabase
        .from('pos_tabs_state')
        .upsert({
          user_id: userId,
          tabs: tabs as unknown as any,
          active_tab_id: activeTabId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('POS Tabs: Error saving state:', error);
        return false;
      }

      console.log('POS Tabs: State saved successfully');
      return true;
    } catch (error) {
      console.error('POS Tabs: Exception saving state:', error);
      return false;
    }
  }

  /**
   * Clear POS tabs state from database
   */
  async clearTabsState(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('pos_tabs_state')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('POS Tabs: Error clearing state:', error);
        return false;
      }

      console.log('POS Tabs: State cleared successfully');
      return true;
    } catch (error) {
      console.error('POS Tabs: Exception clearing state:', error);
      return false;
    }
  }
}

// Export singleton instance
export const posTabsService = new POSTabsService();
