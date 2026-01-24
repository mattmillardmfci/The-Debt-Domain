"use client";

import Link from "next/link";
import { Plus, Edit2, Edit3, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Transaction, TransactionCategory } from "@/types";
import {
	getTransactionsPaginated,
	getAllTransactions,
	deleteTransaction,
	updateTransaction,
	bulkRenameTransactionDescription,
	getCustomCategories,
	saveTransaction,
	saveCustomRecurringExpense,
} from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { COMMON_CATEGORIES } from "@/lib/constants";
import ConfirmModal from "@/components/ConfirmModal";

export default function TransactionsPage() {
	const { user } = useAuth();
	const { showError, showSuccess } = useAlert();
	const [transactions, setTransactions] = useState<(Partial<Transaction> & { id: string })[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [totalCount, setTotalCount] = useState(0);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [newCategory, setNewCategory] = useState("");
	const [saving, setSaving] = useState(false);
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
	const [allCategories, setAllCategories] = useState<string[]>(COMMON_CATEGORIES);
	const [addTransactionModal, setAddTransactionModal] = useState(false);
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; transactionId: string | null }>({
		isOpen: false,
		transactionId: null,
	});
	const [deleting, setDeleting] = useState(false);
	const [newTransaction, setNewTransaction] = useState({
		date: new Date().toISOString().split("T")[0],
		description: "",
		amount: "",
		category: "Other" as TransactionCategory,
	});
	const [savingTransaction, setSavingTransaction] = useState(false);
	const [addingToExpenses, setAddingToExpenses] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"list" | "by-month">("list");
	const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	// Filter transactions based on search query
	const filteredTransactions = transactions.filter((t) => {
		if (!searchQuery.trim()) return true;
		const query = searchQuery.toLowerCase();
		return (
			(t.description?.toLowerCase().includes(query) ?? false) ||
			(t.category?.toLowerCase().includes(query) ?? false) ||
			(((t.amount || 0) / 100).toFixed(2).includes(query) ?? false)
		);
	});

	// Group transactions by month and category (uses full transactions array, not filtered)
	const getGroupedTransactions = () => {
		const grouped: { [month: string]: { [category: string]: (Partial<Transaction> & { id: string })[] } } = {};

		transactions.forEach((t) => {
			const date = t.date instanceof Date ? t.date : new Date(t.date as any);
			const monthKey = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });

			if (!grouped[monthKey]) {
				grouped[monthKey] = {};
			}

			const category = (t.category || "Uncategorized") as string;
			if (!grouped[monthKey][category]) {
				grouped[monthKey][category] = [];
			}

			grouped[monthKey][category].push(t);
		});

		return grouped;
	};

	const getCategoryTotal = (transactions: (Partial<Transaction> & { id: string })[]) => {
		return transactions.reduce((sum, t) => sum + (t.amount || 0), 0) / 100;
	};

	const getMonthTotal = (categoryTransactions: { [category: string]: (Partial<Transaction> & { id: string })[] }) => {
		return Object.values(categoryTransactions).reduce((sum, transactions) => sum + getCategoryTotal(transactions), 0);
	};

	const toggleMonth = (month: string) => {
		const newExpanded = new Set(expandedMonths);
		if (newExpanded.has(month)) {
			newExpanded.delete(month);
		} else {
			newExpanded.add(month);
		}
		setExpandedMonths(newExpanded);
	};

	// Initial load - get first page of transactions (50 most recent)
	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		const loadTransactions = async () => {
			try {
				// Load custom categories and merge with common categories
				const customCats = await getCustomCategories(user.uid);
				const customCategoryNames = customCats.map((c) => c.name || "").filter((n) => n);
				const merged = Array.from(new Set([...COMMON_CATEGORIES, ...customCategoryNames]));
				setAllCategories(merged);

				const result = await getTransactionsPaginated(user.uid, 50);
				setTransactions(result.transactions);
				setLastDoc(result.lastDoc);
				setHasMore(result.hasMore);
				setTotalCount(result.transactions.length);
			} catch (err) {
				console.error("Failed to load transactions:", err);
			} finally {
				setLoading(false);
			}
		};

		loadTransactions();
	}, [user?.uid]);

	// When switching to By Month view, load all transactions
	useEffect(() => {
		if (viewMode === "by-month" && user?.uid && transactions.length > 0) {
			const loadAllForMonth = async () => {
				try {
					const allTransactions = await getAllTransactions(user.uid);
					setTransactions(allTransactions);
				} catch (err) {
					console.error("Failed to load all transactions for by-month view:", err);
				}
			};
			loadAllForMonth();
		}
	}, [viewMode, user?.uid]);

	// Load more transactions
	const handleLoadMore = async () => {
		if (!user?.uid || !lastDoc || loadingMore) return;

		setLoadingMore(true);
		try {
			const result = await getTransactionsPaginated(user.uid, 50, lastDoc);
			// Clear search when loading more so users see the newly loaded transactions
			setSearchQuery("");
			// Append new transactions to the full list
			setTransactions((prev) => [...prev, ...result.transactions]);
			setLastDoc(result.lastDoc);
			setHasMore(result.hasMore);
			setTotalCount((prev) => prev + result.transactions.length);
		} catch (err) {
			console.error("Failed to load more transactions:", err);
		} finally {
			setLoadingMore(false);
		}
	};

	const handleDeleteTransaction = async (transactionId: string) => {
		setDeleteModal({ isOpen: true, transactionId });
	};

	const handleConfirmDelete = async () => {
		if (!user?.uid || !deleteModal.transactionId) return;

		setDeleting(true);
		try {
			await deleteTransaction(user.uid, deleteModal.transactionId);
			setTransactions(transactions.filter((t) => t.id !== deleteModal.transactionId));
			setDeleteModal({ isOpen: false, transactionId: null });
			showSuccess("Transaction deleted successfully");
		} catch (err) {
			console.error("Failed to delete transaction:", err);
			showError("Failed to delete transaction. Please try again.");
		} finally {
			setDeleting(false);
		}
	};

	const handleSaveCategory = async (transactionId: string) => {
		if (!user?.uid || !newCategory) return;

		setSaving(true);
		try {
			await updateTransaction(user.uid, transactionId, { category: newCategory as TransactionCategory });
			setTransactions(
				transactions.map((t) => (t.id === transactionId ? { ...t, category: newCategory as TransactionCategory } : t)),
			);
			setEditingId(null);
		} catch (err) {
			console.error("Failed to update category:", err);
			showError("Failed to update category. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	const openRenameModal = (description: string) => {
		const count = transactions.filter((t) => t.description === description).length;
		setRenameModal({
			isOpen: true,
			oldDescription: description,
			newDescription: description,
			count,
		});
	};

	const handleRenameTransaction = async () => {
		if (!user?.uid || !renameModal.newDescription.trim()) return;

		setRenaming(true);
		try {
			await bulkRenameTransactionDescription(user.uid, renameModal.oldDescription, renameModal.newDescription.trim());
			// Update local transactions
			setTransactions(
				transactions.map((t) =>
					t.description === renameModal.oldDescription ? { ...t, description: renameModal.newDescription.trim() } : t,
				),
			);
			setRenameModal({ isOpen: false, oldDescription: "", newDescription: "", count: 0 });
			showSuccess("Transactions renamed successfully");
		} catch (err) {
			console.error("Failed to rename transactions:", err);
			showError("Failed to rename transactions. Please try again.");
		} finally {
			setRenaming(false);
		}
	};

	const handleAddTransaction = async () => {
		if (!user?.uid || !newTransaction.description.trim() || !newTransaction.amount) {
			showError("Please fill in all fields");
			return;
		}

		setSavingTransaction(true);
		try {
			const amountInCents = Math.round(parseFloat(newTransaction.amount) * 100);
			const transactionDate = new Date(newTransaction.date);

			const transaction: Partial<Transaction> = {
				userId: user.uid,
				date: transactionDate,
				description: newTransaction.description.trim(),
				amount: amountInCents,
				category: newTransaction.category,
				categoryConfirmed: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			await saveTransaction(user.uid, transaction);

			// Reset form and close modal
			setNewTransaction({
				date: new Date().toISOString().split("T")[0],
				description: "",
				amount: "",
				category: "Other" as TransactionCategory,
			});
			setAddTransactionModal(false);

			// Reload transactions
			const result = await getTransactionsPaginated(user.uid, 50);
			setTransactions(result.transactions);
			setLastDoc(result.lastDoc);
			setHasMore(result.hasMore);
			showSuccess("Transaction added successfully");
		} catch (err) {
			console.error("Failed to save transaction:", err);
			showError("Failed to save transaction. Please try again.");
		} finally {
			setSavingTransaction(false);
		}
	};

	const handleAddToMonthlyExpenses = async (transaction: Partial<Transaction> & { id: string }) => {
		if (!user?.uid) {
			showError("Please log in");
			return;
		}

		setAddingToExpenses(transaction.id);
		try {
			const amountInDollars = (transaction.amount || 0) / 100;

			// Save as custom recurring expense
			await saveCustomRecurringExpense(user.uid, {
				description: transaction.description || "Unknown",
				amount: amountInDollars,
				frequency: "monthly",
				category: (transaction.category as string) || "Other",
				lastOccurrence: transaction.date instanceof Date ? transaction.date : new Date(transaction.date || ""),
				count: 1, // Single transaction marked as recurring
			});

			showSuccess(`"${transaction.description}" added to your monthly expenses!`);
		} catch (err) {
			console.error("Failed to add to monthly expenses:", err);
			showError("Failed to add expense. Please try again.");
		} finally {
			setAddingToExpenses(null);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	if (transactions.length === 0) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">View and categorize your transactions</p>
				</div>

				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">No Transactions Yet</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Upload a bank statement to get started with transaction analysis
					</p>
					<Link
						href="/transactions/upload"
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						<Plus className="w-5 h-5" />
						Upload Statement
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
					<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
						Showing {transactions.length} {hasMore ? `of many` : `transactions`}
					</p>
				</div>
				<div className="flex gap-2 flex-wrap sm:flex-nowrap sm:gap-3">
					<button
						onClick={() => setAddTransactionModal(true)}
						className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors text-sm min-h-11">
						<Plus className="w-4 h-4" />
						<span className="hidden sm:inline">Add Custom</span>
						<span className="sm:hidden">Add</span>
					</button>
					<Link
						href="/transactions/upload"
						className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm min-h-11">
						<Plus className="w-4 h-4" />
						<span className="hidden sm:inline">Upload More</span>
						<span className="sm:hidden">Upload</span>
					</Link>
				</div>
			</div>

			{/* Search Bar */}
			<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
				<input
					type="text"
					placeholder="Search transactions by description, category, or amount..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
				{searchQuery && (
					<p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
						Showing {filteredTransactions.length} of {transactions.length} transactions
					</p>
				)}
			</div>

			{/* View Mode Toggle */}
			<div className="flex gap-2 border-b border-gray-200 dark:border-slate-700">
				<button
					onClick={() => setViewMode("list")}
					className={`px-4 py-2 text-sm font-medium transition-colors ${
						viewMode === "list"
							? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
							: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
					}`}>
					List View
				</button>
				<button
					onClick={() => setViewMode("by-month")}
					className={`px-4 py-2 text-sm font-medium transition-colors ${
						viewMode === "by-month"
							? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
							: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
					}`}>
					By Month
				</button>
			</div>

			{/* Grouped by Month View */}
			{viewMode === "by-month" && (
				<div className="space-y-4">
					{Object.entries(getGroupedTransactions())
						.sort(([monthA], [monthB]) => {
							const dateA = new Date(monthA);
							const dateB = new Date(monthB);
							return dateB.getTime() - dateA.getTime();
						})
						.map(([month, categories]) => (
							<div
								key={month}
								className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
								<button
									onClick={() => toggleMonth(month)}
									className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
									<div className="text-left">
										<h3 className="font-semibold text-gray-900 dark:text-white">{month}</h3>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											Total: ${getMonthTotal(categories).toFixed(2)}
										</p>
									</div>
									<span
										className={`text-gray-400 transition-transform ${expandedMonths.has(month) ? "rotate-180" : ""}`}>
										▼
									</span>
								</button>

								{expandedMonths.has(month) && (
									<div className="border-t border-gray-200 dark:border-slate-700">
										{Object.entries(categories)
											.sort(([catA], [catB]) => catA.localeCompare(catB))
											.map(([category, categoryTransactions]) => (
												<div key={category} className="border-b border-gray-200 dark:border-slate-700 last:border-b-0">
													<div className="px-6 py-3 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
														<h4 className="font-medium text-gray-900 dark:text-white text-sm">{category}</h4>
														<span className="text-sm font-semibold text-gray-900 dark:text-white">
															${getCategoryTotal(categoryTransactions).toFixed(2)}
														</span>
													</div>
													<div className="divide-y divide-gray-200 dark:divide-slate-700">
														{categoryTransactions.map((t) => (
															<div key={t.id} className="px-6 py-3 flex justify-between items-center text-sm">
																<div>
																	<p className="text-gray-900 dark:text-white">{t.description}</p>
																	<p className="text-xs text-gray-500 dark:text-gray-400">
																		{t.date instanceof Date
																			? t.date.toLocaleDateString()
																			: new Date(t.date as any).toLocaleDateString()}
																	</p>
																</div>
																<span className="font-medium text-gray-900 dark:text-white">
																	${((t.amount || 0) / 100).toFixed(2)}
																</span>
															</div>
														))}
													</div>
												</div>
											))}
									</div>
								)}
							</div>
						))}
				</div>
			)}

			{/* Transaction Table - Desktop (List View) */}
			{viewMode === "list" && (
				<div className="hidden sm:block overflow-x-auto bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
					<table className="w-full">
						<thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
									Date
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
									Description
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
									Category
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
									Amount
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
									Action
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
							{filteredTransactions.map((t) => (
								<tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
									<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
										{t.date instanceof Date
											? t.date.toLocaleDateString()
											: new Date(t.date as any).toLocaleDateString()}
									</td>
									<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
										<div className="flex items-center justify-between group">
											<span>{t.description}</span>
											<button
												onClick={() => openRenameModal(t.description || "Unknown")}
												className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all ml-2"
												title="Rename all transactions with this description">
												<Edit3 className="w-4 h-4" />
											</button>
										</div>
									</td>
									<td className="px-6 py-4 text-sm">
										{editingId === t.id ? (
											<div className="flex gap-2">
												<select
													value={newCategory}
													onChange={(e) => setNewCategory(e.target.value)}
													className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs">
													<option value="">Select category...</option>
													{allCategories.map((cat) => (
														<option key={cat} value={cat}>
															{cat}
														</option>
													))}
												</select>
												<button
													onClick={() => handleSaveCategory(t.id)}
													disabled={saving}
													className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded">
													Save
												</button>
												<button
													onClick={() => setEditingId(null)}
													className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded">
													Cancel
												</button>
											</div>
										) : (
											<button
												onClick={() => {
													setEditingId(t.id);
													setNewCategory(t.category || "Other");
												}}
												className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium flex items-center gap-1">
												<Edit2 className="w-3 h-3" />
												{t.category || "Other"}
											</button>
										)}
									</td>
									<td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
										${((t.amount || 0) / 100).toFixed(2)}
									</td>
									<td className="px-6 py-4 text-sm text-right">
										<div className="flex items-center justify-end gap-2">
											<button
												onClick={() => handleAddToMonthlyExpenses(t)}
												disabled={addingToExpenses === t.id}
												title="Add to monthly recurring expenses"
												className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors min-h-10 min-w-10 flex items-center justify-center disabled:opacity-50">
												{addingToExpenses === t.id ? (
													<span className="text-xs font-medium">...</span>
												) : (
													<Plus className="w-4 h-4" />
												)}
											</button>
											<button
												onClick={() => handleDeleteTransaction(t.id)}
												className="px-3 py-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded-full text-xs font-medium">
												Delete
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Transaction Cards - Mobile (List View) */}
			{viewMode === "list" && (
				<div className="sm:hidden space-y-3">
					{filteredTransactions.map((t) => (
						<div
							key={t.id}
							className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
							<div className="space-y-3">
								{/* Header with date and amount */}
								<div className="flex justify-between items-start">
									<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
										{t.date instanceof Date
											? t.date.toLocaleDateString()
											: new Date(t.date as any).toLocaleDateString()}
									</span>
									<span className="text-sm font-bold text-gray-900 dark:text-gray-100">
										${((t.amount || 0) / 100).toFixed(2)}
									</span>
								</div>

								{/* Description */}
								<div>
									<p className="text-sm text-gray-700 dark:text-gray-300 break-words">{t.description}</p>
									<button
										onClick={() => openRenameModal(t.description || "Unknown")}
										className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
										<Edit3 className="w-3 h-3" />
										Rename all
									</button>
								</div>

								{/* Category and Action */}
								<div className="flex gap-2 flex-wrap items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
									<div className="flex-1">
										{editingId === t.id ? (
											<div className="flex gap-2 flex-wrap">
												<select
													value={newCategory}
													onChange={(e) => setNewCategory(e.target.value)}
													className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs flex-1 min-w-28">
													<option value="">Select category...</option>
													{allCategories.map((cat) => (
														<option key={cat} value={cat}>
															{cat}
														</option>
													))}
												</select>
												<button
													onClick={() => handleSaveCategory(t.id)}
													disabled={saving}
													className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded">
													Save
												</button>
												<button
													onClick={() => setEditingId(null)}
													className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded">
													Cancel
												</button>
											</div>
										) : (
											<button
												onClick={() => {
													setEditingId(t.id);
													setNewCategory(t.category || "Other");
												}}
												className="w-full px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded text-xs font-medium flex items-center justify-center gap-1 min-h-10">
												<Edit2 className="w-3 h-3" />
												{t.category || "Other"}
											</button>
										)}
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => handleAddToMonthlyExpenses(t)}
											disabled={addingToExpenses === t.id}
											title="Add to monthly recurring expenses"
											className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors min-h-10 min-w-10 flex items-center justify-center disabled:opacity-50">
											{addingToExpenses === t.id ? (
												<span className="text-xs font-medium">...</span>
											) : (
												<Plus className="w-4 h-4" />
											)}
										</button>
										<button
											onClick={() => handleDeleteTransaction(t.id)}
											className="px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 rounded text-xs font-medium min-h-10 flex-1">
											Delete
										</button>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Load More Button - Only in List View */}
			{viewMode === "list" && (
				<>
					{hasMore && (
						<div className="flex justify-center">
							<button
								onClick={handleLoadMore}
								disabled={loadingMore}
								className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors min-h-11">
								{loadingMore ? "Loading more..." : "Load More Transactions"}
							</button>
						</div>
					)}

					{!hasMore && transactions.length > 0 && (
						<p className="text-sm text-gray-600 dark:text-gray-400 text-center">
							You've loaded all {transactions.length} transactions
						</p>
					)}
				</>
			)}

			{/* Rename Modal */}
			{renameModal.isOpen && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-bold text-gray-900 dark:text-white">Rename Transaction Description</h2>
							<button
								onClick={() => setRenameModal({ isOpen: false, oldDescription: "", newDescription: "", count: 0 })}
								className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Current Description
								</label>
								<div className="p-3 bg-gray-100 dark:bg-slate-700 rounded border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100">
									{renameModal.oldDescription}
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									This description appears in {renameModal.count} transaction{renameModal.count !== 1 ? "s" : ""}
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									New Description
								</label>
								<input
									type="text"
									value={renameModal.newDescription}
									onChange={(e) =>
										setRenameModal({
											...renameModal,
											newDescription: e.target.value,
										})
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter new description"
								/>
							</div>

							<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm text-blue-800 dark:text-blue-300">
								Renaming will update the description for all {renameModal.count} transaction
								{renameModal.count !== 1 ? "s" : ""} with this name.
							</div>

							<div className="flex gap-3 justify-end mt-6 flex-col-reverse sm:flex-row">
								<button
									onClick={() => setRenameModal({ isOpen: false, oldDescription: "", newDescription: "", count: 0 })}
									disabled={renaming}
									className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors disabled:opacity-50 min-h-11">
									Cancel
								</button>
								<button
									onClick={handleRenameTransaction}
									disabled={
										renaming ||
										!renameModal.newDescription.trim() ||
										renameModal.newDescription === renameModal.oldDescription
									}
									className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors min-h-11">
									{renaming ? "Renaming..." : "Rename All"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Add Custom Transaction Modal */}
			{addTransactionModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg max-w-md w-full p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Custom Transaction</h2>
							<button
								onClick={() => setAddTransactionModal(false)}
								className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
								<input
									type="date"
									value={newTransaction.date}
									onChange={(e) =>
										setNewTransaction({
											...newTransaction,
											date: e.target.value,
										})
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
								<input
									type="text"
									value={newTransaction.description}
									onChange={(e) =>
										setNewTransaction({
											...newTransaction,
											description: e.target.value,
										})
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
									placeholder="e.g., Daycare - Weekly"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount</label>
								<div className="relative">
									<span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
									<input
										type="number"
										step="0.01"
										value={newTransaction.amount}
										onChange={(e) =>
											setNewTransaction({
												...newTransaction,
												amount: e.target.value,
											})
										}
										className="w-full px-3 py-2 pl-7 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										placeholder="0.00"
									/>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
								<select
									value={newTransaction.category}
									onChange={(e) =>
										setNewTransaction({
											...newTransaction,
											category: e.target.value as TransactionCategory,
										})
									}
									className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
									{allCategories.map((cat) => (
										<option key={cat} value={cat}>
											{cat}
										</option>
									))}
								</select>
							</div>

							<div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded p-3 text-sm text-emerald-800 dark:text-emerald-300">
								This transaction will be marked as categorized and will be included in your financial calculations.
							</div>

							<div className="flex gap-3 justify-end mt-6 flex-col-reverse sm:flex-row">
								<button
									onClick={() => setAddTransactionModal(false)}
									disabled={savingTransaction}
									className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors disabled:opacity-50 min-h-11">
									Cancel
								</button>
								<button
									onClick={handleAddTransaction}
									disabled={savingTransaction || !newTransaction.description.trim() || !newTransaction.amount}
									className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors min-h-11">
									{savingTransaction ? "Creating..." : "Create Transaction"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			<ConfirmModal
				isOpen={deleteModal.isOpen}
				title="Delete Transaction"
				message="Are you sure you want to delete this transaction? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
				isDangerous={true}
				isLoading={deleting}
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteModal({ isOpen: false, transactionId: null })}
			/>
		</div>
	);
}
