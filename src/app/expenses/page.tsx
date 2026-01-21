"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TrendingDown, AlertCircle, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
	detectRecurringDebts,
	getCustomCategories,
	updateTransaction,
	getAllTransactions,
} from "@/lib/firestoreService";

interface RecurringExpense {
	description: string;
	category: string;
	avgAmount: number;
	monthlyImpact: number;
	frequency: string;
	count: number;
	lastOccurrence: Date;
	transactionIds?: string[];
}

export default function ExpensesPage() {
	const { user } = useAuth();
	const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);
	const [categories, setCategories] = useState<string[]>([]);
	const [editingDescription, setEditingDescription] = useState<string | null>(null);
	const [editingCategory, setEditingCategory] = useState<string>("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!user?.uid) {
			setIsLoading(false);
			return;
		}

		const loadExpenses = async () => {
			try {
				const recurringDebts = await detectRecurringDebts(user.uid);
				const customCategoriesData = await getCustomCategories(user.uid);
				// Extract just the category names
				const categoryNames = customCategoriesData.map((cat) => cat.name || cat.id).filter(Boolean);
				setCategories(categoryNames);

				// Get all transactions to map IDs for editing
				const allTransactions = await getAllTransactions(user.uid);

				// Convert recurring debts to monthly expense impacts
				const recurringExpenses: RecurringExpense[] = recurringDebts.map((debt) => {
					let monthlyImpact = debt.avgAmount;

					// Calculate monthly impact based on frequency
					if (debt.estimatedFrequency === "weekly") {
						monthlyImpact = debt.avgAmount * (52 / 12);
					} else if (debt.estimatedFrequency === "biweekly") {
						monthlyImpact = debt.avgAmount * (26 / 12);
					} else if (debt.estimatedFrequency === "monthly") {
						monthlyImpact = debt.avgAmount;
					} else if (debt.estimatedFrequency === "quarterly") {
						monthlyImpact = debt.avgAmount / 3;
					} else if (debt.estimatedFrequency === "annual") {
						monthlyImpact = debt.avgAmount / 12;
					}

					// Find transaction IDs matching this description
					const transactionIds = allTransactions
						.filter((t) => t.description === debt.description && t.amount! < 0)
						.map((t) => t.id!)
						.filter((id) => id);

					return {
						description: debt.description,
						category: debt.category || "Other",
						avgAmount: debt.avgAmount,
						monthlyImpact,
						frequency: debt.estimatedFrequency || "unknown",
						count: debt.count,
						lastOccurrence: debt.lastOccurrence,
						transactionIds,
					};
				});

				// Filter to only recurring expenses (exclude one-offs)
				// Show expenses that occur at least biweekly or more frequently
				const filteredExpenses = recurringExpenses.filter((exp) => {
					return (
						exp.frequency === "weekly" || exp.frequency === "biweekly" || exp.frequency === "monthly" || exp.count >= 3 // Or at least 3 occurrences
					);
				});

				// Sort by monthly impact (highest first)
				filteredExpenses.sort((a, b) => b.monthlyImpact - a.monthlyImpact);

				// Calculate total monthly expenses
				const total = filteredExpenses.reduce((sum, exp) => sum + exp.monthlyImpact, 0);

				setExpenses(filteredExpenses);
				setTotalMonthlyExpenses(total);
			} catch (error) {
				console.error("Failed to load expenses:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadExpenses();
	}, [user?.uid]);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const handleSaveCategory = async (description: string, newCategory: string) => {
		if (!user?.uid || !newCategory) return;

		setIsSaving(true);
		try {
			const expense = expenses.find((e) => e.description === description);
			if (!expense || !expense.transactionIds) return;

			// Update all transactions with this description
			await Promise.all(
				expense.transactionIds.map((id) =>
					updateTransaction(user.uid, id, {
						category: newCategory as any,
					}),
				),
			);

			// Update local state
			setExpenses((prev) =>
				prev.map((exp) => (exp.description === description ? { ...exp, category: newCategory } : exp)),
			);

			setEditingDescription(null);
		} catch (error) {
			console.error("Failed to update category:", error);
			alert("Failed to update category. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="text-center">
					<p className="text-gray-600 dark:text-gray-400">Loading expenses...</p>
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
						Recurring expenses that impact your monthly budget
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
						<p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
							Estimated Monthly Expenses
						</p>
						<p className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-2">
							{formatCurrency(totalMonthlyExpenses)}
						</p>
						<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
							Based on {expenses.length} recurring expense{expenses.length !== 1 ? "s" : ""}
						</p>
					</div>
					<TrendingDown className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 opacity-20 flex-shrink-0" />
				</div>
			</div>

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
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
									{expenses.map((expense) => (
										<tr
											key={expense.description}
											className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
											<td className="px-6 py-4">
												<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
													{expense.description}
												</p>
											</td>
											<td className="px-6 py-4">
												{editingDescription === expense.description ? (
													<div className="flex gap-2 items-center">
														<select
															value={editingCategory}
															onChange={(e) => setEditingCategory(e.target.value)}
															className="text-xs font-medium rounded px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white">
															<option value="">Select category...</option>
															{categories.map((cat) => (
																<option key={cat} value={cat}>
																	{cat}
																</option>
															))}
														</select>
														<button
															onClick={() => handleSaveCategory(expense.description, editingCategory)}
															disabled={isSaving}
															className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50">
															<Check className="w-4 h-4" />
														</button>
														<button
															onClick={() => setEditingDescription(null)}
															disabled={isSaving}
															className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50">
															<X className="w-4 h-4" />
														</button>
													</div>
												) : (
													<div className="flex items-center gap-2">
														<span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
															{expense.category}
														</span>
														<button
															onClick={() => {
																setEditingDescription(expense.description);
																setEditingCategory(expense.category);
															}}
															className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
													{formatCurrency(expense.avgAmount)}
												</p>
											</td>
											<td className="px-6 py-4 text-right">
												<p className="text-sm font-bold text-red-600 dark:text-red-400">
													{formatCurrency(expense.monthlyImpact)}
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
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Total Footer */}
						<div className="bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end">
							<div className="text-right">
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Monthly Impact</p>
								<p className="text-2xl font-bold text-red-600 dark:text-red-400">
									{formatCurrency(totalMonthlyExpenses)}
								</p>
							</div>
						</div>
					</div>

					{/* Mobile Cards */}
					<div className="sm:hidden space-y-3">
						{expenses.map((expense) => (
							<div
								key={expense.description}
								className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
								<div className="space-y-3">
									{/* Description */}
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
											{expense.description}
										</p>
									</div>

									{/* Monthly impact highlight */}
									<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
										<p className="text-xs text-red-600 dark:text-red-400">Monthly Impact</p>
										<p className="text-lg font-bold text-red-700 dark:text-red-300">
											{formatCurrency(expense.monthlyImpact)}
										</p>
									</div>

									{/* Category */}
									<div>
										{editingDescription === expense.description ? (
											<div className="flex gap-2 flex-wrap items-center">
												<select
													value={editingCategory}
													onChange={(e) => setEditingCategory(e.target.value)}
													className="flex-1 text-xs font-medium rounded px-2 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white min-w-32">
													<option value="">Select category...</option>
													{categories.map((cat) => (
														<option key={cat} value={cat}>
															{cat}
														</option>
													))}
												</select>
												<button
													onClick={() => handleSaveCategory(expense.description, editingCategory)}
													disabled={isSaving}
													className="p-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50 min-h-10 min-w-10 flex items-center justify-center">
													<Check className="w-4 h-4" />
												</button>
												<button
													onClick={() => setEditingDescription(null)}
													disabled={isSaving}
													className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 min-h-10 min-w-10 flex items-center justify-center">
													<X className="w-4 h-4" />
												</button>
											</div>
										) : (
											<div className="flex items-center gap-2 justify-between">
												<span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
													{expense.category}
												</span>
												<button
													onClick={() => {
														setEditingDescription(expense.description);
														setEditingCategory(expense.category);
													}}
													className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-h-10 min-w-10 flex items-center justify-center">
													<Edit2 className="w-4 h-4" />
												</button>
											</div>
										)}
									</div>

									{/* Details grid */}
									<div className="grid grid-cols-3 gap-2 text-xs">
										<div>
											<p className="text-gray-600 dark:text-gray-400">Per Occurrence</p>
											<p className="font-medium text-gray-900 dark:text-white">{formatCurrency(expense.avgAmount)}</p>
										</div>
										<div>
											<p className="text-gray-600 dark:text-gray-400">Frequency</p>
											<p className="font-medium text-gray-900 dark:text-white capitalize">{expense.frequency}</p>
										</div>
										<div>
											<p className="text-gray-600 dark:text-gray-400">Count</p>
											<p className="font-medium text-gray-900 dark:text-white">{expense.count}x</p>
										</div>
									</div>

									{/* Last occurrence */}
									<div className="text-xs">
										<p className="text-gray-600 dark:text-gray-400">Last Occurrence</p>
										<p className="font-medium text-gray-900 dark:text-white">
											{expense.lastOccurrence.toLocaleDateString()}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</>
			) : (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<AlertCircle className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Recurring Expenses Found</h2>
					<p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
						Upload your bank statements to identify recurring monthly expenses that impact your budget.
					</p>
				</div>
			)}

			{/* Info Section */}
			<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 sm:p-6">
				<h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">How This Works</h3>
				<ul className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 space-y-2">
					<li>
						<strong>Recurring Detection:</strong> Expenses appearing 2+ times in your transaction history are analyzed
					</li>
					<li>
						<strong>Frequency Analysis:</strong> Time gaps between occurrences determine if it's weekly, biweekly,
						monthly, etc.
					</li>
					<li>
						<strong>Monthly Impact:</strong> Recurring amounts are converted to a monthly equivalent for budget planning
					</li>
					<li>
						<strong>One-Time Excluded:</strong> Truly random or annual expenses (like car sales tax) are filtered out to
						show your predictable monthly costs
					</li>
				</ul>
			</div>
		</div>
	);
}
