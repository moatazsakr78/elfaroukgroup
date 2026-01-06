import { Metadata } from 'next';
import Link from 'next/link';
import SocialMediaGrid from '@/components/website/SocialMediaGrid';
import { getSocialMediaData } from '@/lib/data/socialMedia';
import { getStoreTheme } from '@/lib/data/products';

/**
 * Social Media Page - Server Component with Static Generation + ISR
 *
 * Performance Strategy:
 * - Static Generation: Pre-renders at build time
 * - ISR: Revalidates every 60 seconds
 * - CDN-friendly: Can be cached on edge for fast delivery
 */

export const metadata: Metadata = {
  title: 'تابعنا | Social Media',
  description: 'تابعنا على منصات التواصل الاجتماعي',
};

// Enable ISR - revalidate every 60 seconds
export const revalidate = 60;

// Enable static generation
export const dynamic = 'force-static';

export default async function SocialMediaPage() {
  // Fetch data on the server
  const [socialMediaData, theme] = await Promise.all([
    getSocialMediaData(),
    getStoreTheme()
  ]);

  const { links, settings } = socialMediaData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="sticky top-0 z-50 shadow-md"
        style={{ backgroundColor: theme?.primary_color || '#5d1f1f' }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <Link
              href="/"
              className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
            >
              <svg
                className="w-6 h-6 rtl:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-semibold">العودة</span>
            </Link>

            {/* Title */}
            <h1 className="text-xl font-bold text-white">
              تابعنا
            </h1>

            {/* Spacer for centering */}
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Title Section */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            تابعنا على السوشيال ميديا
          </h2>
          <p className="text-gray-600">
            ابق على تواصل معنا عبر منصات التواصل الاجتماعي
          </p>
        </div>

        {/* Social Media Grid */}
        <div className="max-w-4xl mx-auto">
          <SocialMediaGrid
            links={links}
            iconShape={settings.icon_shape}
            className="px-4"
          />
        </div>

        {/* Empty State */}
        {links.length === 0 && (
          <div className="text-center py-16">
            <div className="mb-4">
              <svg
                className="w-20 h-20 mx-auto text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              لا توجد حسابات حالياً
            </h3>
            <p className="text-gray-500">
              سيتم إضافة حسابات التواصل الاجتماعي قريباً
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} El Farouk Group</p>
      </footer>
    </div>
  );
}
