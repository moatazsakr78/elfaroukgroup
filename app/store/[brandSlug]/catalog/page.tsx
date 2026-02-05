import { getCatalogProducts, getCatalogCategories } from '@/lib/data/products'
import CatalogView from '@/app/(website)/catalog/CatalogView'
import { getAllActiveBrands, getBrandBySlug } from '@/lib/brand/brand-resolver'

/**
 * Brand-specific Catalog Page - Server Component with Static Generation + ISR
 */

export const revalidate = 3600

export const dynamicParams = true

export async function generateStaticParams() {
  const brands = await getAllActiveBrands()
  return brands.map((brand) => ({
    brandSlug: brand.slug,
  }))
}

export default async function BrandCatalogPage({
  params,
}: {
  params: { brandSlug: string }
}) {
  const brand = await getBrandBySlug(params.brandSlug)

  // Fetch products and categories
  const [products, categories] = await Promise.all([
    getCatalogProducts(),
    getCatalogCategories(),
  ])

  return (
    <CatalogView
      initialProducts={products}
      categories={categories}
    />
  )
}
