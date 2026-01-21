"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TrendingDown, TrendingUp, Wallet, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getTransactions, getDebts, getIncome } from "@/lib/firestoreService";

interface DashboardMetrics {
	netWorth: number;
	monthlyIncome: number;
	monthlyExpenses: number;
	savingsRate: number;
	totalDebt: number;
	budgetUsage: number;
}

export default function DashboardPage() {
	const { user } = useAuth();
	const [metrics, setMetrics] = useState<DashboardMetrics>({
		netWorth: 0,
		monthlyIncome: 0,
		monthlyExpenses: 0,
		savingsRate: 0,
		totalDebt: 0,
		budgetUsage: 0,
	});
	const [hasData, setHasData] = useState(false);

	useEffect(() => {
		if (!user?.uid) {
			setHasData(false);
			return;
		}

		// Fetch data from Firestore and calculate metrics
		const loadMetrics = async () => {
			try {
				const [transactions, debts, incomeEntries] = await Promise.all([
					getTransactions(user.uid),
					getDebts(user.uid),
					getIncome(user.uid),
				]);

				// Calculate total debt
				const totalDebt = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

				// Calculate monthly expenses from transactions (current month)
				const now = new Date();
				const currentMonth = now.getMonth();
				const currentYear = now.getFullYear();

				const monthlyExpenses = transactions
					.filter((t) => {
						const transDate = t.date instanceof Date ? t.date : new Date(t.date as any);
						return transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear;
					})
					.reduce((sum, t) => sum + (t.amount || 0), 0);

				// Calculate monthly income from income entries + salary transactions
				let monthlyIncome = 0;
				incomeEntries.forEach((income) => {
					const amount = income.amount || 0;
					if (income.frequency === "monthly") {
						monthlyIncome += amount;
					} else if (income.frequency === "yearly") {
						monthlyIncome += amount / 12;
					} else if (income.frequency === "biweekly") {
						monthlyIncome += (amount * 26) / 12;
					} else if (income.frequency === "weekly") {
						monthlyIncome += (amount * 52) / 12;
					}
					// 'once' frequency is not included in monthly income
				});

				// Also add salary transactions from current month
				const salarySaleProceedsIncome = transactions
					.filter((t) => {
						const transDate = t.date instanceof Date ? t.date : new Date(t.date as any);
						const isSalaryCategory =
							t.category === "Salary" ||
							(t.description &&
								(t.description.toLowerCase().includes("salary") ||
									t.description.toLowerCase().includes("income") ||
									t.description.toLowerCase().includes("paycheck") ||
									t.description.toLowerCase().includes("payroll")));
						return transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear && isSalaryCategory;
					})
					.reduce((sum, t) => sum + (t.amount || 0), 0);

				monthlyIncome += salarySaleProceedsIncome;

				// Calculate savings rate
				const savingsRate =
					monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

				// Calculate net worth (assuming no asset data, so just inverse of debt)
				const netWorth = -totalDebt;

				setMetrics({
					netWorth: Math.round(netWorth / 100),
					monthlyIncome: Math.round(monthlyIncome / 100),
					monthlyExpenses: Math.round(monthlyExpenses / 100),
					savingsRate: savingsRate,
					totalDebt: Math.round(totalDebt / 100),
					budgetUsage: 0, // TODO: Integrate with budgets
				});

				setHasData(transactions.length > 0 || debts.length > 0 || incomeEntries.length > 0);
			} catch (err) {
				console.error("Failed to load metrics:", err);
				setHasData(false);
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

			{/* Empty State */}
			{!hasData ? (
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
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
						{/* Net Worth */}
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Worth</p>
									<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
										${metrics.netWorth.toLocaleString()}
									</p>
								</div>
								<Wallet className="w-8 h-8 text-blue-600" />
							</div>
						</div>

						{/* Monthly Income */}
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Income</p>
									<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
										${metrics.monthlyIncome.toLocaleString()}
									</p>
								</div>
								<TrendingUp className="w-8 h-8 text-green-600" />
							</div>
						</div>

						{/* Monthly Expenses */}
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Expenses</p>
									<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
										${metrics.monthlyExpenses.toLocaleString()}
									</p>
								</div>
								<TrendingDown className="w-8 h-8 text-red-600" />
							</div>
						</div>

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
