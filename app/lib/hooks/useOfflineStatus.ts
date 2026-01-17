'use client'

import { useState, useEffect, useCallback } from 'react'
import { getPendingSalesCountByStatus, hasOfflineData } from '../offline/db'

export interface OfflineStatusState {
  isOnline: boolean
  isOfflineReady: boolean
  pendingSalesCount: number
  lastOnlineAt: Date | null
  connectionQuality: 'good' | 'slow' | 'offline'
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatusState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOfflineReady: false,
    pendingSalesCount: 0,
    lastOnlineAt: null,
    connectionQuality: 'good'
  })

  // Check pending sales count
  const updatePendingSalesCount = useCallback(async () => {
    try {
      const count = await getPendingSalesCountByStatus('pending')
      setStatus(prev => ({ ...prev, pendingSalesCount: count }))
    } catch (error) {
      console.warn('Failed to get pending sales count:', error)
    }
  }, [])

  // Check if offline data is ready
  const checkOfflineReady = useCallback(async () => {
    try {
      const ready = await hasOfflineData()
      setStatus(prev => ({ ...prev, isOfflineReady: ready }))
    } catch (error) {
      console.warn('Failed to check offline data:', error)
    }
  }, [])

  // Test connection quality
  const testConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus(prev => ({ ...prev, connectionQuality: 'offline' }))
      return
    }

    try {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      await fetch('/api/ping', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const latency = Date.now() - start

      setStatus(prev => ({
        ...prev,
        connectionQuality: latency < 1000 ? 'good' : 'slow'
      }))
    } catch (error) {
      // If fetch fails but we're "online", connection is slow/unreliable
      setStatus(prev => ({
        ...prev,
        connectionQuality: navigator.onLine ? 'slow' : 'offline'
      }))
    }
  }, [])

  // Handle online event
  const handleOnline = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: true,
      lastOnlineAt: new Date(),
      connectionQuality: 'good'
    }))
    // Trigger connection quality test
    testConnectionQuality()
  }, [testConnectionQuality])

  // Handle offline event
  const handleOffline = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: false,
      connectionQuality: 'offline'
    }))
  }, [])

  useEffect(() => {
    // Initial setup
    checkOfflineReady()
    updatePendingSalesCount()

    if (navigator.onLine) {
      setStatus(prev => ({ ...prev, lastOnlineAt: new Date() }))
      testConnectionQuality()
    }

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic checks
    const intervalId = setInterval(() => {
      updatePendingSalesCount()
      if (navigator.onLine) {
        testConnectionQuality()
      }
    }, 30000) // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [handleOnline, handleOffline, checkOfflineReady, updatePendingSalesCount, testConnectionQuality])

  // Force refresh pending count (can be called externally)
  const refreshPendingCount = useCallback(() => {
    updatePendingSalesCount()
  }, [updatePendingSalesCount])

  return {
    ...status,
    refreshPendingCount
  }
}

export default useOfflineStatus
