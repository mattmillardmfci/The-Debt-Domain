"use client";

import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

export default function UpdateNotification() {
	const { updateAvailable, handleUpdateClick } = useServiceWorkerUpdate();
	const [dismissed, setDismissed] = useState(false);

	if (!updateAvailable || dismissed) {
		return null;
	}

	return (
		<div className="fixed bottom-4 right-4 max-w-sm z-50 animate-in slide-in-from-bottom">
			<div className="bg-blue-600 dark:bg-blue-700 text-white rounded-lg shadow-lg p-4 border border-blue-700">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3 flex-1">
						<RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
						<div className="flex-1">
							<p className="font-semibold text-sm">Update Available</p>
							<p className="text-xs text-blue-100">A new version is ready to use</p>
						</div>
					</div>
					<button onClick={() => setDismissed(true)} className="text-blue-100 hover:text-white flex-shrink-0">
						<X className="w-4 h-4" />
					</button>
				</div>
				<button
					onClick={() => {
						handleUpdateClick();
					}}
					className="mt-3 w-full px-4 py-2 bg-white text-blue-600 font-medium rounded text-sm hover:bg-blue-50 transition-colors">
					Refresh Now
				</button>
			</div>
		</div>
	);
}
