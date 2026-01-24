"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { TrendingDown, AlertCircle, Edit2, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import React from "react";
import { COMMON_CATEGORIES } from "@/lib/constants";
import ConfirmModal from "@/components/ConfirmModal";
import {
	detectRecurringDebts,
	saveIgnoredRecurringExpense,
	updateRecurringExpenseOverride,
	saveCustomRecurringExpense,
	getCustomRecurringExpenses,
	findUndetectedRecurringExpenses,
	bulkRenameRecurringExpenseDescription,
	getCustomCategories,
	deleteCustomRecurringExpense,
} from "@/lib/firestoreService";

interface RecurringExpense {
	description: string;
	amount: number; // Per occurrence in dollars
	frequency: string;
	monthlyAmount: number;
	count: number;
	lastOccurrence: Date;
	category?: string;
	originalDescription?: string;
	categoryOverride?: string;
	descriptionOverride?: string;
	isEditing?: boolean;
	isCustom?: boolean;
}

export default function ExpensesPage() {
	const { user } = useAuth();
	const { showError, showSuccess } = useAlert();
	const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editedCategory, setEditedCategory] = useState("");
	const [editedDescription, setEditedDescription] = useState("");
	const [saving, setSaving] = useState(false);
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; index: number | null }>({
		isOpen: false,
		index: null,
	});
	const [deleting, setDeleting] = useState(false);
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
	const [undetectedExpenses, setUndetectedExpenses] = useState<
		Array<{
			description: string;
			amount: number;
			count: number;
			lastOccurrence: Date;
			category?: string;
		}>
	>([]);
	const [showDetectedExpenses, setShowDetectedExpenses] = useState(false);
	const [renameModal, setRenameModal] = useState<{
		isOpen: boolean;
		oldDescription: string;
		newDescription: string;
		count: number;
	}>({
		isOpen: false,
		oldDescription: "",
		newDescription: "",
		count: 0,
	});
	const [renaming, setRenaming] = useState(false);
	const [mobileEditingIndex, setMobileEditingIndex] = useState<number | null>(null);
	const [mobileEditDescription, setMobileEditDescription] = useState("");
	const [mobileEditCategory, setMobileEditCategory] = useState("");
	const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
	const [touchStart, setTouchStart] = useState(0);
	const [touchEnd, setTouchEnd] = useState(0);
	const [showInstructions, setShowInstructions] = useState(false);
	const [allCategories, setAllCategories] = useState<string[]>(COMMON_CATEGORIES);
	const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
	const [editingCategoryValue, setEditingCategoryValue] = useState("");

	const handleEditClick = (index: number, expense: RecurringExpense) => {
		setEditingIndex(index);
		setEditedCategory(expense.categoryOverride || expense.category || "Other");
		setEditedDescription(expense.descriptionOverride || expense.description);
	};

	const handleEditCategoryClick = (index: number, expense: RecurringExpense) => {
		setEditingCategoryIndex(index);
		setEditingCategoryValue(expense.categoryOverride || expense.category || "Other");
	};

	const handleSaveCategoryEdit = async (index: number, expense: RecurringExpense) => {
		if (!user?.uid || !editingCategoryValue.trim()) return;

		setSaving(true);
		try {
			// Save the category override to Firestore
			await updateRecurringExpenseOverride(user.uid, {
				originalDescription: expense.description,
				amount: expense.amount,
				categoryOverride: editingCategoryValue,
				descriptionOverride: expense.descriptionOverride || expense.description,
			});

			// Update the local expense
			const updated = [...expenses];
			updated[index] = {
				...updated[index],
				categoryOverride: editingCategoryValue,
			};
			setExpenses(updated);

			setEditingCategoryIndex(null);
			showSuccess("Category updated successfully");
		} catch (error) {
			console.error("Failed to update category:", error);
			showError("Failed to update category");
		} finally {
			setSaving(false);
		}
	};

	const handleSaveEdit = async (index: number, expense: RecurringExpense) => {
		if (!user?.uid || !editedDescription.trim()) return;

		setSaving(true);
		try {
			// Save the override to Firestore
			await updateRecurringExpenseOverride(user.uid, {
				originalDescription: expense.description,
				amount: expense.amount,
				categoryOverride: editedCategory,
				descriptionOverride: editedDescription,
			});

			// Update local state
			const updated = [...expenses];
			updated[index] = {
				...updated[index],
				categoryOverride: editedCategory,
				descriptionOverride: editedDescription,
				category: editedCategory,
				description: editedDescription,
			};
			setExpenses(updated);
			setEditingIndex(null);
		} catch (error) {
			console.error("Failed to save edit:", error);
			showError("Failed to save changes");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (index: number) => {
		setDeleteModal({ isOpen: true, index });
	};

	const handleConfirmDelete = async () => {
		if (!user?.uid || deleteModal.index === null) return;

		setDeleting(true);
		const index = deleteModal.index;
		try {
			const expense = expenses[index];

			// Delete from custom recurring expenses collection (for both detected and truly custom)
			// The amount in the database is stored with its original sign (negative for expenses)
			await deleteCustomRecurringExpense(user.uid, expense.description, expense.amount);

			// Update UI state immediately (batched together for performance)
			const updated = expenses.filter((_, i) => i !== index);
			setExpenses(updated);

			// If this was a detected expense that was added, re-add it to undetected list
			if (!expense.isCustom) {
				const undetected = {
					description: expense.description,
					amount: expense.amount,
					count: expense.count,
					lastOccurrence: expense.lastOccurrence,
					category: expense.category,
					transactions: [], // Include empty transactions array for consistency
				};
				setUndetectedExpenses((prev) => [...prev, undetected]);
				// Auto-expand the detected expenses section to show the restored item
				setShowDetectedExpenses(true);
			}

			// Recalculate total with absolute values
			const total = updated.reduce((sum, exp) => sum + Math.abs(exp.monthlyAmount), 0);
			setTotalMonthlyExpenses(total);

			setDeleteModal({ isOpen: false, index: null });
			showSuccess("Expense removed successfully");
		} catch (error) {
			console.error("Failed to delete expense:", error);
			showError("Failed to remove expense");
		} finally {
			setDeleting(false);
		}
	};

	const handleAddExpense = async (index: number) => {
		if (!user?.uid) {
			showError("Please log in");
			return;
		}

		const selected = undetectedExpenses[index];

		// Check if already in expenses list
		const isDuplicate = expenses.some((exp) => exp.description.toLowerCase() === selected.description.toLowerCase());

		if (isDuplicate) {
			showError(`"${selected.description}" is already in your monthly expenses.`);
			return;
		}

		setSaving(true);
		try {
			// Save to custom recurring expenses
			await saveCustomRecurringExpense(user.uid, {
				description: selected.description,
				amount: selected.amount,
				frequency: "monthly",
				category: selected.category || "Other",
				lastOccurrence: selected.lastOccurrence,
			});

			// Add to local state with correct count from undetected
			const newExpense: RecurringExpense = {
				description: selected.description,
				amount: selected.amount,
				frequency: "monthly",
				monthlyAmount: selected.amount,
				count: selected.count, // Use the actual count from undetected
				lastOccurrence: selected.lastOccurrence,
				category: selected.category,
				isCustom: false, // This was detected, not truly custom
			};

			const updated = [...expenses, newExpense];
			updated.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
			setExpenses(updated);

			// Recalculate total with absolute values
			const total = updated.reduce((sum, exp) => sum + Math.abs(exp.monthlyAmount), 0);
			setTotalMonthlyExpenses(total);

			// Remove from undetected list
			const newUndetected = undetectedExpenses.filter((_, i) => i !== index);
			setUndetectedExpenses(newUndetected);
			showSuccess(`"${selected.description}" added to your monthly expenses!`);
		} catch (error) {
			console.error("Failed to add expense:", error);
			showError("Failed to add expense");
		} finally {
			setSaving(false);
		}
	};

	const openRenameModal = (description: string) => {
		const count = expenses.filter((exp) => exp.description === description).length;
		setRenameModal({
			isOpen: true,
			oldDescription: description,
			newDescription: description,
			count,
		});
	};

	const handleRenameExpense = async () => {
		if (!user?.uid || !renameModal.newDescription.trim()) return;

		setRenaming(true);
		try {
			await bulkRenameRecurringExpenseDescription(
				user.uid,
				renameModal.oldDescription,
				renameModal.newDescription.trim(),
			);
			// Update local expenses
			setExpenses(
				expenses.map((exp) =>
					exp.description === renameModal.oldDescription
						? { ...exp, description: renameModal.newDescription.trim() }
						: exp,
				),
			);
			setRenameModal({ isOpen: false, oldDescription: "", newDescription: "", count: 0 });
			showSuccess("Expenses renamed successfully");
		} catch (err) {
			console.error("Failed to rename expenses:", err);
			showError("Failed to rename expenses. Please try again.");
		} finally {
			setRenaming(false);
		}
	};

	const handleMobileTouchStart = (e: React.TouchEvent) => {
		setTouchStart(e.targetTouches[0].clientX);
	};

	const handleMobileTouchEnd = (e: React.TouchEvent, index: number) => {
		setTouchEnd(e.changedTouches[0].clientX);
		const distance = touchStart - e.changedTouches[0].clientX;

		// Swipe left (distance > 50px)
		if (distance > 50) {
			setSwipedIndex(index);
		}
		// Swipe right (distance < -50px) or close if already swiped
		else if (distance < -50 || swipedIndex === index) {
			setSwipedIndex(null);
		}
	};

	const handleMobileEdit = (index: number, expense: RecurringExpense) => {
		setMobileEditingIndex(index);
		setMobileEditDescription(expense.descriptionOverride || expense.description);
		setMobileEditCategory(expense.categoryOverride || expense.category || "Other");
		setSwipedIndex(null);
	};

	const handleMobileSaveEdit = async (index: number, expense: RecurringExpense) => {
		if (!user?.uid || !mobileEditDescription.trim()) return;

		setMobileEditingIndex(null);
		setSwipedIndex(null);

		try {
			await updateRecurringExpenseOverride(user.uid, {
				originalDescription: expense.description,
				amount: expense.amount,
				categoryOverride: mobileEditCategory,
				descriptionOverride: mobileEditDescription,
			});

			const updated = [...expenses];
			updated[index] = {
				...updated[index],
				categoryOverride: mobileEditCategory,
				descriptionOverride: mobileEditDescription,
				category: mobileEditCategory,
				description: mobileEditDescription,
			};
			setExpenses(updated);
			showSuccess("Changes saved successfully");
		} catch (error) {
			console.error("Failed to save edit:", error);
			showError("Failed to save changes");
		}
	};

	const calculateMonthlyAmount = (amount: number, frequency: string | undefined): number => {
		if (!frequency || frequency === "monthly") return amount;
		if (frequency === "weekly") return amount * (52 / 12);
		if (frequency === "biweekly") return amount * (26 / 12);
		if (frequency === "semi-monthly") return amount * 2;
		if (frequency === "quarterly") return amount / 3;
		if (frequency === "annual") return amount / 12;
		return amount;
	};

	useEffect(() => {
		if (!user?.uid) {
			setIsLoading(false);
			return;
		}

		const loadExpenses = async () => {
			try {
				const [recurringDebts, customExpenses, undetected, customCats] = await Promise.all([
					detectRecurringDebts(user.uid),
					getCustomRecurringExpenses(user.uid),
					findUndetectedRecurringExpenses(user.uid),
					getCustomCategories(user.uid),
				]);

				// Load custom categories and merge with common categories
				const customCategoryNames = customCats.map((c) => c.name || "").filter((n) => n);
				const merged = Array.from(new Set([...COMMON_CATEGORIES, ...customCategoryNames]));
				setAllCategories(merged);

				// Combine detected and custom expenses
				// Custom expenses that came from detected now have their original count from when they were detected
				const allExpenses = [
					...recurringDebts.map((debt) => {
						const monthlyAmount = calculateMonthlyAmount(debt.avgAmount, debt.estimatedFrequency);
						return {
							description: debt.description,
							amount: debt.avgAmount,
							frequency: debt.estimatedFrequency || "monthly",
							monthlyAmount,
							count: debt.count,
							lastOccurrence: debt.lastOccurrence,
							category: debt.category,
							isCustom: false,
						};
					}),
					...customExpenses.map((custom) => {
						const monthlyAmount = calculateMonthlyAmount(custom.avgAmount, custom.estimatedFrequency);
						// Check if this custom expense was originally detected (has count > 0)
						const matchingDetected = recurringDebts.find(
							(debt) => debt.description.toLowerCase() === custom.description.toLowerCase(),
						);
						const originalCount = matchingDetected ? matchingDetected.count : 0;

						return {
							description: custom.description,
							amount: custom.avgAmount,
							frequency: custom.estimatedFrequency || "monthly",
							monthlyAmount,
							count: originalCount > 0 ? originalCount : 0,
							lastOccurrence: custom.lastOccurrence,
							category: custom.category,
							isCustom: originalCount === 0, // Only truly custom if it wasn't detected
						};
					}),
				];

				// Sort by monthly amount (highest first)
				allExpenses.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

				// Calculate total (use absolute values for expenses)
				const total = allExpenses.reduce((sum, expense) => sum + Math.abs(expense.monthlyAmount), 0);

				setExpenses(allExpenses);
				setTotalMonthlyExpenses(total);

				// Filter undetected expenses: exclude any already in allExpenses (by description match)
				const addedDescriptions = new Set(allExpenses.map((exp) => exp.description.toLowerCase()));
				const filteredUndetected = undetected.filter((exp) => !addedDescriptions.has(exp.description.toLowerCase()));

				setUndetectedExpenses(filteredUndetected);
			} catch (error) {
				console.error("Failed to load expenses:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadExpenses();
	}, [user?.uid]);

	// Check if user has seen instructions on first visit
	useEffect(() => {
		const hasSeenInstructions = localStorage.getItem("expensesPageInstructionsSeen");
		if (!hasSeenInstructions) {
			setShowInstructions(true);
		}
	}, []);

	const handleDismissInstructions = () => {
		setShowInstructions(false);
		localStorage.setItem("expensesPageInstructionsSeen", "true");
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="text-center">
					<p className="text-gray-600 dark:text-gray-400">Loading recurring expenses...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Navigation */}
			<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Monthly Expenses</h1>
					<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
						Recurring expenses detected from your transaction history
					</p>
				</div>
				<Link
					href="/dashboard"
					className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium min-h-10 flex items-center">
					← Back to Dashboard
				</Link>
			</div>

			{/* Total Summary */}
			<div className="bg-white dark:bg-slate-800 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Monthly Expenses</p>
						<p className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-2">
							{formatCurrency(totalMonthlyExpenses)}
						</p>
						<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
							From {expenses.length} recurring expense{expenses.length !== 1 ? "s" : ""}
						</p>
					</div>
					<TrendingDown className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 opacity-20 flex-shrink-0" />
				</div>
			</div>

			{/* Detected Expenses Section - Collapsible */}
			{undetectedExpenses.length > 0 && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
					<button
						onClick={() => setShowDetectedExpenses(!showDetectedExpenses)}
						className="w-full px-4 sm:px-6 py-3 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
						<div className="text-left">
							<h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
								Detected Recurring Expenses ({undetectedExpenses.length})
							</h3>
							<p className="text-xs text-gray-600 dark:text-gray-400">Click to add more to your monthly expenses</p>
						</div>
						<ChevronDown
							className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
								showDetectedExpenses ? "transform rotate-180" : ""
							}`}
						/>
					</button>

					{showDetectedExpenses && (
						<div className="divide-y divide-gray-200 dark:divide-slate-700 border-t border-gray-200 dark:border-slate-700">
							{undetectedExpenses.map((expense, index) => (
								<div
									key={`${expense.description}-${index}`}
									className="px-4 sm:px-6 py-2 sm:py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between gap-2 sm:gap-4">
									<div className="flex-grow min-w-0">
										<p className="text-sm font-medium text-gray-900 dark:text-white truncate">{expense.description}</p>
										<p className="text-xs text-gray-600 dark:text-gray-400">
											{expense.count}x • {expense.category || "Other"}
										</p>
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										<div className="text-right">
											<p className="text-sm font-semibold text-gray-900 dark:text-white">
												{formatCurrency(Math.abs(expense.amount))}
											</p>
										</div>
										<button
											onClick={() => handleAddExpense(index)}
											disabled={saving}
											className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-xs font-medium transition-colors whitespace-nowrap">
											{saving ? "..." : "Add"}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Expenses List */}
			{expenses.length > 0 ? (
				<>
					{/* Desktop Table */}
					<div className="hidden sm:block bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Description
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Category
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Frequency
										</th>
										<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Per Occurrence
										</th>
										<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Monthly Impact
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Count
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Last Occurrence
										</th>
										<th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
									{expenses.map((expense, index) => (
										<React.Fragment key={`${expense.description}-${index}`}>
											<tr
												className={
													editingIndex === index
														? "bg-blue-50 dark:bg-blue-900/20"
														: "hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
												}>
												<td className="px-6 py-4">
													{editingIndex === index ? (
														<input
															type="text"
															value={editedDescription}
															onChange={(e) => setEditedDescription(e.target.value)}
															className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-900 dark:text-white"
															placeholder="Vendor name..."
														/>
													) : (
														<div className="flex items-center gap-2 group">
															<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
																{expense.descriptionOverride || expense.description}
															</p>
															<button
																onClick={() => openRenameModal(expense.description)}
																className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
																title="Rename all expenses with this description">
																<Edit2 className="w-4 h-4" />
															</button>
															{expense.isCustom && (
																<span className="inline-block px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded whitespace-nowrap">
																	Custom
																</span>
															)}
														</div>
													)}
												</td>
												<td className="px-6 py-4">
													{editingIndex === index ? (
														<select
															value={editedCategory}
															onChange={(e) => setEditedCategory(e.target.value)}
															className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white">
															{allCategories.map((cat) => (
																<option key={cat} value={cat}>
																	{cat}
																</option>
															))}
														</select>
													) : editingCategoryIndex === index ? (
														<div className="flex items-center gap-2">
															<select
																value={editingCategoryValue}
																onChange={(e) => setEditingCategoryValue(e.target.value)}
																className="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-white">
																{allCategories.map((cat) => (
																	<option key={cat} value={cat}>
																		{cat}
																	</option>
																))}
															</select>
															<button
																onClick={() => handleSaveCategoryEdit(index, expense)}
																disabled={saving}
																className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded whitespace-nowrap">
																Save
															</button>
															<button
																onClick={() => setEditingCategoryIndex(null)}
																className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded">
																X
															</button>
														</div>
													) : (
														<div className="flex items-center gap-2 group">
															<span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
																{expense.categoryOverride || expense.category || "Other"}
															</span>
															<button
																onClick={() => handleEditCategoryClick(index, expense)}
																className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
																title="Edit category">
																<Edit2 className="w-4 h-4" />
															</button>
														</div>
													)}
												</td>
												<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 capitalize">
													{expense.frequency}
												</td>
												<td className="px-6 py-4 text-right">
													<p className="text-sm font-medium text-gray-900 dark:text-white">
														{formatCurrency(Math.abs(expense.amount))}
													</p>
												</td>
												<td className="px-6 py-4 text-right">
													<p className="text-sm font-bold text-red-600 dark:text-red-400">
														{formatCurrency(Math.abs(expense.monthlyAmount))}
													</p>
												</td>
												<td className="px-6 py-4">
													<span className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
														{expense.count}x
													</span>
												</td>
												<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
													{expense.lastOccurrence.toLocaleDateString()}
												</td>
												<td className="px-6 py-4">
													<div className="flex items-center gap-2 justify-center">
														{editingIndex === index ? (
															<>
																<button
																	onClick={() => handleSaveEdit(index, expense)}
																	disabled={saving}
																	className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded">
																	Save
																</button>
																<button
																	onClick={() => setEditingIndex(null)}
																	className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded">
																	Cancel
																</button>
															</>
														) : (
															<>
																<button
																	onClick={() => handleEditClick(index, expense)}
																	className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors min-h-8 min-w-8 flex items-center justify-center">
																	<Edit2 className="w-4 h-4" />
																</button>
																<button
																	onClick={() => handleDelete(index)}
																	className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded font-medium">
																	Delete
																</button>
															</>
														)}
													</div>
												</td>
											</tr>
											{expandedIndex === index && (
												<tr className="bg-gray-50 dark:bg-slate-800/50">
													<td colSpan={8} className="px-6 py-4">
														<div className="text-xs text-gray-600 dark:text-gray-400">
															<p className="font-semibold mb-2">Grouped with similar charges:</p>
															<p>Charge amount: {formatCurrency(Math.abs(expense.amount))} (±1%)</p>
															<p>Vendor: {expense.description}</p>
															<p className="mt-2 text-gray-500">
																Click to expand more details about all grouped transactions
															</p>
														</div>
													</td>
												</tr>
											)}
										</React.Fragment>
									))}
								</tbody>
							</table>
						</div>

						{/* Total Footer */}
						<div className="bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end">
							<div className="text-right">
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Monthly Expenses</p>
								<p className="text-2xl font-bold text-red-600 dark:text-red-400">
									{formatCurrency(totalMonthlyExpenses)}
								</p>
							</div>
						</div>
					</div>

					{/* Mobile Cards */}
					<div className="sm:hidden space-y-3">
						{expenses.map((expense, index) => (
							<div
								key={expense.description}
								className="relative bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
								{mobileEditingIndex === index ? (
									<div className="p-4 space-y-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
												Expense Name
											</label>
											<input
												type="text"
												value={mobileEditDescription}
												onChange={(e) => setMobileEditDescription(e.target.value)}
												className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-900 dark:text-white"
												placeholder="Expense name..."
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
												Category
											</label>
											<select
												value={mobileEditCategory}
												onChange={(e) => setMobileEditCategory(e.target.value)}
												className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-sm text-gray-900 dark:text-white">
												{allCategories.map((cat) => (
													<option key={cat} value={cat}>
														{cat}
													</option>
												))}
											</select>
										</div>
										<div className="flex gap-2">
											<button
												onClick={() => handleMobileSaveEdit(index, expense)}
												className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium">
												Save
											</button>
											<button
												onClick={() => setMobileEditingIndex(null)}
												className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded font-medium">
												Cancel
											</button>
										</div>
									</div>
								) : (
									<>
										<div
											onTouchStart={handleMobileTouchStart}
											onTouchEnd={(e) => handleMobileTouchEnd(e, index)}
											className={`p-4 transition-all duration-300 ${swipedIndex === index ? "-translate-x-24" : ""}`}>
											<div className="space-y-3">
												{/* Description and category */}
												<div>
													<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
														{expense.descriptionOverride || expense.description}
													</p>
													<span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
														{expense.categoryOverride || expense.category || "Other"}
													</span>
												</div>

												{/* Monthly impact highlight */}
												<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
													<p className="text-xs text-red-600 dark:text-red-400">Monthly Impact</p>
													<p className="text-lg font-bold text-red-700 dark:text-red-300">
														{formatCurrency(Math.abs(expense.monthlyAmount))}
													</p>
												</div>

												{/* Details grid */}
												<div className="grid grid-cols-2 gap-3 text-xs">
													<div>
														<p className="text-gray-600 dark:text-gray-400">Per Occurrence</p>
														<p className="font-medium text-gray-900 dark:text-white">
															{formatCurrency(Math.abs(expense.amount))}
														</p>
													</div>
													<div>
														<p className="text-gray-600 dark:text-gray-400">Frequency</p>
														<p className="font-medium text-gray-900 dark:text-white capitalize">{expense.frequency}</p>
													</div>
													<div>
														<p className="text-gray-600 dark:text-gray-400">Count</p>
														<p className="font-medium text-gray-900 dark:text-white">{expense.count}x</p>
													</div>
													<div>
														<p className="text-gray-600 dark:text-gray-400">Last Occurrence</p>
														<p className="font-medium text-gray-900 dark:text-white">
															{expense.lastOccurrence.toLocaleDateString()}
														</p>
													</div>
												</div>
											</div>
										</div>
										{/* Swipe action buttons */}
										{swipedIndex === index && (
											<div className="absolute right-0 top-0 h-full flex items-center gap-2 bg-white dark:bg-slate-800 pr-4">
												<button
													onClick={() => handleMobileEdit(index, expense)}
													className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
													<Edit2 className="w-5 h-5" />
												</button>
												<button
													onClick={() => handleDelete(index)}
													className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded font-medium">
													Delete
												</button>
											</div>
										)}
									</>
								)}
							</div>
						))}
					</div>
				</>
			) : (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<AlertCircle className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Recurring Expenses Found</h2>
					<p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
						Upload your bank statements to identify recurring expenses and subscription services.
					</p>
				</div>
			)}

			{/* Info Section */}
			<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 sm:p-6">
				<h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">How This Works</h3>
				<ul className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 space-y-2">
					<li>
						<strong>Detection:</strong> Recurring transactions appearing 2+ times are analyzed for patterns
					</li>
					<li>
						<strong>Frequency Analysis:</strong> Time gaps between transactions determine if it's weekly, biweekly,
						monthly, or other
					</li>
					<li>
						<strong>Category Assignment:</strong> Transactions are categorized based on keywords and merchant names
					</li>
					<li>
						<strong>Monthly Calculation:</strong> Per-occurrence amounts are converted to monthly equivalents
						<ul className="mt-1 ml-4 space-y-1">
							<li>Weekly: amount × (52 ÷ 12) = monthly</li>
							<li>Biweekly: amount × (26 ÷ 12) = monthly</li>
							<li>Semi-Monthly: amount × 2 = monthly</li>
							<li>Monthly: amount = monthly</li>
						</ul>
					</li>
					<li>
						<strong>Examples:</strong>
						<ul className="mt-1 ml-4 space-y-1">
							<li>$50 biweekly Netflix = $50 × 2.167 = $108.33/month</li>
							<li>$350 biweekly insurance = $350 × 2.167 = $758.33/month</li>
						</ul>
					</li>
				</ul>
			</div>

			{/* Rename Modal */}
			{renameModal.isOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rename Expense</h2>
						<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
							This will rename all {renameModal.count} expense{renameModal.count !== 1 ? "s" : ""} with this description
						</p>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Name</label>
								<input
									type="text"
									value={renameModal.newDescription}
									onChange={(e) => setRenameModal({ ...renameModal, newDescription: e.target.value })}
									className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white"
									placeholder="Enter new name..."
									autoFocus
								/>
							</div>
						</div>

						<div className="flex gap-2 justify-end mt-6">
							<button
								type="button"
								onClick={() =>
									setRenameModal({
										isOpen: false,
										oldDescription: "",
										newDescription: "",
										count: 0,
									})
								}
								className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors">
								Cancel
							</button>
							<button
								onClick={handleRenameExpense}
								disabled={renaming || !renameModal.newDescription.trim()}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors">
								{renaming ? "Renaming..." : "Rename"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Instructions Modal */}
			{showInstructions && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
						<div>
							<h2 className="text-xl font-semibold text-gray-900 dark:text-white">Welcome to Monthly Expenses!</h2>
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Here's a quick guide to get you started:</p>
						</div>

						<div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
							<div className="flex gap-3">
								<div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
									1
								</div>
								<div>
									<p className="font-medium text-gray-900 dark:text-white">Desktop: Edit in Table</p>
									<p className="text-xs text-gray-600 dark:text-gray-400">
										Hover over descriptions to see the edit icon. Click to rename all matching expenses.
									</p>
								</div>
							</div>

							<div className="flex gap-3">
								<div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
									2
								</div>
								<div>
									<p className="font-medium text-gray-900 dark:text-white">Mobile: Swipe to Edit/Delete</p>
									<p className="text-xs text-gray-600 dark:text-gray-400">
										Swipe left on any card to reveal edit and delete options. Swipe right to close.
									</p>
								</div>
							</div>

							<div className="flex gap-3">
								<div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
									3
								</div>
								<div>
									<p className="font-medium text-gray-900 dark:text-white">Detected Expenses</p>
									<p className="text-xs text-gray-600 dark:text-gray-400">
										Expand "Detected Recurring Expenses" to add more transactions to your monthly budget.
									</p>
								</div>
							</div>

							<div className="flex gap-3">
								<div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
									4
								</div>
								<div>
									<p className="font-medium text-gray-900 dark:text-white">Non-Destructive</p>
									<p className="text-xs text-gray-600 dark:text-gray-400">
										Deleting an expense just removes it from this page—it won't affect your transaction history.
									</p>
								</div>
							</div>
						</div>

						<button
							onClick={handleDismissInstructions}
							className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
							Got It!
						</button>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			<ConfirmModal
				isOpen={deleteModal.isOpen}
				title="Delete Expense"
				message="Are you sure you want to remove this expense from your monthly list? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
				isDangerous={true}
				isLoading={deleting}
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteModal({ isOpen: false, index: null })}
			/>
		</div>
	);
}
