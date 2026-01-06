/**
 * Server-side data fetching functions for social media
 * These functions run on the server and support Static Generation & ISR
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a server-side Supabase client for social media tables
// Note: Using untyped client since these tables are new and not in generated types yet
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'elfaroukgroup'
  },
  auth: {
    persistSession: false,
  },
});

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

/**
 * Get all active social media links
 * Supports Static Generation with ISR
 */
export async function getSocialMediaLinks(): Promise<SocialMediaLink[]> {
  try {
    const { data, error } = await supabase
      .from('social_media_links')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching social media links:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getSocialMediaLinks:', err);
    return [];
  }
}

/**
 * Get social media display settings
 */
export async function getSocialMediaSettings(): Promise<SocialMediaSettings | null> {
  try {
    const { data, error } = await supabase
      .from('social_media_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching social media settings:', error);
      // Return default settings if no settings found
      return {
        id: '',
        icon_shape: 'square',
        updated_at: new Date().toISOString()
      };
    }

    return data;
  } catch (err) {
    console.error('Error in getSocialMediaSettings:', err);
    return {
      id: '',
      icon_shape: 'square',
      updated_at: new Date().toISOString()
    };
  }
}

/**
 * Get both social media links and settings
 * Optimized for single page load
 */
export async function getSocialMediaData(): Promise<{
  links: SocialMediaLink[];
  settings: SocialMediaSettings;
}> {
  const [links, settings] = await Promise.all([
    getSocialMediaLinks(),
    getSocialMediaSettings()
  ]);

  return {
    links,
    settings: settings || { id: '', icon_shape: 'square', updated_at: new Date().toISOString() }
  };
}

/**
 * Helper function to convert WhatsApp number to wa.me link
 */
export function getWhatsAppLink(number: string): string {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanNumber}`;
}

/**
 * Helper function to get the actual link URL
 * Handles WhatsApp numbers specially
 */
export function getActualLink(link: SocialMediaLink): string {
  if (link.platform_icon === 'whatsapp' && link.whatsapp_number) {
    return getWhatsAppLink(link.whatsapp_number);
  }
  return link.link_url;
}
