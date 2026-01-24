"use client";

import { useState, useEffect } from "react";
import { Debt } from "@/types";
import { Plus, Edit2, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import {
	getDebts,
	saveDebt,
	deleteDebt,
	updateDebt,
	detectRecurringDebts,
	RecurringDebtPattern,
} from "@/lib/firestoreService";
import ConfirmModal from "@/components/ConfirmModal";

export default function DebtsPage() {
	const { user } = useAuth();
	const { showError, showSuccess } = useAlert();
	const [debts, setDebts] = useState<(Partial<Debt> & { id: string })[]>([]);
	const [recurringDebts, setRecurringDebts] = useState<RecurringDebtPattern[]>([]);
	const [showForm, setShowForm] = useState(false);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; debtId: string | null }>({
		isOpen: false,
		debtId: null,
	});
	const [deleting, setDeleting] = useState(false);
	const [formData, setFormData] = useState<Partial<Debt>>({
		type: "credit-card",
		balance: 0,
		interestRate: 0,
		minimumPayment: 0,
		monthlyPayment: 0,
	});

	// Format currency with thousand separators
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Math.abs(amount));
	};

	// Load debts from Firestore
	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		const loadDebts = async () => {
			try {
				const [debtsData, recurringData] = await Promise.all([getDebts(user.uid), detectRecurringDebts(user.uid)]);
				setDebts(debtsData);
				setRecurringDebts(recurringData);
			} catch (err) {
				console.error("Failed to load debts:", err);
			} finally {
				setLoading(false);
			}
		};

		loadDebts();
	}, [user?.uid]);

	const handleAddDebt = async () => {
		if (!formData.name || formData.balance === undefined) {
			showError("Please fill in all required fields");
			return;
		}

		if (!user?.uid) {
			showError("You must be logged in to add a debt");
			return;
		}

		try {
			if (editingId) {
				// Update existing debt
				const updates: Partial<Debt> = {
					name: formData.name,
					balance: Math.round((formData.balance as number) * 100),
					interestRate: formData.interestRate || 0,
					minimumPayment: Math.round((formData.minimumPayment || 0) * 100),
					monthlyPayment: Math.round((formData.monthlyPayment || formData.minimumPayment || 0) * 100),
					creditor: formData.creditor,
					type: formData.type || "credit-card",
				};

				await updateDebt(user.uid, editingId, updates);

				// Update local state
				setDebts(debts.map((d) => (d.id === editingId ? { ...d, ...updates } : d)));
				setEditingId(null);
			} else {
				// Create new debt
				const newDebt: Partial<Debt> = {
					name: formData.name,
					balance: Math.round((formData.balance as number) * 100),
					interestRate: formData.interestRate || 0,
					minimumPayment: Math.round((formData.minimumPayment || 0) * 100),
					monthlyPayment: Math.round((formData.monthlyPayment || formData.minimumPayment || 0) * 100),
					creditor: formData.creditor,
					type: formData.type || "credit-card",
				};

				// Save to Firestore
				const docId = await saveDebt(user.uid, newDebt);

				// Add to local state with ID
				setDebts([...debts, { ...newDebt, id: docId }]);
			}

			setFormData({
				type: "credit-card",
				balance: 0,
				interestRate: 0,
				minimumPayment: 0,
				monthlyPayment: 0,
			});
			setShowForm(false);
		} catch (err) {
			console.error("Failed to save debt:", err);
			showError("Failed to save debt. Please try again.");
		}
	};

	const handleDeleteDebt = async (id: string) => {
		setDeleteModal({ isOpen: true, debtId: id });
	};

	const handleConfirmDeleteDebt = async () => {
		if (!user?.uid || !deleteModal.debtId) return;

		setDeleting(true);
		try {
			await deleteDebt(user.uid, deleteModal.debtId);
			setDebts(debts.filter((d) => d.id !== deleteModal.debtId));

			// Reload recurring debts to show any that were hidden by this debt
			const recurringData = await detectRecurringDebts(user.uid);
			setRecurringDebts(recurringData);
			setDeleteModal({ isOpen: false, debtId: null });
			showSuccess("Debt deleted successfully");
		} catch (err) {
			console.error("Failed to delete debt:", err);
			showError("Failed to delete debt. Please try again.");
		} finally {
			setDeleting(false);
		}
	};

	const handleEditDebt = (debt: Partial<Debt> & { id: string }) => {
		setEditingId(debt.id);
		setFormData({
			name: debt.name,
			balance: (debt.balance || 0) / 100,
			interestRate: debt.interestRate,
			minimumPayment: (debt.minimumPayment || 0) / 100,
			monthlyPayment: (debt.monthlyPayment || 0) / 100,
			creditor: debt.creditor,
			type: debt.type,
		});
		setShowForm(true);
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setFormData({
			type: "credit-card",
			balance: 0,
			interestRate: 0,
			minimumPayment: 0,
			monthlyPayment: 0,
		});
		setShowForm(false);
	};

	const handleCreateDebtFromRecurring = async (pattern: RecurringDebtPattern) => {
		if (!user?.uid) {
			showError("You must be logged in");
			return;
		}

		try {
			const newDebt: Partial<Debt> = {
				name: pattern.description,
				balance: Math.round(Math.abs(pattern.avgAmount) * 100),
				monthlyPayment: Math.round(Math.abs(pattern.avgAmount) * 100),
				minimumPayment: Math.round(Math.abs(pattern.avgAmount) * 100),
				interestRate: 0,
				type: "other",
			};

			const docId = await saveDebt(user.uid, newDebt);
			setDebts([...debts, { ...newDebt, id: docId }]);
			// Remove from recurring list
			setRecurringDebts(recurringDebts.filter((r) => r.description !== pattern.description));
			showSuccess(`Created debt "${pattern.description}". Adjust the balance if needed.`);
		} catch (err) {
			console.error("Failed to create debt from recurring:", err);
			showError("Failed to create debt. Please try again.");
		}
	};

	const totalDebt = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
	const totalMinimumPayment = debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
	const avgInterestRate =
		debts.length > 0 ? debts.reduce((sum, d) => sum + (d.interestRate || 0), 0) / debts.length : 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Your Debts</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">Track all your debts and get a personalized payoff plan</p>
			</div>

			{/* Summary Cards */}
			{debts.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Debt</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalDebt / 100)}</p>
					</div>
					<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Minimum Payment</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
							{formatCurrency(totalMinimumPayment / 100)}/mo
						</p>
					</div>
					<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Interest Rate</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{avgInterestRate.toFixed(1)}%</p>
					</div>
					<div>
						{debts.length > 0 && (
							<Link
								href="/payoff-plan"
								className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
								Create Plan
							</Link>
						)}
					</div>
				</div>
			)}

			{/* Add Debt Form */}
			{showForm ? (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
						{editingId ? "Edit Debt" : "Add New Debt"}
					</h2>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Debt Name *</label>
							<input
								type="text"
								placeholder="e.g., Chase Credit Card"
								value={formData.name || ""}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type *</label>
								<select
									value={formData.type || "credit-card"}
									onChange={(e) =>
										setFormData({
											...formData,
											type: e.target.value as any,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500">
									<option value="credit-card">Credit Card</option>
									<option value="personal-loan">Personal Loan</option>
									<option value="student-loan">Student Loan</option>
									<option value="car-loan">Car Loan</option>
									<option value="mortgage">Mortgage</option>
									<option value="other">Other</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Creditor (Optional)
								</label>
								<input
									type="text"
									placeholder="e.g., Chase Bank"
									value={formData.creditor || ""}
									onChange={(e) => setFormData({ ...formData, creditor: e.target.value })}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Balance ($) *</label>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={formData.balance || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											balance: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Interest Rate (%) *
								</label>
								<input
									type="number"
									step="0.1"
									min="0"
									max="100"
									placeholder="0.0"
									value={formData.interestRate || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											interestRate: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Minimum Payment ($)
								</label>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={formData.minimumPayment || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											minimumPayment: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Current Payment ($)
								</label>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={formData.monthlyPayment || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											monthlyPayment: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={handleAddDebt}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
								{editingId ? "Update Debt" : "Add Debt"}
							</button>
							<button
								onClick={handleCancelEdit}
								className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
								Cancel
							</button>
						</div>
					</div>
				</div>
			) : (
				<button
					onClick={() => setShowForm(true)}
					className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
					<Plus className="w-5 h-5" />
					Add Debt
				</button>
			)}

			{/* Debts List */}
			{debts.length > 0 && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Debt
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Balance
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Rate
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Min Payment
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Current Payment
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
								{debts.map((debt) => (
									<tr key={debt.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
										<td className="px-6 py-4">
											<div>
												<p className="font-medium text-gray-900 dark:text-white">{debt.name}</p>
												<p className="text-xs text-gray-600 dark:text-gray-400">{debt.creditor || debt.type}</p>
											</div>
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											${((debt.balance || 0) / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											{(debt.interestRate || 0).toFixed(2)}%
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											${((debt.minimumPayment || 0) / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											${((debt.monthlyPayment || 0) / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-right space-x-2">
											<button
												onClick={() => handleEditDebt(debt)}
												className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors inline-block">
												<Edit2 className="w-4 h-4" />
											</button>
											<button
												onClick={() => handleDeleteDebt(debt.id)}
												className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded font-medium inline-block">
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Empty State */}
			{debts.length === 0 && !showForm && (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Debts Added Yet</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Start by adding your debts to get a personalized payoff plan
					</p>
				</div>
			)}

			{/* Auto-Detected Recurring Debts */}
			{recurringDebts.length > 0 && (
				<div className="border-t border-gray-200 dark:border-slate-700 pt-8 mt-8">
					<div className="flex items-center gap-2 mb-4">
						<TrendingDown className="w-5 h-5 text-blue-600" />
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">Auto-Detected Recurring Debts</h2>
					</div>
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						We found the following recurring payments in your transaction history. Would you like to add them as tracked
						debts?
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{recurringDebts
							.filter((pattern) => !debts.some((d) => d.name === pattern.description))
							.map((pattern) => (
								<div
									key={pattern.description}
									className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
									<div className="mb-4">
										<h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm line-clamp-2">
											{pattern.description}
										</h3>
										<div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
											<div className="flex justify-between">
												{" "}
												<span>Category:</span>
												<span className="font-medium text-gray-900 dark:text-white">{pattern.category}</span>
											</div>
											<div className="flex justify-between">
												{" "}
												<span>Frequency:</span>
												<span className="font-medium text-gray-900 dark:text-white">{pattern.count}x</span>
											</div>
											<div className="flex justify-between">
												<span>Interval:</span>
												<span className="font-medium text-gray-900 dark:text-white">{pattern.estimatedFrequency}</span>
											</div>
											<div className="flex justify-between">
												<span>Avg Amount:</span>
												<span className="font-medium text-gray-900 dark:text-white">
													{formatCurrency(pattern.avgAmount)}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Last Payment:</span>
												<span className="font-medium text-gray-900 dark:text-white">
													{pattern.lastOccurrence.toLocaleDateString()}
												</span>
											</div>
										</div>
									</div>

									<button
										onClick={() => handleCreateDebtFromRecurring(pattern)}
										className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors">
										Create as Debt
									</button>
								</div>
							))}
					</div>
				</div>
			)}

			{/* Delete Debt Confirmation Modal */}
			<ConfirmModal
				isOpen={deleteModal.isOpen}
				title="Delete Debt"
				message="Are you sure you want to delete this debt? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
				isDangerous={true}
				isLoading={deleting}
				onConfirm={handleConfirmDeleteDebt}
				onCancel={() => setDeleteModal({ isOpen: false, debtId: null })}
			/>
		</div>
	);
}
