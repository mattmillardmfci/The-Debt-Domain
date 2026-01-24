import { useEffect, useState } from 'react';

export const useServiceWorkerUpdate = () => {
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [waitingWorker, setWaitingWorker] = useState<ServiceWorkerRegistration | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		if (!('serviceWorker' in navigator)) {
			console.log('Service Workers not supported');
			return;
		}

		// Register service worker
		const registerServiceWorker = async () => {
			try {
				const registration = await navigator.serviceWorker.register('/sw.js', {
					scope: '/',
				});

				console.log('[SW] Registered:', registration);

				// Check for updates periodically (every 60 seconds)
				setInterval(() => {
					registration.update();
				}, 60000);

				// Listen for new service worker waiting to activate
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;

					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								// New service worker is ready, prompt user
								setUpdateAvailable(true);
								setWaitingWorker(registration);
								console.log('[SW] Update available');
							}
						});
					}
				});
			} catch (error) {
				console.error('[SW] Registration failed:', error);
			}
		};

		registerServiceWorker();

		// Handle controller change (when new SW takes over)
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			console.log('[SW] New service worker activated, reloading...');
			window.location.reload();
		});
	}, []);

	const handleUpdateClick = () => {
		if (waitingWorker && waitingWorker.waiting) {
			waitingWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	};

	return { updateAvailable, handleUpdateClick };
};
