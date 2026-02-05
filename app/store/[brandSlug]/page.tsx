import ClientHomePage from '@/components/website/ClientHomePage'
import {
  getWebsiteProducts,
  getStoreCategoriesWithProducts,
  getCustomSections,
  getCompanySettings,
  getStoreTheme,
  getProductDisplaySettings
} from '@/lib/data/products'
import { getAllActiveBrands, getBrandBySlug } from '@/lib/brand/brand-resolver'

/**
 * Brand-specific Home Page - Server Component with Static Generation + ISR
 *
 * Each brand gets its own statically generated homepage.
 * Middleware rewrites / -> /store/[brandSlug] based on hostname.
 */

// Enable ISR - revalidate every hour per brand
export const revalidate = 3600

// Allow new brands without rebuild
export const dynamicParams = true

// Generate static pages for all active brands at build time
export async function generateStaticParams() {
  const brands = await getAllActiveBrands()
  return brands.map((brand) => ({
    brandSlug: brand.slug,
  }))
}

export default async function BrandHomePage({
  params,
}: {
  params: { brandSlug: string }
}) {
  const brand = await getBrandBySlug(params.brandSlug)
  const brandId = brand?.id || null

  // Fetch all data on the server, passing brandId for filtering
  const [
    products,
    categories,
    sections,
    settings,
    theme,
    displaySettings
  ] = await Promise.all([
    getWebsiteProducts(brandId),
    getStoreCategoriesWithProducts(brandId),
    getCustomSections(brandId),
    getCompanySettings(brandId),
    getStoreTheme(brandId),
    getProductDisplaySettings()
  ])

  return (
    <ClientHomePage
      initialProducts={products}
      initialCategories={categories}
      initialSections={sections}
      initialSettings={{
        company: settings,
        theme,
        display: displaySettings
      }}
    />
  )
}
