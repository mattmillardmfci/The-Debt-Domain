"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TrendingDown, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { detectRecurringDebts } from "@/lib/firestoreService";

interface RecurringExpense {
	description: string;
	category: string;
	avgAmount: number;
	monthlyImpact: number;
	frequency: string;
	count: number;
	lastOccurrence: Date;
}

export default function ExpensesPage() {
	const { user } = useAuth();
	const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalMonthlyExpenses, setTotalMonthlyExpenses] = useState(0);

	useEffect(() => {
		if (!user?.uid) {
			setIsLoading(false);
			return;
		}

		const loadExpenses = async () => {
			try {
				const recurringDebts = await detectRecurringDebts(user.uid);

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

					return {
						description: debt.description,
						category: debt.category || "Other",
						avgAmount: debt.avgAmount,
						monthlyImpact,
						frequency: debt.estimatedFrequency || "unknown",
						count: debt.count,
						lastOccurrence: debt.lastOccurrence,
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

	if (isLoading) {
		return (
			<div className="space-y-8">
				<div className="flex items-center gap-3">
					<Link
						href="/dashboard"
						className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
						<ArrowLeft className="w-5 h-5" />
						Back
					</Link>
				</div>
				<div className="text-center">
					<p className="text-gray-600 dark:text-gray-400">Loading expenses...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div>
				<div className="flex items-center gap-3 mb-4">
					<Link
						href="/dashboard"
						className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
						<ArrowLeft className="w-5 h-5" />
						Back to Dashboard
					</Link>
				</div>
				<div className="flex items-center gap-3">
					<TrendingDown className="w-8 h-8 text-red-600" />
					<div>
						<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Monthly Expenses</h1>
						<p className="text-gray-600 dark:text-gray-400 mt-1">Recurring expenses that impact your monthly budget</p>
					</div>
				</div>
			</div>

			{/* Total Summary */}
			<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Estimated Monthly Expenses</p>
						<p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
							{formatCurrency(totalMonthlyExpenses)}
						</p>
						<p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
							Based on {expenses.length} recurring expense{expenses.length !== 1 ? "s" : ""}
						</p>
					</div>
					<TrendingDown className="w-12 h-12 text-red-600 opacity-20" />
				</div>
			</div>

			{/* Expenses List */}
			{expenses.length > 0 ? (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
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
											<span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
												{expense.category}
											</span>
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
			<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
				<h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">How This Works</h3>
				<ul className="text-sm text-amber-800 dark:text-amber-300 space-y-2">
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
