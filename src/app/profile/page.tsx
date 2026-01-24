"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { deleteAllTransactions, deleteAllUserData, deleteUserProfile } from "@/lib/firestoreService";
import { exportUserData, downloadDataAsFile, parseExportFile, importUserData } from "@/lib/dataExport";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { AlertCircle, Check, Download, Upload } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function ProfilePage() {
	const { user, updateDisplayName } = useAuth();
	const { showError, showSuccess } = useAlert();
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [displayName, setDisplayName] = useState(user?.displayName || "");
	const [isSaving, setIsSaving] = useState(false);
	const [showDeleteTransactions, setShowDeleteTransactions] = useState(false);
	const [showDeleteAllData, setShowDeleteAllData] = useState(false);
	const [showDeleteProfile, setShowDeleteProfile] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");

	const handleUpdateName = async () => {
		if (!displayName.trim() || !user?.uid) return;

		setIsSaving(true);
		try {
			await updateDisplayName(displayName);
			showSuccess("Name updated successfully!");
		} catch (error) {
			console.error("Error updating name:", error);
			showError("Failed to update name");
		} finally {
			setIsSaving(false);
		}
	};

	const handleExportData = async () => {
		if (!user?.uid) {
			showError("You must be logged in");
			return;
		}

		setIsExporting(true);
		try {
			const data = await exportUserData(user.uid);
			const fileName = `financial-advisor-backup-${new Date().toISOString().split("T")[0]}.json`;
			downloadDataAsFile(data, fileName);
			showSuccess("Data exported successfully!");
		} catch (error) {
			console.error("Error exporting data:", error);
			showError(error instanceof Error ? error.message : "Failed to export data");
		} finally {
			setIsExporting(false);
		}
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
		if (!user?.uid) {
			showError("You must be logged in");
			return;
		}

		const file = event.target.files?.[0];
		if (!file) return;

		setIsImporting(true);
		try {
			const data = await parseExportFile(file);
			await importUserData(user.uid, data);
			showSuccess("Data imported successfully! Your settings and customizations have been restored.");
			setSuccessMessage("Your data has been imported successfully!");
		} catch (error) {
			console.error("Error importing data:", error);
			showError(error instanceof Error ? error.message : "Failed to import data");
		} finally {
			setIsImporting(false);
			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleDeleteAllTransactions = async () => {
		if (!user?.uid) return;

		setIsDeleting(true);
		try {
			await deleteAllTransactions(user.uid);
			setShowDeleteTransactions(false);
			showSuccess("All transactions deleted successfully!");
		} catch (error) {
			console.error("Error deleting transactions:", error);
			showError("Failed to delete transactions");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteAllData = async () => {
		if (!user?.uid) return;

		setIsDeleting(true);
		try {
			await deleteAllUserData(user.uid);
			setShowDeleteAllData(false);
			showSuccess("All personal data deleted successfully!");
			// Redirect after a short delay
			setTimeout(() => {
				router.push("/dashboard");
			}, 2000);
		} catch (error) {
			console.error("Error deleting all data:", error);
			showError("Failed to delete all data");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteProfile = async () => {
		if (!user?.uid) return;

		setIsDeleting(true);
		try {
			await deleteUserProfile(user.uid);
			setShowDeleteProfile(false);
			// Wait a moment for the auth state to update, then redirect
			setTimeout(() => {
				router.push("/login");
			}, 1000);
		} catch (error: any) {
			console.error("Error deleting profile:", error);
			const errorMessage = error.message || "";
			if (errorMessage.includes("REQUIRES_REAUTHENTICATION")) {
				showError(
					"For security reasons, please log out and log back in with your password, then try deleting your account again.",
				);
			} else {
				showError("Failed to delete profile. You may need to reauthenticate and try again.");
			}
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">Manage your account information</p>
			</div>

			{/* Success Message */}
			{successMessage && (
				<div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
					<Check className="w-5 h-5 text-green-600 dark:text-green-400" />
					<p className="text-green-800 dark:text-green-100">{successMessage}</p>
				</div>
			)}

			{/* Edit Name Section */}
			<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
						<input
							type="text"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter your name"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
						<input
							type="email"
							value={user?.email || ""}
							disabled
							className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-600 text-gray-900 dark:text-white cursor-not-allowed opacity-75"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
					</div>

					<button
						onClick={handleUpdateName}
						disabled={isSaving || !displayName.trim()}
						className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors">
						{isSaving ? "Saving..." : "Update Name"}
					</button>
				</div>
			</div>

			{/* Danger Zone */}
			<div className="space-y-4">
				<h2 className="text-xl font-bold text-gray-900 dark:text-white">Data Management</h2>

				{/* Export Data */}
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
					<div className="flex items-start gap-4">
						<Download className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">Export Your Data</h3>
							<p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
								Download a backup of all your custom categories, income entries, debts, budgets, and other personal
								customizations. This file can be imported back to restore your settings.
							</p>
							<button
								onClick={handleExportData}
								disabled={isExporting}
								className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors">
								<Download className="w-4 h-4" />
								{isExporting ? "Exporting..." : "Export Data"}
							</button>
						</div>
					</div>
				</div>

				{/* Import Data */}
				<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
					<div className="flex items-start gap-4">
						<Upload className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">Import Data</h3>
							<p className="text-sm text-green-800 dark:text-green-200 mb-4">
								Restore your previously exported settings and customizations from a backup file. This will not affect
								your existing transactions.
							</p>
							<button
								onClick={handleImportClick}
								disabled={isImporting}
								className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors">
								<Upload className="w-4 h-4" />
								{isImporting ? "Importing..." : "Import Data"}
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept=".json"
								onChange={handleImportData}
								className="hidden"
								disabled={isImporting}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Danger Zone */}
			<div className="space-y-4">
				<h2 className="text-xl font-bold text-gray-900 dark:text-white">Danger Zone</h2>

				{/* Delete All Transactions */}
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
					<div className="flex items-start gap-4">
						<AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">Delete All Transactions</h3>
							<p className="text-sm text-red-800 dark:text-red-200 mb-4">
								This will permanently delete all your transaction records. This action cannot be undone.
							</p>
							<button
								onClick={() => setShowDeleteTransactions(true)}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
								Delete All Transactions
							</button>
						</div>
					</div>
				</div>

				{/* Delete All Data */}
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
					<div className="flex items-start gap-4">
						<AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">Delete All Personal Data</h3>
							<p className="text-sm text-red-800 dark:text-red-200 mb-4">
								This will permanently erase ALL your data including transactions, debts, budgets, categories, and income
								entries. This action is irreversible.
							</p>
							<button
								onClick={() => setShowDeleteAllData(true)}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
								Delete All Personal Data
							</button>
						</div>
					</div>
				</div>

				{/* Delete Profile */}
				<div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-600 dark:border-red-500 rounded-lg p-6">
					<div className="flex items-start gap-4">
						<AlertCircle className="w-6 h-6 text-red-700 dark:text-red-500 flex-shrink-0 mt-1" />
						<div className="flex-1">
							<h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">
								⚠️ Delete Your Profile Permanently
							</h3>
							<p className="text-sm text-red-800 dark:text-red-200 mb-4">
								This will <strong>permanently delete your entire account</strong>, including all data and your login.
								You will be able to create a new account with this email address afterward.
							</p>
							<button
								onClick={() => setShowDeleteProfile(true)}
								className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg transition-colors">
								Delete Profile Permanently
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Delete Transactions Confirmation Modal */}
			{showDeleteTransactions && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 border border-gray-200 dark:border-slate-700">
						<div className="flex items-center gap-3 mb-4">
							<AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete All Transactions?</h3>
						</div>
						<p className="text-gray-600 dark:text-gray-400 mb-6">
							Are you sure you want to delete all transactions? This action cannot be undone.
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowDeleteTransactions(false)}
								className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
								Cancel
							</button>
							<button
								onClick={handleDeleteAllTransactions}
								disabled={isDeleting}
								className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors">
								{isDeleting ? "Deleting..." : "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete All Data Confirmation Modal */}
			{showDeleteAllData && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 border border-gray-200 dark:border-slate-700">
						<div className="flex items-center gap-3 mb-4">
							<AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete All Personal Data?</h3>
						</div>
						<p className="text-gray-600 dark:text-gray-400 mb-2">This will permanently delete:</p>
						<ul className="text-sm text-gray-600 dark:text-gray-400 mb-6 ml-5 list-disc space-y-1">
							<li>All transactions</li>
							<li>All debts</li>
							<li>All budgets</li>
							<li>All categories</li>
							<li>All income entries</li>
						</ul>
						<p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-6">This action cannot be undone.</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowDeleteAllData(false)}
								className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
								Cancel
							</button>
							<button
								onClick={handleDeleteAllData}
								disabled={isDeleting}
								className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors">
								{isDeleting ? "Deleting..." : "Delete All"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Profile Confirmation Modal */}
			<ConfirmModal
				isOpen={showDeleteProfile}
				title="Delete Profile Permanently?"
				message="This will permanently delete your entire account and remove all your data. You will be able to create a new account with this email later. This action cannot be undone."
				confirmText="Delete Profile"
				cancelText="Cancel"
				isDangerous={true}
				isLoading={isDeleting}
				onConfirm={handleDeleteProfile}
				onCancel={() => setShowDeleteProfile(false)}
			/>
		</div>
	);
}
