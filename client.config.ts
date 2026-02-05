// Client-specific configuration - DO NOT commit this file
// Copy from client.config.example.ts and customize for each client

export const CLIENT_CONFIG = {
  // Database Schema
  schema: 'elfaroukgroup' as const,
  supabaseProjectId: 'hecedrbnbknohssgaoso',

  // Branding
  appName: 'El Farouk Group Store',
  shortName: 'elfaroukgroup',
  companyName: 'El Farouk Group',
  description: 'متجرك المتكامل للحصول على أفضل المنتجات بأسعار مميزة وجودة عالية',

  // Theme Colors
  themeColor: '#DC2626',
  backgroundColor: '#111827',
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',

  // Logo
  logoPath: '/assets/logo/El Farouk Group2.png',

  // Currency
  defaultCurrency: 'ريال',
  websiteCurrency: 'جنيه',

  // Language
  lang: 'ar',
  dir: 'rtl' as const,
}

export type SchemaName = typeof CLIENT_CONFIG.schema

/**
 * Get brand-specific config for store pages
 * Falls back to CLIENT_CONFIG defaults
 */
export function getBrandConfig(brand: {
  name?: string | null
  name_ar?: string | null
  description?: string | null
  logo_url?: string | null
  theme_color?: string | null
  background_color?: string | null
  primary_color?: string | null
  default_currency?: string | null
  website_currency?: string | null
} | null) {
  if (!brand) return CLIENT_CONFIG

  return {
    ...CLIENT_CONFIG,
    appName: brand.name || CLIENT_CONFIG.appName,
    companyName: brand.name_ar || brand.name || CLIENT_CONFIG.companyName,
    description: brand.description || CLIENT_CONFIG.description,
    logoPath: brand.logo_url || CLIENT_CONFIG.logoPath,
    themeColor: brand.theme_color || CLIENT_CONFIG.themeColor,
    backgroundColor: brand.background_color || CLIENT_CONFIG.backgroundColor,
    primaryColor: brand.primary_color || CLIENT_CONFIG.primaryColor,
    defaultCurrency: brand.default_currency || CLIENT_CONFIG.defaultCurrency,
    websiteCurrency: brand.website_currency || CLIENT_CONFIG.websiteCurrency,
  }
}
