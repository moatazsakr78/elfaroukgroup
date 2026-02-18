'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import { EditOrderProvider } from '@/lib/contexts/EditOrderContext'
import { FavoritesProvider } from '@/lib/contexts/FavoritesContext'
import { CurrentBranchProvider } from '@/lib/contexts/CurrentBranchContext'
import { AutoSelectInputProvider } from './components/AutoSelectInputProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  // Unregister service workers in development to prevent stale cached JS
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister())
      })
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
    }
  }, [])

  return (
    <SessionProvider>
      <FavoritesProvider>
        <CurrentBranchProvider>
          <EditOrderProvider>
            <AutoSelectInputProvider>
              {children}
            </AutoSelectInputProvider>
          </EditOrderProvider>
        </CurrentBranchProvider>
      </FavoritesProvider>
    </SessionProvider>
  )
}
