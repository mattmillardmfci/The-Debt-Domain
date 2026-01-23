"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";

export type AlertType = "error" | "success" | "info";

interface Alert {
	id: string;
	type: AlertType;
	message: string;
}

interface AlertContextType {
	alerts: Alert[];
	showError: (message: string) => void;
	showSuccess: (message: string) => void;
	showInfo: (message: string) => void;
	removeAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
	const [alerts, setAlerts] = useState<Alert[]>([]);

	const removeAlert = useCallback((id: string) => {
		setAlerts((prev) => prev.filter((alert) => alert.id !== id));
	}, []);

	const addAlert = useCallback(
		(type: AlertType, message: string) => {
			const id = Math.random().toString(36).substr(2, 9);
			const alert: Alert = { id, type, message };
			setAlerts((prev) => [...prev, alert]);

			// Auto-remove after 5 seconds
			setTimeout(() => removeAlert(id), 5000);

			return id;
		},
		[removeAlert],
	);

	const showError = useCallback((message: string) => addAlert("error", message), [addAlert]);
	const showSuccess = useCallback((message: string) => addAlert("success", message), [addAlert]);
	const showInfo = useCallback((message: string) => addAlert("info", message), [addAlert]);

	return (
		<AlertContext.Provider value={{ alerts, showError, showSuccess, showInfo, removeAlert }}>
			{children}
			<AlertContainer alerts={alerts} onRemove={removeAlert} />
		</AlertContext.Provider>
	);
}

export function useAlert() {
	const context = useContext(AlertContext);
	if (context === undefined) {
		throw new Error("useAlert must be used within an AlertProvider");
	}
	return context;
}

function AlertContainer({ alerts, onRemove }: { alerts: Alert[]; onRemove: (id: string) => void }) {
	return (
		<div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
			{alerts.map((alert) => (
				<div
					key={alert.id}
					className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-in slide-in-from-bottom-4 ${
						alert.type === "error"
							? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
							: alert.type === "success"
								? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
								: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
					}`}>
					<div className="flex-shrink-0 mt-0.5">
						{alert.type === "error" && <AlertCircle className="w-5 h-5" />}
						{alert.type === "success" && <CheckCircle className="w-5 h-5" />}
						{alert.type === "info" && <Info className="w-5 h-5" />}
					</div>
					<p className="flex-1 text-sm">{alert.message}</p>
					<button
						onClick={() => onRemove(alert.id)}
						className="flex-shrink-0 text-opacity-70 hover:text-opacity-100 transition-opacity">
						<X className="w-5 h-5" />
					</button>
				</div>
			))}
		</div>
	);
}
