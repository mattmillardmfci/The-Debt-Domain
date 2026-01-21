"use client";

import { useAuth } from "@/contexts/AuthContext";
import { deleteAllTransactions, deleteAllUserData, deleteUserProfile } from "@/lib/firestoreService";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, AlertCircle, Check } from "lucide-react";

export default function ProfilePage() {
	const { user, updateDisplayName } = useAuth();
	const router = useRouter();

	const [displayName, setDisplayName] = useState(user?.displayName || "");
	const [isSaving, setIsSaving] = useState(false);
	const [showDeleteTransactions, setShowDeleteTransactions] = useState(false);
	const [showDeleteAllData, setShowDeleteAllData] = useState(false);
	const [showDeleteProfile, setShowDeleteProfile] = useState(false);
	const [deleteProfileConfirmation, setDeleteProfileConfirmation] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");

	const handleUpdateName = async () => {
		if (!displayName.trim() || !user?.uid) return;

		setIsSaving(true);
		try {
			await updateDisplayName(displayName);
			setSuccessMessage("Name updated successfully!");
			setTimeout(() => setSuccessMessage(""), 3000);
		} catch (error) {
			console.error("Error updating name:", error);
			alert("Failed to update name");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteAllTransactions = async () => {
		if (!user?.uid) return;

		setIsDeleting(true);
		try {
			await deleteAllTransactions(user.uid);
			setShowDeleteTransactions(false);
			setSuccessMessage("All transactions deleted successfully!");
			setTimeout(() => setSuccessMessage(""), 3000);
		} catch (error) {
			console.error("Error deleting transactions:", error);
			alert("Failed to delete transactions");
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
			setSuccessMessage("All personal data deleted successfully!");
			// Redirect after a short delay
			setTimeout(() => {
				router.push("/dashboard");
			}, 2000);
		} catch (error) {
			console.error("Error deleting all data:", error);
			alert("Failed to delete all data");
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
		} catch (error) {
			console.error("Error deleting profile:", error);
			alert("Failed to delete profile. You may need to reauthenticate and try again.");
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
								className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
								<Trash2 className="w-4 h-4" />
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
								className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
								<Trash2 className="w-4 h-4" />
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
								This will <strong>permanently delete your entire account</strong>, including all data and your login. You will
								be able to create a new account with this email address afterward.
							</p>
							<button
								onClick={() => setShowDeleteProfile(true)}
								className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg transition-colors">
								<Trash2 className="w-4 h-4" />
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
			{showDeleteProfile && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md mx-4 border-2 border-red-600 dark:border-red-500">
						<div className="flex items-center gap-3 mb-4">
							<AlertCircle className="w-7 h-7 text-red-700 dark:text-red-500" />
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Profile Permanently?</h3>
						</div>

						<div className="space-y-4 mb-6">
							<div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-3">
								<p className="text-sm text-red-900 dark:text-red-100 font-semibold mb-2">This will:</p>
								<ul className="text-sm text-red-800 dark:text-red-200 space-y-1 ml-4 list-disc">
									<li>Delete your entire account permanently</li>
									<li>Remove all your data from the database</li>
									<li>Allow you to create a new account with this email later</li>
									<li>This action <strong>cannot be undone</strong></li>
								</ul>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									To confirm, type your email address:
								</label>
								<input
									type="text"
									value={deleteProfileConfirmation}
									onChange={(e) => setDeleteProfileConfirmation(e.target.value)}
									placeholder={user?.email}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-600"
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									You must type your email exactly to confirm deletion
								</p>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => {
									setShowDeleteProfile(false);
									setDeleteProfileConfirmation("");
								}}
								disabled={isDeleting}
								className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
								Cancel
							</button>
							<button
								onClick={handleDeleteProfile}
								disabled={
									isDeleting ||
									deleteProfileConfirmation !== user?.email ||
									!deleteProfileConfirmation.trim()
								}
								className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors disabled:cursor-not-allowed">
								{isDeleting ? "Deleting..." : "Delete Profile"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
