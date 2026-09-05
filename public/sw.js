// Raymarkable Service Worker
const CACHE_NAME = 'raymarkable-v3';

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache non-fatal warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin or non-GET requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Pass-through for localhost / dev: NEVER cache during local development
  // Ensures hot-reloads and Turbopack work seamlessly while push notifications remain active
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Pass-through for API and Supabase Auth calls (Always live network)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth') || url.hostname.includes('supabase.co')) {
    return;
  }

  // Static Assets (_next/static, icons, images, fonts): Cache First
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML Navigation Pages: Network First, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/dashboard');
          });
        })
    );
    return;
  }
});

// Handle incoming native Web Push events (wakes SW even when tabs/app are closed)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Raymarkable';
  const options = {
    body: data.body || 'You have a new update from your accountability team.',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'raymarkable-nudge',
    renotify: true,
    data: {
      url: data.url || '/dashboard/habits',
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('[SW] Failed to show push notification:', err);
    })
  );
});

// Handle user clicking on a native system notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/habits';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
