import ClientHomePage from '@/components/website/ClientHomePage';
import {
  getWebsiteProducts,
  getStoreCategoriesWithProducts,
  getCustomSections,
  getCompanySettings,
  getStoreTheme,
  getProductDisplaySettings
} from '@/lib/data/products';

/**
 * Home Page - Server Component with Static Generation + ISR
 *
 * Performance Strategy:
 * - Static Generation: Pre-renders at build time
 * - ISR (Incremental Static Regeneration): Revalidates every 30 seconds
 * - CDN-friendly: Can be cached on edge for fast delivery
 * - Dynamic data (cart, stock) fetched client-side
 *
 * This approach serves 1000s of users with minimal database load!
 */

// Enable ISR with optimal cache + on-demand revalidation
// ✨ Perfect balance: Updates every 60 seconds + instant updates via revalidation API
// Result: Fresh stock data + minimal database load!
export const revalidate = 60; // 1 minute

// Enable static generation
export const dynamic = 'force-static';

export default async function HomePage() {
  // Fetch all data on the server (runs at build time + every 5 minutes)
  // These queries run ONCE and serve thousands of users!
  const [
    products,
    categories,
    sections,
    settings,
    theme,
    displaySettings
  ] = await Promise.all([
    getWebsiteProducts(),
    getStoreCategoriesWithProducts(),
    getCustomSections(),
    getCompanySettings(),
    getStoreTheme(),
    getProductDisplaySettings()
  ]);

  // Pass pre-fetched data to client component
  // The client component handles device detection and cart management
  // UI remains exactly the same!
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
  );
}
