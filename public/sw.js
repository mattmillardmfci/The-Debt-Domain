const CACHE_NAME = "financial-advisor-v1";
const urlsToCache = ["/"];

// Store version to detect updates
let currentVersion = null;

// Install event
self.addEventListener("install", (event) => {
	console.log("[Service Worker] Installing...");
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log("[Service Worker] Cache opened");
			return cache.addAll(urlsToCache);
		}),
	);
	// Force immediate activation
	self.skipWaiting();
});

// Fetch event - Network first for API calls, cache first for assets
self.addEventListener("fetch", (event) => {
	// Skip non-GET requests
	if (event.request.method !== "GET") {
		return;
	}

	// Skip Firebase and external API calls - always network first
	if (event.request.url.includes("firebaseio.com") || event.request.url.includes("googleapis.com")) {
		return;
	}

	// For HTML pages, use network first to detect updates
	if (event.request.mode === "navigate") {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Check version on each page load
					if (response && response.status === 200) {
						checkForUpdates();
					}
					// Always cache successful responses
					const responseToCache = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});
					return response;
				})
				.catch(() => {
					// Fall back to cache if offline
					return caches.match(event.request);
				}),
		);
	} else {
		// For non-HTML resources, use cache first
		event.respondWith(
			caches.match(event.request).then((response) => {
				return (
					response ||
					fetch(event.request).then((response) => {
						if (!response || response.status !== 200 || response.type === "error") {
							return response;
						}
						const responseToCache = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(event.request, responseToCache);
						});
						return response;
					})
				);
			}),
		);
	}
});

// Check for updates by fetching a version file
async function checkForUpdates() {
	try {
		const response = await fetch("/_version.json?t=" + Date.now(), {
			cache: "no-store",
		});
		if (response.ok) {
			const data = await response.json();
			if (currentVersion && data.version !== currentVersion) {
				console.log("[Service Worker] Update detected:", currentVersion, "->", data.version);
				// Notify all clients about the update
				const clients = await self.clients.matchAll();
				clients.forEach((client) => {
					client.postMessage({
						type: "UPDATE_AVAILABLE",
						version: data.version,
					});
				});
			}
			currentVersion = data.version;
		}
	} catch (err) {
		console.error("[Service Worker] Failed to check version:", err);
	}
}

// Listen for skip waiting messages
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		console.log("[Service Worker] Skipping waiting, claiming clients...");
		self.skipWaiting();
	}
});

// Activate event - claim all clients and clean up old caches
self.addEventListener("activate", (event) => {
	console.log("[Service Worker] Activating...");
	event.waitUntil(
		Promise.all([
			// Claim all clients immediately
			self.clients.claim(),
			// Clean up old caches
			caches.keys().then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME) {
							console.log("[Service Worker] Deleting old cache:", cacheName);
							return caches.delete(cacheName);
						}
					}),
				);
			}),
		]),
	);
});
