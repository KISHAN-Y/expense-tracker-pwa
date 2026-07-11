const CACHE_NAME = 'expense-tracker-v35';
const urlsToCache = [
    './',
    './index.html',
    './styles/main.css',
    './scripts/config.js',
    './scripts/utils.js',
    './scripts/db.js',
    './scripts/api.js',
    './scripts/ui.js',
    './scripts/app.js',
    './reconcile.js',
    './manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Cache error:', error);
            })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip cross-origin requests
    if (!request.url.startsWith(self.location.origin) &&
        !request.url.includes('script.google.com')) {
        return;
    }

    // API requests - Network first strategy
    if (request.url.includes('script.google.com')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached response if offline
                    return caches.match(request).then((response) => {
                        return response || new Response('Offline - Data not cached', { status: 503 });
                    });
                })
        );
        return;
    }

    // App shell - Cache first strategy
    event.respondWith(
        caches.match(request, { ignoreSearch: true })
            .then((response) => {
                if (response) {
                    return response;
                }

                return fetch(request).then((response) => {
                    // Cache new resources
                    if (response && response.status === 200 && response.type !== 'error') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                });
            })
            .catch(() => {
                // Return offline page if available
                return caches.match('./index.html');
            })
    );
});

// Background Sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-transactions') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SYNC_TRANSACTIONS'
                    });
                });
            })
        );
    }
});

// Push notifications (optional)
self.addEventListener('push', (event) => {
    if (!event.data) {
        return;
    }

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/assets/icon-192.svg',
        badge: '/assets/icon-192.svg',
        tag: data.tag || 'expense-tracker',
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification('Expense Tracker', options)
    );
});

// Handle system notification messages (Screen ON or OFF)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const title = event.data.title || 'Expense Tracker 💰';
        const options = {
            body: event.data.body || 'Time to add your recent income & expenses!',
            icon: 'assets/icon-192.svg',
            badge: 'assets/icon-192.svg',
            vibrate: [200, 100, 200],
            tag: event.data.tag || '3hour-reminder',
            requireInteraction: false
        };
        event.waitUntil(self.registration.showNotification(title, options));
    }
});

// Handle notifications click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes('localhost') || client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

