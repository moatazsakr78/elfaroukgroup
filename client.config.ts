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
