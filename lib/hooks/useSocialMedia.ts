'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase/client';

// Type assertion for new tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Types
export interface SocialMediaLink {
  id: string;
  platform: string;
  platform_icon: string;
  custom_icon_url: string | null;
  link_url: string;
  whatsapp_number: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaSettings {
  id: string;
  icon_shape: 'square' | 'rounded';
  updated_at: string;
}

export interface CreateSocialMediaLink {
  platform: string;
  platform_icon: string;
  custom_icon_url?: string | null;
  link_url: string;
  whatsapp_number?: string | null;
  is_active?: boolean;
  display_order?: number;
}

// Platform icons with colors
export const PLATFORM_ICONS: Record<string, { name: string; icon: string; color: string }> = {
  facebook: { name: 'Facebook', icon: 'facebook', color: '#1877F2' },
  instagram: { name: 'Instagram', icon: 'instagram', color: '#E4405F' },
  tiktok: { name: 'TikTok', icon: 'tiktok', color: '#000000' },
  youtube: { name: 'YouTube', icon: 'youtube', color: '#FF0000' },
  twitter: { name: 'Twitter/X', icon: 'twitter', color: '#1DA1F2' },
  telegram: { name: 'Telegram', icon: 'telegram', color: '#0088CC' },
  whatsapp: { name: 'WhatsApp', icon: 'whatsapp', color: '#25D366' },
  snapchat: { name: 'Snapchat', icon: 'snapchat', color: '#FFFC00' },
  linkedin: { name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
  pinterest: { name: 'Pinterest', icon: 'pinterest', color: '#E60023' },
  custom: { name: 'مخصص', icon: 'custom', color: '#6B7280' }
};

// Helper function to convert WhatsApp number to wa.me link
export const getWhatsAppLink = (number: string): string => {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanNumber}`;
};

// Helper function to get the actual link (handles WhatsApp specially)
export const getActualLink = (link: SocialMediaLink): string => {
  if (link.platform_icon === 'whatsapp' && link.whatsapp_number) {
    return getWhatsAppLink(link.whatsapp_number);
  }
  return link.link_url;
};

export function useSocialMedia() {
  const [links, setLinks] = useState<SocialMediaLink[]>([]);
  const [settings, setSettings] = useState<SocialMediaSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all links
  const fetchLinks = useCallback(async (activeOnly = false) => {
    try {
      setIsLoading(true);
      setError(null);

      let query = db
        .from('social_media_links')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setLinks(data || []);
    } catch (err: any) {
      console.error('Error fetching social media links:', err);
      setError(err.message || 'حدث خطأ أثناء جلب روابط السوشيال ميديا');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error: fetchError } = await db
        .from('social_media_settings')
        .select('*')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (data) {
        setSettings(data);
      } else {
        // Create default settings if none exist
        const { data: newSettings, error: insertError } = await db
          .from('social_media_settings')
          .insert({ icon_shape: 'square' })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      }
    } catch (err: any) {
      console.error('Error fetching social media settings:', err);
      setError(err.message || 'حدث خطأ أثناء جلب الإعدادات');
    }
  }, []);

  // Create a new link
  const createLink = useCallback(async (linkData: CreateSocialMediaLink): Promise<SocialMediaLink | null> => {
    try {
      setError(null);

      // Get max display_order
      const { data: maxOrderData } = await db
        .from('social_media_links')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const newOrder = (maxOrderData?.display_order ?? -1) + 1;

      const { data, error: insertError } = await db
        .from('social_media_links')
        .insert({
          ...linkData,
          display_order: linkData.display_order ?? newOrder
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      setLinks(prev => [...prev, data].sort((a, b) => a.display_order - b.display_order));

      return data;
    } catch (err: any) {
      console.error('Error creating social media link:', err);
      setError(err.message || 'حدث خطأ أثناء إضافة الرابط');
      return null;
    }
  }, []);

  // Update a link
  const updateLink = useCallback(async (id: string, updates: Partial<CreateSocialMediaLink>): Promise<boolean> => {
    try {
      setError(null);

      const { data, error: updateError } = await db
        .from('social_media_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state
      setLinks(prev => prev.map(link => link.id === id ? data : link));

      return true;
    } catch (err: any) {
      console.error('Error updating social media link:', err);
      setError(err.message || 'حدث خطأ أثناء تحديث الرابط');
      return false;
    }
  }, []);

  // Delete a link
  const deleteLink = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await db
        .from('social_media_links')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state
      setLinks(prev => prev.filter(link => link.id !== id));

      return true;
    } catch (err: any) {
      console.error('Error deleting social media link:', err);
      setError(err.message || 'حدث خطأ أثناء حذف الرابط');
      return false;
    }
  }, []);

  // Toggle active status
  const toggleActive = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const link = links.find(l => l.id === id);
      if (!link) throw new Error('الرابط غير موجود');

      const { data, error: updateError } = await db
        .from('social_media_links')
        .update({ is_active: !link.is_active })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state
      setLinks(prev => prev.map(l => l.id === id ? data : l));

      return true;
    } catch (err: any) {
      console.error('Error toggling social media link status:', err);
      setError(err.message || 'حدث خطأ أثناء تغيير حالة الرابط');
      return false;
    }
  }, [links]);

  // Reorder links
  const reorderLinks = useCallback(async (reorderedLinks: SocialMediaLink[]): Promise<boolean> => {
    try {
      setError(null);

      // Update display_order for each link
      const updates = reorderedLinks.map((link, index) => ({
        id: link.id,
        display_order: index
      }));

      // Batch update
      for (const update of updates) {
        const { error: updateError } = await db
          .from('social_media_links')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      // Update local state
      setLinks(reorderedLinks.map((link, index) => ({ ...link, display_order: index })));

      return true;
    } catch (err: any) {
      console.error('Error reordering social media links:', err);
      setError(err.message || 'حدث خطأ أثناء إعادة ترتيب الروابط');
      return false;
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (newSettings: Partial<SocialMediaSettings>): Promise<boolean> => {
    try {
      setError(null);

      if (!settings?.id) {
        throw new Error('الإعدادات غير موجودة');
      }

      const { data, error: updateError } = await db
        .from('social_media_settings')
        .update(newSettings)
        .eq('id', settings.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setSettings(data);

      return true;
    } catch (err: any) {
      console.error('Error updating social media settings:', err);
      setError(err.message || 'حدث خطأ أثناء تحديث الإعدادات');
      return false;
    }
  }, [settings]);

  // Set up realtime subscription for admin
  useEffect(() => {
    // Initial fetch
    fetchLinks();
    fetchSettings();

    // Subscribe to changes
    const linksSubscription = supabase
      .channel('social_media_links_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'elfaroukgroup', table: 'social_media_links' },
        () => {
          fetchLinks();
        }
      )
      .subscribe();

    const settingsSubscription = supabase
      .channel('social_media_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'elfaroukgroup', table: 'social_media_settings' },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      linksSubscription.unsubscribe();
      settingsSubscription.unsubscribe();
    };
  }, [fetchLinks, fetchSettings]);

  return {
    links,
    settings,
    isLoading,
    error,
    fetchLinks,
    fetchSettings,
    createLink,
    updateLink,
    deleteLink,
    toggleActive,
    reorderLinks,
    updateSettings,
    PLATFORM_ICONS,
    getWhatsAppLink,
    getActualLink
  };
}

// Export a hook for fetching active links only (for public pages)
export function useSocialMediaPublic() {
  const [links, setLinks] = useState<SocialMediaLink[]>([]);
  const [settings, setSettings] = useState<SocialMediaSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [linksResponse, settingsResponse] = await Promise.all([
          db
            .from('social_media_links')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true }),
          db
            .from('social_media_settings')
            .select('*')
            .single()
        ]);

        if (linksResponse.data) setLinks(linksResponse.data);
        if (settingsResponse.data) setSettings(settingsResponse.data);
      } catch (err) {
        console.error('Error fetching social media data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return {
    links,
    settings,
    isLoading,
    getActualLink
  };
}
