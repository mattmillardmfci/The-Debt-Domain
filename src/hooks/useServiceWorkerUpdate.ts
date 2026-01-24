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

				// Check for updates more aggressively - every 10 seconds
				const updateInterval = setInterval(() => {
					console.log('[SW] Checking for updates...');
					registration.update().catch((err) => console.error('[SW] Update check failed:', err));
				}, 10000);

				// Listen for new service worker waiting to activate
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;

					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							console.log('[SW] New worker state:', newWorker.state);
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								// New service worker is ready, prompt user
								console.log('[SW] Update available!');
								setUpdateAvailable(true);
								setWaitingWorker(registration);
							}
						});
					}
				});

				return () => clearInterval(updateInterval);
			} catch (error) {
				console.error('[SW] Registration failed:', error);
			}
		};

		registerServiceWorker();

		// Listen for service worker messages (including version updates)
		const handleMessage = (event: any) => {
			console.log('[SW] Message received:', event.data);
			if (event.data?.type === 'UPDATE_AVAILABLE') {
				console.log('[SW] Update available message from worker');
				setUpdateAvailable(true);
			}
		};

		navigator.serviceWorker.addEventListener('message', handleMessage);

		// Handle controller change (when new SW takes over)
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			console.log('[SW] New service worker activated, reloading...');
			window.location.reload();
		});

		return () => {
			navigator.serviceWorker.removeEventListener('message', handleMessage);
		};
	}, []);

	const handleUpdateClick = () => {
		if (waitingWorker && waitingWorker.waiting) {
			console.log('[SW] Sending skip waiting message...');
			waitingWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	};

	return { updateAvailable, handleUpdateClick };
};
