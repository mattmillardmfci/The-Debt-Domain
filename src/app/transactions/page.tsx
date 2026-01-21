"use client";

import Link from "next/link";
import { Plus, Trash2, Edit2, Edit3, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Transaction, TransactionCategory } from "@/types";
import {
	getTransactionsPaginated,
	deleteTransaction,
	updateTransaction,
	bulkRenameTransactionDescription,
	getCustomCategories,
} from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";
import { QueryDocumentSnapshot } from "firebase/firestore";

const COMMON_CATEGORIES = [
	"Groceries",
	"Restaurants",
	"Gas/Fuel",
	"Utilities",
	"Entertainment",
	"Shopping",
	"Healthcare",
	"Transportation",
	"Housing",
	"Insurance",
	"Salary",
	"Transfer",
	"Other",
];

export default function TransactionsPage() {
	const { user } = useAuth();
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

	// Load more transactions
	const handleLoadMore = async () => {
		if (!user?.uid || !lastDoc || loadingMore) return;

		setLoadingMore(true);
		try {
			const result = await getTransactionsPaginated(user.uid, 50, lastDoc);
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
		if (!user?.uid) return;

		if (!confirm("Are you sure you want to delete this transaction?")) {
			return;
		}

		try {
			await deleteTransaction(user.uid, transactionId);
			setTransactions(transactions.filter((t) => t.id !== transactionId));
		} catch (err) {
			console.error("Failed to delete transaction:", err);
			alert("Failed to delete transaction. Please try again.");
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
			alert("Failed to update category. Please try again.");
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
		} catch (err) {
			console.error("Failed to rename transactions:", err);
			alert("Failed to rename transactions. Please try again.");
		} finally {
			setRenaming(false);
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
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						Showing {transactions.length} {hasMore ? `of many` : `transactions`}
					</p>
				</div>
				<Link
					href="/transactions/upload"
					className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
					<Plus className="w-5 h-5" />
					Upload More
				</Link>
			</div>

			{/* Transaction Table */}
			<div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
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
						{transactions.map((t) => (
							<tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
								<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
									{t.date instanceof Date ? t.date.toLocaleDateString() : new Date(t.date as any).toLocaleDateString()}
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
									<button
										onClick={() => handleDeleteTransaction(t.id)}
										className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
										<Trash2 className="w-4 h-4" />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Load More Button */}
			{hasMore && (
				<div className="flex justify-center">
					<button
						onClick={handleLoadMore}
						disabled={loadingMore}
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors">
						{loadingMore ? "Loading more..." : "Load More Transactions"}
					</button>
				</div>
			)}

			{!hasMore && transactions.length > 0 && (
				<p className="text-sm text-gray-600 dark:text-gray-400 text-center">
					You've loaded all {transactions.length} transactions
				</p>
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

							<div className="flex gap-3 justify-end mt-6">
								<button
									onClick={() => setRenameModal({ isOpen: false, oldDescription: "", newDescription: "", count: 0 })}
									disabled={renaming}
									className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors disabled:opacity-50">
									Cancel
								</button>
								<button
									onClick={handleRenameTransaction}
									disabled={
										renaming ||
										!renameModal.newDescription.trim() ||
										renameModal.newDescription === renameModal.oldDescription
									}
									className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors">
									{renaming ? "Renaming..." : "Rename All"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
