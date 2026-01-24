"use client";

import { useState, useEffect } from "react";
import { Transaction, TransactionCategory } from "@/types";
import { getTransactions, updateTransaction, getCustomCategories } from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, Save } from "lucide-react";

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

interface CategoryGroup {
	name: string;
	count: number;
	transactions: (Partial<Transaction> & { id: string })[];
}

export default function CategoryManagementPage() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
	const [expandedCategory, setExpandedCategory] = useState<string | null>("Other");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string>("");
	const [saving, setSaving] = useState(false);
	const [allCategories, setAllCategories] = useState<string[]>(COMMON_CATEGORIES);

	// Load and group transactions by category, and load custom categories
	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		const loadAndGroupTransactions = async () => {
			try {
				// Load custom categories
				const customCats = await getCustomCategories(user.uid);
				const customCategoryNames = customCats.map((c) => c.name || "").filter((n) => n);

				const allTransactions = await getTransactions(user.uid);

				// Get all unique categories from transactions
				const categoriesFromTransactions = Array.from(new Set(allTransactions.map((t) => t.category || "Other")));

				// Merge all categories: common + custom + those found in transactions
				const merged = Array.from(
					new Set([...COMMON_CATEGORIES, ...customCategoryNames, ...categoriesFromTransactions]),
				);
				setAllCategories(merged);

				// Group by category
				const grouped: Record<string, (Partial<Transaction> & { id: string })[]> = {};
				allTransactions.forEach((t) => {
					const cat = t.category || "Other";
					if (!grouped[cat]) {
						grouped[cat] = [];
					}
					grouped[cat].push(t);
				});

				// Sort by count descending
				const groups = Object.entries(grouped)
					.map(([name, transactions]) => ({
						name,
						count: transactions.length,
						transactions: transactions.sort(
							(a, b) =>
								(b.date instanceof Date ? b.date.getTime() : 0) - (a.date instanceof Date ? a.date.getTime() : 0),
						),
					}))
					.sort((a, b) => b.count - a.count);

				setCategoryGroups(groups);
			} catch (err) {
				console.error("Failed to load transactions:", err);
			} finally {
				setLoading(false);
			}
		};

		loadAndGroupTransactions();
	}, [user?.uid]);

	const handleSaveCategory = async (transactionId: string, newCategory: string) => {
		if (!user?.uid) return;

		setSaving(true);
		try {
			await updateTransaction(user.uid, transactionId, { category: newCategory as TransactionCategory });

			// Update local state
			setCategoryGroups((prev) =>
				prev.map((group) => ({
					...group,
					transactions: group.transactions.filter((t) => t.id !== transactionId),
				})),
			);

			// Add to new category
			setCategoryGroups((prev) => {
				const updated = [...prev];
				const newGroup = updated.find((g) => g.name === newCategory);
				const oldGroup = updated.find((g) => g.name === expandedCategory);

				if (oldGroup) {
					const transaction = oldGroup.transactions.find((t) => t.id === transactionId);
					if (transaction) {
						oldGroup.transactions = oldGroup.transactions.filter((t) => t.id !== transactionId);
						oldGroup.count--;

						if (newGroup) {
							newGroup.transactions.unshift(transaction);
							newGroup.count++;
						} else {
							updated.push({
								name: newCategory,
								count: 1,
								transactions: [transaction],
							});
						}

						// Re-sort groups by count
						updated.sort((a, b) => b.count - a.count);
					}
				}

				return updated;
			});

			setEditingId(null);
		} catch (err) {
			console.error("Failed to update transaction:", err);
			console.error("Error details:", {
				transactionId,
				newCategory,
				message: err instanceof Error ? err.message : String(err),
			});
			alert("Failed to update category. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Categories</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">
					View transactions by category and recategorize as needed
				</p>
			</div>

			{/* Category Summary Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
				{categoryGroups.map((group) => (
					<button
						key={group.name}
						onClick={() => setExpandedCategory(expandedCategory === group.name ? null : group.name)}
						className={`p-3 rounded-lg border-2 transition-all text-center ${
							expandedCategory === group.name
								? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
								: "border-gray-200 dark:border-slate-600 hover:border-blue-300"
						}`}>
						<div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{group.count}</div>
						<div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{group.name}</div>
					</button>
				))}
			</div>

			{/* Transaction List for Selected Category */}
			{expandedCategory && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
					<div className="bg-gray-50 dark:bg-slate-900 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-slate-700">
						<h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
							{expandedCategory} ({categoryGroups.find((g) => g.name === expandedCategory)?.count || 0})
						</h2>
					</div>

					<div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-96 overflow-y-auto">
						{categoryGroups
							.find((g) => g.name === expandedCategory)
							?.transactions.map((transaction) => (
								<div
									key={transaction.id}
									className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
									<div className="flex-1 min-w-0">
										<div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 gap-1 mb-1">
											<p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base break-words">
												{transaction.description || "Unnamed"}
											</p>
											<p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
												${((transaction.amount || 0) / 100).toFixed(2)}
											</p>
										</div>
										<p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
											{transaction.date instanceof Date
												? transaction.date.toLocaleDateString()
												: new Date(transaction.date as any).toLocaleDateString()}
										</p>
									</div>

									{editingId === transaction.id ? (
										<div className="flex flex-col sm:flex-row gap-2 min-w-0 w-full sm:w-auto">
											<select
												value={selectedCategory}
												onChange={(e) => setSelectedCategory(e.target.value)}
												className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm w-full sm:w-auto">
												<option value="">Select category...</option>
												{allCategories.map((cat) => (
													<option key={cat} value={cat}>
														{cat}
													</option>
												))}
											</select>
											<div className="flex gap-2">
												<button
													onClick={() => handleSaveCategory(transaction.id, selectedCategory)}
													disabled={saving || !selectedCategory}
													className="flex-1 sm:flex-initial px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded flex items-center justify-center gap-1">
													<Save className="w-4 h-4" />
													<span className="hidden sm:inline">Save</span>
												</button>
												<button
													onClick={() => setEditingId(null)}
													className="flex-1 sm:flex-initial px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded">
													Cancel
												</button>
											</div>
										</div>
									) : (
										<button
											onClick={() => {
												setEditingId(transaction.id);
												setSelectedCategory(transaction.category || "Other");
											}}
											className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded whitespace-nowrap w-full sm:w-auto">
											Change
										</button>
									)}
								</div>
							))}
					</div>
				</div>
			)}

			{categoryGroups.length === 0 && (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<p className="text-gray-600 dark:text-gray-400">No transactions to categorize yet.</p>
				</div>
			)}
		</div>
	);
}
