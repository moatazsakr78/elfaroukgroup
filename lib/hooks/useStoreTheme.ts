import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase/client';

export interface StoreThemeColors {
  id: string;
  name: string;
  primary_color: string;
  primary_hover_color: string;
  interactive_color: string;
  button_color: string;
  button_hover_color: string;
  is_active: boolean;
  is_default: boolean;
}

// Default colors (fallback)
const DEFAULT_THEME: StoreThemeColors = {
  id: 'default',
  name: 'أحمر كلاسيكي',
  primary_color: '#5d1f1f',
  primary_hover_color: '#4A1616',
  interactive_color: '#EF4444',
  button_color: '#5d1f1f',
  button_hover_color: '#4A1616',
  is_active: true,
  is_default: true,
};

export function useStoreTheme() {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_THEME.primary_color);
  const [primaryHoverColor, setPrimaryHoverColor] = useState(DEFAULT_THEME.primary_hover_color);
  const [interactiveColor, setInteractiveColor] = useState(DEFAULT_THEME.interactive_color);
  const [buttonColor, setButtonColor] = useState(DEFAULT_THEME.button_color);
  const [buttonHoverColor, setButtonHoverColor] = useState(DEFAULT_THEME.button_hover_color);
  const [themeName, setThemeName] = useState(DEFAULT_THEME.name);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch active theme
    const fetchActiveTheme = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('store_theme_colors')
          .select('*')
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('Error fetching active theme:', error);
          // Use default theme on error
          setPrimaryColor(DEFAULT_THEME.primary_color);
          setPrimaryHoverColor(DEFAULT_THEME.primary_hover_color);
          setInteractiveColor(DEFAULT_THEME.interactive_color);
          setButtonColor(DEFAULT_THEME.button_color);
          setButtonHoverColor(DEFAULT_THEME.button_hover_color);
          setThemeName(DEFAULT_THEME.name);
        } else if (data) {
          setPrimaryColor(data.primary_color);
          setPrimaryHoverColor(data.primary_hover_color);
          setInteractiveColor(data.interactive_color || DEFAULT_THEME.interactive_color);
          setButtonColor(data.button_color);
          setButtonHoverColor(data.button_hover_color);
          setThemeName(data.name);
        }
      } catch (err) {
        console.error('Unexpected error fetching theme:', err);
        // Use default theme on error
        setPrimaryColor(DEFAULT_THEME.primary_color);
        setPrimaryHoverColor(DEFAULT_THEME.primary_hover_color);
        setInteractiveColor(DEFAULT_THEME.interactive_color);
        setButtonColor(DEFAULT_THEME.button_color);
        setButtonHoverColor(DEFAULT_THEME.button_hover_color);
        setThemeName(DEFAULT_THEME.name);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveTheme();

    // Subscribe to changes
    const subscription = (supabase as any)
      .channel('store_theme_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_theme_colors',
        },
        (payload: any) => {
          // Re-fetch when theme changes
          fetchActiveTheme();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    primaryColor,
    primaryHoverColor,
    interactiveColor,
    buttonColor,
    buttonHoverColor,
    themeName,
    isLoading,
  };
}

// Hook for managing all themes (for settings page)
export function useStoreThemes() {
  const [themes, setThemes] = useState<StoreThemeColors[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchThemes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('store_theme_colors')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching themes:', error);
        setThemes([DEFAULT_THEME]);
      } else {
        setThemes(data || [DEFAULT_THEME]);
      }
    } catch (err) {
      console.error('Unexpected error fetching themes:', err);
      setThemes([DEFAULT_THEME]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();

    // Subscribe to changes
    const subscription = (supabase as any)
      .channel('store_themes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_theme_colors',
        },
        () => {
          fetchThemes();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addTheme = async (name: string, primaryColor: string, primaryHoverColor: string, interactiveColor: string, buttonColor: string, buttonHoverColor: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('store_theme_colors')
        .insert({
          name,
          primary_color: primaryColor,
          primary_hover_color: primaryHoverColor,
          interactive_color: interactiveColor,
          button_color: buttonColor,
          button_hover_color: buttonHoverColor,
          is_active: false,
          is_default: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding theme:', error);
        throw error;
      }

      await fetchThemes();
      return data;
    } catch (err) {
      console.error('Error in addTheme:', err);
      throw err;
    }
  };

  const activateTheme = async (themeId: string) => {
    try {
      // First, deactivate all themes
      const { error: deactivateError } = await (supabase as any)
        .from('store_theme_colors')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

      if (deactivateError) {
        console.error('Error deactivating themes:', deactivateError);
        throw deactivateError;
      }

      // Then activate the selected theme
      const { error: activateError } = await (supabase as any)
        .from('store_theme_colors')
        .update({ is_active: true })
        .eq('id', themeId);

      if (activateError) {
        console.error('Error activating theme:', activateError);
        throw activateError;
      }

      await fetchThemes();
    } catch (err) {
      console.error('Error in activateTheme:', err);
      throw err;
    }
  };

  const deleteTheme = async (themeId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('store_theme_colors')
        .delete()
        .eq('id', themeId);

      if (error) {
        console.error('Error deleting theme:', error);
        throw error;
      }

      await fetchThemes();
    } catch (err) {
      console.error('Error in deleteTheme:', err);
      throw err;
    }
  };

  const updateTheme = async (themeId: string, primaryColor: string, primaryHoverColor: string, interactiveColor: string, buttonColor: string, buttonHoverColor: string) => {
    try {
      const { error } = await (supabase as any)
        .from('store_theme_colors')
        .update({
          primary_color: primaryColor,
          primary_hover_color: primaryHoverColor,
          interactive_color: interactiveColor,
          button_color: buttonColor,
          button_hover_color: buttonHoverColor,
        })
        .eq('id', themeId);

      if (error) {
        console.error('Error updating theme:', error);
        throw error;
      }

      await fetchThemes();
    } catch (err) {
      console.error('Error in updateTheme:', err);
      throw err;
    }
  };

  return {
    themes,
    isLoading,
    addTheme,
    activateTheme,
    deleteTheme,
    updateTheme,
    refreshThemes: fetchThemes,
  };
}
