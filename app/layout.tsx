import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import TopHeader from './components/layout/TopHeader'
import ServiceWorkerRegister from './components/ServiceWorkerRegister'
import { CurrencyProvider } from '@/lib/hooks/useCurrency'
import { SystemSettingsProvider } from '@/lib/hooks/useSystemSettings'
import { CartProvider } from '@/lib/contexts/CartContext'
import { UserProfileProvider } from '@/lib/contexts/UserProfileContext'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import { PermissionsProvider } from '@/lib/contexts/PermissionsContext'
import { Providers } from './providers'
import { CLIENT_CONFIG } from '@/client.config'

export const metadata: Metadata = {
  title: CLIENT_CONFIG.appName,
  description: CLIENT_CONFIG.description,
  applicationName: CLIENT_CONFIG.shortName,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: CLIENT_CONFIG.shortName,
  },
  manifest: '/manifest.json',
  icons: {
    icon: CLIENT_CONFIG.logoPath,
    apple: CLIENT_CONFIG.logoPath,
  },
  other: {
    'theme-color': CLIENT_CONFIG.themeColor,
    'msapplication-navbutton-color': CLIENT_CONFIG.themeColor,
    'msapplication-TileColor': CLIENT_CONFIG.themeColor,
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-arabic bg-[#1F2937] text-gray-800">
        <Providers>
          <ThemeProvider>
            <SystemSettingsProvider>
              <CurrencyProvider>
                <UserProfileProvider>
                  <PermissionsProvider>
                    <CartProvider>
                      <ServiceWorkerRegister />
                      <TopHeader />
                      {children}
                    </CartProvider>
                  </PermissionsProvider>
                </UserProfileProvider>
              </CurrencyProvider>
            </SystemSettingsProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}