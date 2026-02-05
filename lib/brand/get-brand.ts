/**
 * Server-side brand helper
 * Uses headers().get('x-brand-id') set by middleware
 * Uses React cache() for request deduplication
 */

import { headers } from 'next/headers'
import { cache } from 'react'
import { getDefaultBrand, getBrandBySlug, type Brand } from './brand-resolver'

/**
 * Get brand ID from request headers (set by middleware)
 * Cached per request using React cache()
 */
export const getBrandId = cache((): string | null => {
  try {
    const headersList = headers()
    return headersList.get('x-brand-id') || null
  } catch {
    return null
  }
})

/**
 * Get brand slug from request headers (set by middleware)
 */
export const getBrandSlug = cache((): string | null => {
  try {
    const headersList = headers()
    return headersList.get('x-brand-slug') || null
  } catch {
    return null
  }
})

/**
 * Get full brand object for the current request
 * Falls back to default brand if no brand header is set
 */
export const getCurrentBrand = cache(async (): Promise<Brand> => {
  const slug = getBrandSlug()

  if (slug) {
    const brand = await getBrandBySlug(slug)
    if (brand) return brand
  }

  return getDefaultBrand()
})
