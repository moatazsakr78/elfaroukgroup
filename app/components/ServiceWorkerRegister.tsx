'use client'

import { useEffect, useRef } from 'react'
import { initSyncManager, syncPendingSales } from '@/app/lib/offline/syncManager'

export default function ServiceWorkerRegister() {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope)

          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
        })
        .catch((error) => {
          console.warn('Service Worker registration failed:', error)
        })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_OFFLINE_SALES') {
          console.log('Received sync message from Service Worker')
          syncPendingSales()
        }
      })
    }

    // Initialize sync manager
    cleanupRef.current = initSyncManager()

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return null
}
