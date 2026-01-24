"use client";

import { useState, useEffect } from "react";
import { Budget, Transaction, TransactionCategory } from "@/types";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { saveBudget, deleteBudget, getTransactions, getCustomCategories } from "@/lib/firestoreService";
import { COMMON_CATEGORIES } from "@/lib/constants";

interface CategoryBudget {
	category: TransactionCategory;
	limit: number;
}

interface SpendingData {
	currentMonth: number;
	lastMonth: number;
	average: number;
}

export default function BudgetsPage() {
	const { user } = useAuth();
	const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
	const [loading, setLoading] = useState(true);
	const [transactions, setTransactions] = useState<(Partial<Transaction> & { id: string })[]>([]);
	const [showForm, setShowForm] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<TransactionCategory>("Groceries");
	const [budgetAmount, setBudgetAmount] = useState("");
	const [allCategories, setAllCategories] = useState<string[]>(COMMON_CATEGORIES);
	const [spendingData, setSpendingData] = useState<Record<TransactionCategory, SpendingData>>(
		{} as Record<TransactionCategory, SpendingData>,
	);

	// Load budgets and transactions
	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		const loadData = async () => {
			try {
				// Load custom categories and merge with common categories
				const customCats = await getCustomCategories(user.uid);
				const customCategoryNames = customCats.map((c) => c.name || "").filter((n) => n);
				const merged = Array.from(new Set([...COMMON_CATEGORIES, ...customCategoryNames]));
				setAllCategories(merged);

				// Load transactions to calculate spending
				const txns = await getTransactions(user.uid);
				setTransactions(txns);

				// Calculate spending by category and month
				calculateSpending(txns, merged);
			} catch (err) {
				console.error("Failed to load data:", err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [user?.uid]);

	const calculateSpending = (txns: (Partial<Transaction> & { id: string })[], categories: string[]) => {
		const now = new Date();
		const currentMonth = now.getMonth();
		const currentYear = now.getFullYear();
		const lastMonthDate = new Date(currentYear, currentMonth - 1);

		const spending: Record<string, SpendingData> = {};

		categories.forEach((cat) => {
			const catTransactions = txns.filter((t) => t.category === cat);

			// Current month
			const currentMonthTxns = catTransactions.filter((t) => {
				const date = t.date instanceof Date ? t.date : new Date(t.date as any);
				return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
			});
			const currentMonthTotal = currentMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

			// Last month
			const lastMonthTxns = catTransactions.filter((t) => {
				const date = t.date instanceof Date ? t.date : new Date(t.date as any);
				return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
			});
			const lastMonthTotal = lastMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

			// Average over all months
			const months = new Set<string>();
			catTransactions.forEach((t) => {
				const date = t.date instanceof Date ? t.date : new Date(t.date as any);
				months.add(`${date.getFullYear()}-${date.getMonth()}`);
			});
			const averageTotal = catTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
			const average = months.size > 0 ? averageTotal / months.size : 0;

			spending[cat] = {
				currentMonth: currentMonthTotal,
				lastMonth: lastMonthTotal,
				average: Math.round(average),
			};
		});

		setSpendingData(spending as Record<TransactionCategory, SpendingData>);
	};

	const handleAddBudget = async () => {
		if (!budgetAmount || !user?.uid) {
			alert("Please enter a budget amount");
			return;
		}

		const existing = categoryBudgets.find((b) => b.category === selectedCategory);
		if (existing) {
			// Update existing
			const updated = categoryBudgets.map((b) =>
				b.category === selectedCategory ? { ...b, limit: parseFloat(budgetAmount) * 100 } : b,
			);
			setCategoryBudgets(updated);
		} else {
			// Add new
			setCategoryBudgets([...categoryBudgets, { category: selectedCategory, limit: parseFloat(budgetAmount) * 100 }]);
		}

		setBudgetAmount("");
		setShowForm(false);
	};

	const handleDeleteBudget = (category: TransactionCategory) => {
		if (!confirm(`Remove budget for ${category}?`)) return;
		setCategoryBudgets(categoryBudgets.filter((b) => b.category !== category));
	};

	const getProgressColor = (percentage: number): string => {
		if (percentage >= 100) return "text-red-600 dark:text-red-400";
		if (percentage >= 80) return "text-yellow-600 dark:text-yellow-400";
		return "text-green-600 dark:text-green-400";
	};

	const getProgressBarColor = (percentage: number): string => {
		if (percentage >= 100) return "bg-red-600";
		if (percentage >= 80) return "bg-yellow-600";
		return "bg-green-600";
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
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Category Budgets</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						Set spending limits by category and track your progress
					</p>
				</div>
				{!showForm && (
					<button
						onClick={() => setShowForm(true)}
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						<Plus className="w-5 h-5" />
						Add Budget
					</button>
				)}
			</div>

			{/* Add Budget Form */}
			{showForm && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Set Budget for Category</h2>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
							<select
								value={selectedCategory}
								onChange={(e) => setSelectedCategory(e.target.value as TransactionCategory)}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500">
								{allCategories.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
										{categoryBudgets.find((b) => b.category === cat as TransactionCategory) ? " (has budget)" : ""}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Monthly Budget ($)
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								placeholder="300.00"
								value={budgetAmount}
								onChange={(e) => setBudgetAmount(e.target.value)}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
							/>
						</div>
						<div className="flex gap-3">
							<button
								onClick={handleAddBudget}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
								Save Budget
							</button>
							<button
								onClick={() => setShowForm(false)}
								className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Budgets Grid */}
			{categoryBudgets.length === 0 ? (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Category Budgets Yet</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						Create budgets to track and manage your spending by category
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{categoryBudgets.map((budget) => {
						const spending = spendingData[budget.category] || { currentMonth: 0, lastMonth: 0, average: 0 };
						const percentage = Math.round((spending.currentMonth / (budget.limit * 100)) * 100);
						const isOverBudget = spending.currentMonth > budget.limit * 100;
						const monthDiff = spending.currentMonth - spending.lastMonth;
						const avgDiff = spending.currentMonth - spending.average;

						return (
							<div
								key={budget.category}
								className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
								<div className="flex items-center justify-between mb-4">
									<div>
										<h3 className="text-lg font-semibold text-gray-900 dark:text-white">{budget.category}</h3>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											Budget: ${(budget.limit / 100).toFixed(2)}/month
										</p>
									</div>
									<button
										onClick={() => handleDeleteBudget(budget.category)}
										className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
										<Trash2 className="w-4 h-4" />
									</button>
								</div>

								{/* Progress Bar */}
								<div className="mb-4">
									<div className="flex justify-between items-center mb-2">
										<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
											Current Month: ${(spending.currentMonth / 100).toFixed(2)}
										</span>
										<span className={`text-sm font-bold ${getProgressColor(percentage)}`}>{percentage}%</span>
									</div>
									<div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
										<div
											className={`h-full transition-all ${getProgressBarColor(percentage)}`}
											style={{ width: `${Math.min(percentage, 100)}%` }}
										/>
									</div>
									{isOverBudget && (
										<div className="mt-2 flex items-center gap-2 text-red-600 dark:text-red-400">
											<TrendingUp className="w-4 h-4" />
											<span className="text-sm font-semibold">
												Over budget by ${((spending.currentMonth - budget.limit * 100) / 100).toFixed(2)}
											</span>
										</div>
									)}
								</div>

								{/* Spending Comparisons */}
								<div className="space-y-2 text-sm">
									<div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
										<span className="text-gray-600 dark:text-gray-400">Last Month</span>
										<div className="flex items-center gap-2">
											<span className="font-medium text-gray-900 dark:text-white">
												${(spending.lastMonth / 100).toFixed(2)}
											</span>
											<span
												className={`text-xs font-semibold ${
													monthDiff < 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
												}`}>
												{monthDiff < 0 ? "↓" : "↑"} ${Math.abs(monthDiff / 100).toFixed(2)}
											</span>
										</div>
									</div>

									<div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
										<span className="text-gray-600 dark:text-gray-400">Monthly Average</span>
										<div className="flex items-center gap-2">
											<span className="font-medium text-gray-900 dark:text-white">
												${(spending.average / 100).toFixed(2)}
											</span>
											<span
												className={`text-xs font-semibold ${
													avgDiff < 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
												}`}>
												{avgDiff < 0 ? "↓" : "↑"} ${Math.abs(avgDiff / 100).toFixed(2)}
											</span>
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
