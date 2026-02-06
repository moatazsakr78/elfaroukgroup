/**
 * Brand Resolver - Resolves brand from hostname
 * Used by middleware, server components, and API routes
 * In-memory cache with 5-min TTL for performance
 *
 * Edge Runtime safe: uses direct fetch() as PRIMARY method
 * Falls back to Supabase client, then hardcoded brand map
 */

import { createClient } from '@supabase/supabase-js'

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

// Hardcoded brand map - emergency fallback if ALL database calls fail
const KNOWN_BRANDS: Record<string, Brand> = {
  'lurana.online': {
    id: '421e1dda-a118-4274-ade1-def5659ececd',
    slug: 'lurana',
    name: 'LURANA',
    name_ar: 'لورانا',
    description: 'متجر لورانا - أفضل المنتجات المنزلية',
    logo_url: '/assets/logo/lurana.png',
    favicon_url: null,
    domain: 'lurana.online',
    custom_domains: [],
    theme_color: '#D4A843',
    background_color: '#111827',
    primary_color: '#D4A843',
    default_currency: 'ريال',
    website_currency: 'جنيه',
    settings: {},
    meta_title: 'LURANA',
    meta_description: 'متجر لورانا - أفضل المنتجات المنزلية',
    is_active: true,
    is_default: false,
  },
  'elfaroukgroup.online': {
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
  },
}

// In-memory cache
const brandCache = new Map<string, { brand: Brand; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let defaultBrandCache: { brand: Brand; timestamp: number } | null = null

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

function createServerSupabase() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    console.error('[BrandResolver] Missing Supabase env vars:', { hasUrl: !!url, hasKey: !!key })
    throw new Error('Missing Supabase environment variables')
  }

  try {
    return createClient(url, key, {
      db: { schema: 'elfaroukgroup' },
      auth: { persistSession: false },
    })
  } catch (e) {
    console.error('[BrandResolver] Failed to create Supabase client:', e)
    throw e
  }
}

/**
 * Direct fetch to PostgREST API - Edge Runtime safe (PRIMARY method)
 * Uses native fetch() which works reliably in all runtimes
 */
async function fetchBrandsDirectly(filter?: { column: string; value: string }): Promise<Brand[]> {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    console.error('[BrandResolver:fetch] Missing env vars')
    return []
  }

  let endpoint = `${url}/rest/v1/brands?select=*&is_active=eq.true`
  if (filter) {
    endpoint += `&${filter.column}=eq.${encodeURIComponent(filter.value)}`
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
        'Accept-Profile': 'elfaroukgroup',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[BrandResolver:fetch] PostgREST error:', response.status, text)
      return []
    }

    const data = await response.json()
    return (data || []) as Brand[]
  } catch (e) {
    console.error('[BrandResolver:fetch] Network error:', e)
    return []
  }
}

/**
 * Resolve brand from hostname
 * Strategy order:
 *   1. Cache hit
 *   2. Direct fetch() to PostgREST (Edge-safe, primary)
 *   3. Supabase JS client (fallback)
 *   4. Hardcoded KNOWN_BRANDS map (emergency fallback)
 *   5. getDefaultBrand()
 */
