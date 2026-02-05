/**
 * Brand Resolver - Resolves brand from hostname
 * Used by middleware, server components, and API routes
 * In-memory cache with 5-min TTL for performance
 */

import { createClient } from '@supabase/supabase-js'
import { CLIENT_CONFIG } from '@/client.config'

export interface Brand {
  id: string
  slug: string
  name: string
  name_ar: string | null
  description: string | null
  logo_url: string | null
  favicon_url: string | null
  domain: string | null
  custom_domains: string[]
  theme_color: string
  background_color: string
  primary_color: string
  default_currency: string
  website_currency: string
  settings: Record<string, any>
  meta_title: string | null
  meta_description: string | null
  is_active: boolean
  is_default: boolean
}

// In-memory cache
const brandCache = new Map<string, { brand: Brand; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let defaultBrandCache: { brand: Brand; timestamp: number } | null = null

function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: CLIENT_CONFIG.schema },
      auth: { persistSession: false },
    }
  )
}

/**
 * Resolve brand from hostname
 * Checks domain and custom_domains fields
 * Falls back to default brand if no match
 */
export async function resolveBrandFromHostname(hostname: string): Promise<Brand> {
  // Strip port number
  const cleanHost = hostname.split(':')[0].toLowerCase()

  // Check cache first
  const cached = brandCache.get(cleanHost)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.brand
  }

  const supabase = createServerSupabase()

  // Try matching by primary domain
  const { data: brandByDomain } = await supabase
    .from('brands')
    .select('*')
    .eq('domain', cleanHost)
    .eq('is_active', true)
    .single()

  if (brandByDomain) {
    const brand = brandByDomain as Brand
    brandCache.set(cleanHost, { brand, timestamp: Date.now() })
    return brand
  }

  // Try matching by custom_domains array
  const { data: allBrands } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)

  if (allBrands) {
    for (const b of allBrands) {
      const customDomains: string[] = b.custom_domains || []
      if (customDomains.some((d: string) => d.toLowerCase() === cleanHost)) {
        const brand = b as Brand
        brandCache.set(cleanHost, { brand, timestamp: Date.now() })
        return brand
      }
    }
  }

  // Fallback to default brand
  return getDefaultBrand()
}

/**
 * Get the default brand (is_default = true)
 */
export async function getDefaultBrand(): Promise<Brand> {
  if (defaultBrandCache && Date.now() - defaultBrandCache.timestamp < CACHE_TTL) {
    return defaultBrandCache.brand
  }

  const supabase = createServerSupabase()

  const { data } = await supabase
    .from('brands')
    .select('*')
    .eq('is_default', true)
    .single()

  if (data) {
    const brand = data as Brand
    defaultBrandCache = { brand, timestamp: Date.now() }
    return brand
  }

  // Ultimate fallback - hardcoded default
  return {
    id: '32e7a666-ff33-4418-aacd-a460e7c459fe',
    slug: 'elfaroukgroup',
    name: 'El Farouk Group Store',
    name_ar: 'مجموعة الفاروق',
    description: null,
    logo_url: '/icons/icon-192x192.png',
    favicon_url: null,
    domain: 'elfaroukgroup.online',
    custom_domains: [],
    theme_color: '#DC2626',
    background_color: '#111827',
    primary_color: '#3B82F6',
    default_currency: 'ريال',
    website_currency: 'جنيه',
    settings: {},
    meta_title: 'El Farouk Group Store',
    meta_description: 'متجر مجموعة الفاروق',
    is_active: true,
    is_default: true,
  }
}

/**
 * Get brand by slug
 */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const cached = brandCache.get(`slug:${slug}`)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.brand
  }

  const supabase = createServerSupabase()

  const { data } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (data) {
    const brand = data as Brand
    brandCache.set(`slug:${slug}`, { brand, timestamp: Date.now() })
    return brand
  }

  return null
}

/**
 * Get all active brands (for generateStaticParams)
 */
export async function getAllActiveBrands(): Promise<Brand[]> {
  const supabase = createServerSupabase()

  const { data } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)

  return (data as Brand[]) || []
}

/**
 * Clear brand cache (call after brand updates)
 */
export function clearBrandCache() {
  brandCache.clear()
  defaultBrandCache = null
}
