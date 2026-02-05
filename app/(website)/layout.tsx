import type { Metadata } from 'next'
import { getCurrentBrand } from '@/lib/brand/get-brand'

export async function generateMetadata(): Promise<Metadata> {
  let brand = null
  try {
    brand = await getCurrentBrand()
  } catch {}

  return {
    title: brand?.name || 'El Farouk Group Store',
    description: brand?.meta_description || 'أفضل المنتجات بأسعار مميزة',
  }
}

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
    </>
  )
}
