const CACHE_NAME = 'financial-advisor-v1';
const urlsToCache = ['/'];

// Install event
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log('[Service Worker] Cache opened');
			return cache.addAll(urlsToCache);
		}),
	);
});

// Fetch event
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip Firebase and external API calls
	if (event.request.url.includes('firebaseio.com') || event.request.url.includes('googleapis.com')) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((response) => {
			return (
				response ||
				fetch(event.request).then((response) => {
					// Don't cache non-successful responses
					if (!response || response.status !== 200 || response.type === 'error') {
						return response;
					}

					// Clone the response
					const responseToCache = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});

					return response;
				})
			);
		}),
	);
});

// Check for updates
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						console.log('[Service Worker] Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				}),
			);
		}),
	);
});
