"use client";

import { X } from "lucide-react";

interface ConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	isLoading?: boolean;
	isDangerous?: boolean;
	onConfirm: () => void | Promise<void>;
	onCancel: () => void;
}

export default function ConfirmModal({
	isOpen,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	isLoading = false,
	isDangerous = false,
	onConfirm,
	onCancel,
}: ConfirmModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full p-6 animate-in fade-in-0 zoom-in-95">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
					<button
						onClick={onCancel}
						disabled={isLoading}
						className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50">
						<X className="w-5 h-5" />
					</button>
				</div>

				<p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>

				<div className="flex gap-3 justify-end">
					<button
						onClick={onCancel}
						disabled={isLoading}
						className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
						{cancelText}
					</button>
					<button
						onClick={onConfirm}
						disabled={isLoading}
						className={`px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${
							isDangerous ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
						}`}>
						{isLoading ? "..." : confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}
