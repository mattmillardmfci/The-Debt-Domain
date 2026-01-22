"use client";

// Force deployment to Vercel
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, AlertCircle, Plus, Info } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
	getTransactions,
	getDebts,
	getIncome,
	detectIncomePatterns,
	detectRecurringDebts,
} from "@/lib/firestoreService";

interface DashboardMetrics {
	monthlyIncome: number;
	monthlyExpenses: number;
	savingsRate: number;
	totalDebt: number;
	budgetUsage: number;
	incomeBreakdown: string; // For tooltip
	expensesBreakdown: string; // For tooltip
}

export default function DashboardPage() {
	const { user } = useAuth();
	const [metrics, setMetrics] = useState<DashboardMetrics>({
		monthlyIncome: 0,
		monthlyExpenses: 0,
		savingsRate: 0,
		totalDebt: 0,
		budgetUsage: 0,
		incomeBreakdown: "",
		expensesBreakdown: "",
	});
	const [hasData, setHasData] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showIncomeTooltip, setShowIncomeTooltip] = useState(false);
	const [showExpensesTooltip, setShowExpensesTooltip] = useState(false);

	useEffect(() => {
		if (!user?.uid) {
			setHasData(false);
			setIsLoading(false);
			return;
		}

		// Fetch data from Firestore and calculate metrics
		const loadMetrics = async () => {
			try {
				const [transactions, debts, incomeEntries, incomePatterns, recurringDebts] = await Promise.all([
					getTransactions(user.uid),
					getDebts(user.uid),
					getIncome(user.uid),
					detectIncomePatterns(user.uid),
					detectRecurringDebts(user.uid),
				]);

				// Calculate total debt
				const totalDebt = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

				// Calculate monthly expenses from recurring debt patterns (same as expenses page)
				let monthlyExpensesAbsolute = 0;
				let expensesBreakdownLines: string[] = [];
				
				recurringDebts.forEach((debt) => {
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

					monthlyExpensesAbsolute += monthlyImpact;
					expensesBreakdownLines.push(
						`${debt.description} (${debt.estimatedFrequency}): $${debt.avgAmount.toFixed(2)} per occurrence × frequency = $${monthlyImpact.toFixed(2)}/mo`
					);
				});

				// Calculate monthly income from income entries + detected income patterns
				let monthlyIncome = 0;
				let incomeBreakdownLines: string[] = [];

				// From manual income entries
				incomeEntries.forEach((income) => {
					const amountInDollars = (income.amount || 0) / 100; // Convert from cents
					let monthlyAmount = 0;
					if (income.frequency === "monthly") {
						monthlyAmount = amountInDollars;
					} else if (income.frequency === "yearly") {
						monthlyAmount = amountInDollars / 12;
					} else if (income.frequency === "biweekly") {
						monthlyAmount = amountInDollars * (26 / 12);
					} else if (income.frequency === "semi-monthly") {
						monthlyAmount = amountInDollars * 2;
					} else if (income.frequency === "weekly") {
						monthlyAmount = amountInDollars * (52 / 12);
					}
					
					if (income.frequency !== "once") {
						monthlyIncome += monthlyAmount;
						incomeBreakdownLines.push(
							`${income.description || "Manual Income"} (${income.frequency}): $${amountInDollars.toFixed(2)} × frequency multiplier = $${monthlyAmount.toFixed(2)}/mo`
						);
					}
				});

				// From detected recurring income patterns
				incomePatterns.forEach((pattern) => {
					monthlyIncome += pattern.monthlyAmount; // Already in dollars
					incomeBreakdownLines.push(
						`${pattern.description} (${pattern.frequency}): $${pattern.amount.toFixed(2)} per occurrence × frequency = $${pattern.monthlyAmount.toFixed(2)}/mo`
					);
				});
				const savingsRate =
					monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpensesAbsolute) / monthlyIncome) * 100) : 0;

				setMetrics({
					monthlyIncome: Math.round(monthlyIncome * 100) / 100,
					monthlyExpenses: Math.round(monthlyExpensesAbsolute * 100) / 100,
					savingsRate: savingsRate,
					totalDebt: Math.round(totalDebt / 100),
					budgetUsage: 0, // TODO: Integrate with budgets
					incomeBreakdown: incomeBreakdownLines.length > 0 
						? incomeBreakdownLines.join("\n")
						: "No income sources found. Add income entries or upload transactions.",
					expensesBreakdown: expensesBreakdownLines.length > 0
						? expensesBreakdownLines.join("\n")
						: "No recurring expenses found. Upload transactions to detect patterns.",
				});

				setHasData(transactions.length > 0);
			} catch (err) {
				console.error("Failed to load metrics:", err);
				setHasData(false);
			} finally {
				setIsLoading(false);
			}
		};

		loadMetrics();
	}, [user?.uid]);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {user?.displayName || "User"}!</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">Here's your financial overview</p>
			</div>

			{/* Loading State */}
			{isLoading ? (
				<div className="flex items-center justify-center py-16">
					<div className="flex flex-col items-center gap-4">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
						<p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
					</div>
				</div>
			) : !hasData ? (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<AlertCircle className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
						Get Started with Your Financial Dashboard
					</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
						Upload your bank statements to analyze your spending, build budgets, and create a debt payoff plan.
					</p>
					<Link
						href="/transactions/upload"
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						<Plus className="w-5 h-5" />
						Upload Bank Statement
					</Link>
				</div>
			) : (
				<>
					{/* Metrics Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						{/* Monthly Income */}
					<Link 
						href="/income" 
						className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all cursor-pointer relative"
						onMouseEnter={() => setShowIncomeTooltip(true)}
						onMouseLeave={() => setShowIncomeTooltip(false)}
						onTouchStart={() => setShowIncomeTooltip(!showIncomeTooltip)}
					>
						<div className="flex items-center justify-between">
							<div className="flex-1">
								<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Income</p>
								<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
									$
									{metrics.monthlyIncome.toLocaleString("en-US", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</p>
							</div>
							<div className="flex flex-col items-center gap-2">
								<TrendingUp className="w-8 h-8 text-green-600" />
								<Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
							</div>
						</div>

						{/* Tooltip */}
						{showIncomeTooltip && (
							<div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 dark:bg-gray-800 text-white text-xs p-3 rounded border border-gray-700 z-50 whitespace-pre-wrap">
								<div className="font-semibold mb-2">How Monthly Income is Calculated:</div>
								<div className="text-gray-200">{metrics.incomeBreakdown}</div>
								<div className="text-gray-400 text-xs mt-2 italic">Frequency multipliers:</div>
								<div className="text-gray-400 text-xs">Weekly: ×4.33 | Biweekly: ×2.17 | Semi-monthly: ×2 | Monthly: ×1 | Yearly: ÷12</div>
							</div>
						)}
					</Link>

					{/* Monthly Expenses */}
					<Link 
						href="/expenses" 
						className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all cursor-pointer relative"
						onMouseEnter={() => setShowExpensesTooltip(true)}
						onMouseLeave={() => setShowExpensesTooltip(false)}
						onTouchStart={() => setShowExpensesTooltip(!showExpensesTooltip)}
					>
						<div className="flex items-center justify-between">
							<div className="flex-1">
								<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Expenses</p>
								<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
									$
									{metrics.monthlyExpenses.toLocaleString("en-US", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</p>
							</div>
							<div className="flex flex-col items-center gap-2">
								<TrendingDown className="w-8 h-8 text-red-600" />
								<Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
							</div>
						</div>

						{/* Tooltip */}
						{showExpensesTooltip && (
							<div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 dark:bg-gray-800 text-white text-xs p-3 rounded border border-gray-700 z-50 whitespace-pre-wrap">
								<div className="font-semibold mb-2">How Monthly Expenses are Calculated:</div>
								<div className="text-gray-200">{metrics.expensesBreakdown}</div>
								<div className="text-gray-400 text-xs mt-2 italic">Frequency multipliers:</div>
								<div className="text-gray-400 text-xs">Weekly: ×4.33 | Biweekly: ×2.17 | Monthly: ×1 | Quarterly: ÷3 | Annual: ÷12</div>
							</div>
						)}
					</Link>

					{/* Total Debt */}
					<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Debt</p>
								<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
									${metrics.totalDebt.toLocaleString()}
								</p>
							</div>
							<AlertCircle className="w-8 h-8 text-orange-600" />
						</div>
					</div>

						{/* Savings Rate */}
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Savings Rate</p>
									<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{metrics.savingsRate}%</p>
								</div>
								<TrendingUp className="w-8 h-8 text-emerald-600" />
							</div>
						</div>
					</div>

					{/* Quick Actions */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<Link
							href="/transactions/upload"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow cursor-pointer">
							<div className="flex items-center gap-3 mb-3">
								<Plus className="w-5 h-5 text-blue-600" />
								<h3 className="font-semibold text-gray-900 dark:text-white">Upload Statement</h3>
							</div>
							<p className="text-sm text-gray-600 dark:text-gray-400">Add a new bank statement for analysis</p>
						</Link>

						<Link
							href="/debts"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow cursor-pointer">
							<div className="flex items-center gap-3 mb-3">
								<AlertCircle className="w-5 h-5 text-orange-600" />
								<h3 className="font-semibold text-gray-900 dark:text-white">Manage Debts</h3>
							</div>
							<p className="text-sm text-gray-600 dark:text-gray-400">Track and manage your debts</p>
						</Link>

						<Link
							href="/payoff-plan"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow cursor-pointer">
							<div className="flex items-center gap-3 mb-3">
								<TrendingUp className="w-5 h-5 text-green-600" />
								<h3 className="font-semibold text-gray-900 dark:text-white">Payoff Plan</h3>
							</div>
							<p className="text-sm text-gray-600 dark:text-gray-400">Create your debt payoff strategy</p>
						</Link>
					</div>
				</>
			)}
		</div>
	);
}
