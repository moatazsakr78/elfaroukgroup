// Custom Service Worker Extensions
// This file is merged with the generated service worker by next-pwa

// Background sync for offline sales
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);

  if (event.tag === 'sync-offline-sales') {
    event.waitUntil(syncOfflineSales());
  }
});

async function syncOfflineSales() {
  try {
    // Notify all clients to perform sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_OFFLINE_SALES',
        timestamp: Date.now()
      });
    });
    console.log('Service Worker: Notified clients to sync');
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    // Allow caching specific URLs on demand
    const urls = event.data.urls;
    if (urls && urls.length > 0) {
      caches.open('runtime-cache').then(cache => {
        cache.addAll(urls).catch(err => {
          console.warn('Failed to cache URLs:', err);
        });
      });
    }
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received');

  let data = { title: 'نظام نقاط البيع', body: 'إشعار جديد' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/assets/logo/El Farouk Group2.png',
    badge: '/assets/logo/El Farouk Group2.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing window or open new one
      for (const client of clientList) {
        if (client.url.includes('/pos') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/pos');
      }
    })
  );
});

console.log('Custom Service Worker Extensions loaded');
