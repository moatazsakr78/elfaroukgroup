'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase/client';
import { useBrand } from '@/lib/brand/brand-context';

interface ThemeContextType {
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({ isLoading: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const { brandId } = useBrand();

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

    // Fetch active theme from database (brand-filtered if brandId available)
    const fetchActiveTheme = async () => {
      try {
        let query = (supabase as any)
          .from('store_theme_colors')
          .select('*')
          .eq('is_active', true);

        // Filter by brand if available
        if (brandId) {
          query = query.eq('brand_id', brandId);
        }

        const { data, error } = await query.single();

        if (data && !error) {
          setThemeVariables(data);
        } else if (brandId) {
          // Fallback: try without brand filter
          const { data: fallbackData, error: fallbackError } = await (supabase as any)
            .from('store_theme_colors')
            .select('*')
            .eq('is_active', true)
            .single();

          if (fallbackData && !fallbackError) {
            setThemeVariables(fallbackData);
          }
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
  }, [brandId]);

  return (
    <ThemeContext.Provider value={{ isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
