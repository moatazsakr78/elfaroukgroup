'use client'

import { createContext, useContext } from 'react'
import type { Brand } from './brand-resolver'

interface BrandContextType {
  brand: Brand | null
  brandId: string | null
  brandSlug: string | null
}

const BrandContext = createContext<BrandContextType>({
  brand: null,
  brandId: null,
  brandSlug: null,
})

interface BrandProviderProps {
  brand: Brand | null
  children: React.ReactNode
}

/**
 * BrandProvider - Wraps app with brand context
 * Brand data is passed from server via props (no extra client query)
 */
export function BrandProvider({ brand, children }: BrandProviderProps) {
  return (
    <BrandContext.Provider
      value={{
        brand,
        brandId: brand?.id || null,
        brandSlug: brand?.slug || null,
      }}
    >
      {children}
    </BrandContext.Provider>
  )
}

/**
 * Hook to get current brand in client components
 */
export function useBrand() {
  return useContext(BrandContext)
}
