'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase/client';

interface ThemeContextType {
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({ isLoading: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set CSS variables on the document root
    const setThemeVariables = (theme: any) => {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', theme.primary_color);
      root.style.setProperty('--primary-hover-color', theme.primary_hover_color);
      root.style.setProperty('--button-color', theme.button_color);
      root.style.setProperty('--button-hover-color', theme.button_hover_color);
    };

    // Set default theme immediately (before fetching from DB)
    setThemeVariables({
      primary_color: '#5d1f1f',
      primary_hover_color: '#4A1616',
      button_color: '#5d1f1f',
      button_hover_color: '#4A1616',
    });

    // Fetch active theme from database
    const fetchActiveTheme = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('store_theme_colors')
          .select('*')
          .eq('is_active', true)
          .single();

        if (data && !error) {
          setThemeVariables(data);
        }
      } catch (err) {
        console.error('Error fetching theme:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveTheme();

    // Subscribe to theme changes
    const subscription = (supabase as any)
      .channel('store_theme_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'elfaroukgroup',
          table: 'store_theme_colors',
        },
        () => {
          fetchActiveTheme();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
