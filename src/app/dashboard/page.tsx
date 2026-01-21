"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TrendingDown, TrendingUp, Wallet, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

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
		// TODO: Fetch actual metrics from Firestore
		// For now, showing placeholder
		setHasData(false);
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
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
