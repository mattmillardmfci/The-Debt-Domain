"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TrendingDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { detectRecurringDebts } from "@/lib/firestoreService";

interface RecurringExpense {
	description: string;
	amount: number; // Per occurrence in dollars
	frequency: string;
	monthlyAmount: number;
	count: number;
	lastOccurrence: Date;
	category?: string;
}

export default function ExpensesPage() {
	const { user } = useAuth();
	const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);

	// Calculate monthly amount based on frequency
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
				const recurringDebts = await detectRecurringDebts(user.uid);

				const expensesList: RecurringExpense[] = recurringDebts.map((debt) => {
					const monthlyAmount = calculateMonthlyAmount(debt.avgAmount, debt.estimatedFrequency);
					return {
						description: debt.description,
						amount: debt.avgAmount,
						frequency: debt.estimatedFrequency || "monthly",
						monthlyAmount,
						count: debt.count,
						lastOccurrence: debt.lastOccurrence,
						category: debt.category,
					};
				});

				// Sort by monthly amount (highest first)
				expensesList.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

				// Calculate total
				const total = expensesList.reduce((sum, expense) => sum + expense.monthlyAmount, 0);

				setExpenses(expensesList);
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
												<span className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
													{expense.category || "Other"}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 capitalize">
												{expense.frequency}
											</td>
											<td className="px-6 py-4 text-right">
												<p className="text-sm font-medium text-gray-900 dark:text-white">
													{formatCurrency(expense.amount)}
												</p>
											</td>
											<td className="px-6 py-4 text-right">
												<p className="text-sm font-bold text-red-600 dark:text-red-400">
													{formatCurrency(expense.monthlyAmount)}
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
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Monthly Expenses</p>
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
									{/* Description and category */}
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
											{expense.description}
										</p>
										<span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
											{expense.category || "Other"}
										</span>
									</div>

									{/* Monthly impact highlight */}
									<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
										<p className="text-xs text-red-600 dark:text-red-400">Monthly Impact</p>
										<p className="text-lg font-bold text-red-700 dark:text-red-300">
											{formatCurrency(expense.monthlyAmount)}
										</p>
									</div>

									{/* Details grid */}
									<div className="grid grid-cols-2 gap-3 text-xs">
										<div>
											<p className="text-gray-600 dark:text-gray-400">Per Occurrence</p>
											<p className="font-medium text-gray-900 dark:text-white">{formatCurrency(expense.amount)}</p>
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
		</div>
	);
}
