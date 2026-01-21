'use client'

import React, { useEffect, useRef, useCallback } from 'react'

export interface UseScrollDetectionOptions {
  onLoadMore: () => void
  enabled?: boolean
  isLoading?: boolean
  threshold?: number // pixels from bottom to trigger (default: 200)
  debounceMs?: number // debounce time in ms (default: 100)
}

export interface UseScrollDetectionReturn {
  sentinelRef: React.RefObject<HTMLDivElement>
}

/**
 * Hook for detecting when user scrolls to the bottom of a container.
 * Uses IntersectionObserver for efficient detection.
 *
 * Usage:
 * ```tsx
 * const { sentinelRef } = useScrollDetection({
 *   onLoadMore: loadMore,
 *   enabled: hasMore && !isLoadingMore,
 *   isLoading: isLoadingMore
 * })
 *
 * return (
 *   <div className="overflow-auto">
 *     {items.map(item => <div key={item.id}>{item.name}</div>)}
 *     <div ref={sentinelRef} /> {/* Sentinel element at the bottom *\/
 *   </div>
 * )
 * ```
 */
export function useScrollDetection(
  options: UseScrollDetectionOptions
): UseScrollDetectionReturn {
  const {
    onLoadMore,
    enabled = true,
    isLoading = false,
    threshold = 200,
    debounceMs = 100
  } = options

  const sentinelRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallRef = useRef<number>(0)

  // Debounced load more function
  const debouncedLoadMore = useCallback(() => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallRef.current

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // If enough time has passed, call immediately
    if (timeSinceLastCall >= debounceMs) {
      lastCallRef.current = now
      onLoadMore()
    } else {
      // Otherwise, schedule a delayed call
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now()
        onLoadMore()
      }, debounceMs - timeSinceLastCall)
    }
  }, [onLoadMore, debounceMs])

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !enabled || isLoading) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && enabled && !isLoading) {
          debouncedLoadMore()
        }
      },
      {
        // Root margin extends the detection area
        // Positive value means trigger before the sentinel is actually visible
        rootMargin: `${threshold}px`,
        threshold: 0
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, isLoading, threshold, debouncedLoadMore])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    sentinelRef
  }
}

export default useScrollDetection