export async function resolveBrandFromHostname(hostname: string): Promise<Brand> {
  // Strip port number
  const cleanHost = hostname.split(':')[0].toLowerCase()

  // Check cache first
  const cached = brandCache.get(cleanHost)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.brand
  }

  console.log('[BrandResolver] Resolving brand for hostname:', cleanHost)

  let brandByDomain: Brand | null = null

  // Strategy 1: Direct fetch() to PostgREST (primary, Edge-safe)
  try {
    const brands = await fetchBrandsDirectly({ column: 'domain', value: cleanHost })
    if (brands.length > 0) {
      brandByDomain = brands[0]
      console.log('[BrandResolver] Direct fetch found brand by domain:', brandByDomain.slug)
    }
  } catch (e) {
    console.warn('[BrandResolver] Direct fetch failed for domain:', e instanceof Error ? e.message : e)
  }

  // Strategy 2: If direct fetch didn't find it, try Supabase client
  if (!brandByDomain) {
    try {
      const supabase = createServerSupabase()
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('domain', cleanHost)
        .eq('is_active', true)
        .single()

      if (data) {
        brandByDomain = data as Brand
        console.log('[BrandResolver] Supabase client found brand by domain:', brandByDomain.slug)
      } else if (error && error.code !== 'PGRST116') {
        console.warn('[BrandResolver] Supabase client query error:', error.message)
      }
    } catch (e) {
      console.warn('[BrandResolver] Supabase client failed:', e instanceof Error ? e.message : e)
    }
  }

  if (brandByDomain) {
    brandCache.set(cleanHost, { brand: brandByDomain, timestamp: Date.now() })
    return brandByDomain
  }

  // Try matching by custom_domains array
  let allBrands: Brand[] = []

  // Try direct fetch first for all brands
  allBrands = await fetchBrandsDirectly()

  // If direct fetch returned nothing, try Supabase client
  if (allBrands.length === 0) {
    try {
      const supabase = createServerSupabase()
      const { data } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true)

      allBrands = (data || []) as Brand[]
    } catch (e) {
      console.warn('[BrandResolver] Supabase client failed for allBrands:', e instanceof Error ? e.message : e)
    }
  }

  for (const b of allBrands) {
    const customDomains: string[] = b.custom_domains || []
    if (customDomains.some((d: string) => d.toLowerCase() === cleanHost)) {
      console.log('[BrandResolver] Found brand by custom_domain:', b.slug)
      brandCache.set(cleanHost, { brand: b, timestamp: Date.now() })
      return b
    }
  }

  // Strategy 3: Hardcoded brand map (emergency fallback)
  const knownBrand = KNOWN_BRANDS[cleanHost]
  if (knownBrand) {
    console.log('[BrandResolver] Using hardcoded brand for', cleanHost, ':', knownBrand.slug)
    brandCache.set(cleanHost, { brand: knownBrand, timestamp: Date.now() })
    return knownBrand
  }

  // Final fallback to default brand
  console.log('[BrandResolver] No brand match for', cleanHost, '- falling back to default')
  return getDefaultBrand()
}

/**
 * Get the default brand (is_default = true)
 */
export async function getDefaultBrand(): Promise<Brand> {
  if (defaultBrandCache && Date.now() - defaultBrandCache.timestamp < CACHE_TTL) {
    return defaultBrandCache.brand
  }

  // Try direct fetch first (Edge-safe)
  const brands = await fetchBrandsDirectly({ column: 'is_default', value: 'true' })
  if (brands.length > 0) {
    const brand = brands[0]
    defaultBrandCache = { brand, timestamp: Date.now() }
    return brand
  }

  // Fallback to Supabase client
  try {
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
  } catch (e) {
    console.warn('[BrandResolver] Supabase client failed for default brand:', e instanceof Error ? e.message : e)
  }

  // Ultimate fallback - hardcoded default
  return KNOWN_BRANDS['elfaroukgroup.online']
}

/**
 * Get brand by slug
 */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const cached = brandCache.get(`slug:${slug}`)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.brand
  }

  // Try direct fetch first (Edge-safe)
  const brands = await fetchBrandsDirectly({ column: 'slug', value: slug })
  if (brands.length > 0) {
    const brand = brands[0]
    brandCache.set(`slug:${slug}`, { brand, timestamp: Date.now() })
    return brand
  }

  // Fallback to Supabase client
  try {
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
  } catch (e) {
    console.warn('[BrandResolver] getBrandBySlug client failed:', e instanceof Error ? e.message : e)
  }

  // Check hardcoded brands by slug
  for (const brand of Object.values(KNOWN_BRANDS)) {
    if (brand.slug === slug) {
      brandCache.set(`slug:${slug}`, { brand, timestamp: Date.now() })
      return brand
    }
  }

  return null
}

/**
 * Get all active brands (for generateStaticParams)
 */
export async function getAllActiveBrands(): Promise<Brand[]> {
  // Try direct fetch first (Edge-safe)
  const brands = await fetchBrandsDirectly()
  if (brands.length > 0) return brands

  // Fallback to Supabase client
  try {
    const supabase = createServerSupabase()
    const { data } = await supabase
      .from('brands')
      .select('*')
      .eq('is_active', true)

    if (data && data.length > 0) return data as Brand[]
  } catch (e) {
    console.warn('[BrandResolver] getAllActiveBrands client failed:', e instanceof Error ? e.message : e)
  }

  // Hardcoded fallback
  return Object.values(KNOWN_BRANDS)
}

/**
 * Clear brand cache (call after brand updates)
 */
export function clearBrandCache() {
  brandCache.clear()
  defaultBrandCache = null
}
