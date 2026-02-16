import type { Metadata } from 'next'
import { CLIENT_CONFIG } from '@/client.config'

export const metadata: Metadata = {
  title: CLIENT_CONFIG.appName,
  description: CLIENT_CONFIG.description,
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
