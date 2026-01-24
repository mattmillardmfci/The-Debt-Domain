"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import { TrendingUp, TrendingDown, AlertCircle, Plus, Info, X, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
	BarChart,
	Bar,
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	ReferenceLine,
} from "recharts";
import {
	getTransactions,
	getDebts,
	getIncome,
	detectIncomePatterns,
	detectRecurringDebts,
	getCustomRecurringExpenses,
} from "@/lib/firestoreService";

interface DashboardMetrics {
	monthlyIncome: number;
	monthlyExpenses: number;
	savingsRate: number;
	totalDebt: number;
	netWorth: number;
	incomeBreakdown: string;
	expensesBreakdown: string;
}

interface CategorySpending {
	category: string;
	currentMonth: number;
	lastMonth: number;
	average: number;
	trend: number;
}

interface ChartData {
	month: string;
	income: number;
	expenses: number;
	savings: number;
}

export default function DashboardPage() {
	const { user, updateDisplayName } = useAuth();
	const { showSuccess, showError } = useAlert();
	const [metrics, setMetrics] = useState<DashboardMetrics>({
		monthlyIncome: 0,
		monthlyExpenses: 0,
		savingsRate: 0,
		totalDebt: 0,
		netWorth: 0,
		incomeBreakdown: "",
		expensesBreakdown: "",
	});
	const [hasData, setHasData] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [showNameModal, setShowNameModal] = useState(false);
	const [nameInput, setNameInput] = useState("");
	const [savingName, setSavingName] = useState(false);
	const [incomeSourceCount, setIncomeSourceCount] = useState(0);
	const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
	const [chartData, setChartData] = useState<ChartData[]>([]);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

	const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

	useEffect(() => {
		if (!user?.uid) {
			setHasData(false);
			setIsLoading(false);
			return;
		}

		const loadMetrics = async () => {
			try {
				const [transactions, debts, incomeEntries, incomePatterns, recurringDebts, customExpenses] = await Promise.all([
					getTransactions(user.uid),
					getDebts(user.uid),
					getIncome(user.uid),
					detectIncomePatterns(user.uid),
					detectRecurringDebts(user.uid),
					getCustomRecurringExpenses(user.uid),
				]);

				// Calculate total debt
				const totalDebt = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

				// Calculate net worth
				const totalAssets = incomeEntries.reduce((sum, i) => sum + (i.amount || 0), 0);
				const netWorth = totalAssets - totalDebt / 100;

				// Calculate monthly expenses
				let monthlyExpensesAbsolute = 0;
				let expensesBreakdownLines: string[] = [];

				recurringDebts.forEach((debt) => {
					let monthlyImpact = debt.avgAmount;
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
						`${debt.description} (${debt.estimatedFrequency}): $${debt.avgAmount.toFixed(2)} → $${monthlyImpact.toFixed(2)}/mo`,
					);
				});

				customExpenses.forEach((expense) => {
					const amount = expense.avgAmount || 0;
					monthlyExpensesAbsolute += amount;
					expensesBreakdownLines.push(`${expense.description}: $${amount.toFixed(2)}/mo`);
				});

				// Calculate monthly income
				let monthlyIncome = 0;
				let incomeBreakdownLines: string[] = [];

				incomePatterns.forEach((pattern) => {
					// Use the monthlyAmount already calculated by detectIncomePatterns
					const monthlyImpact = pattern.monthlyAmount;
					monthlyIncome += monthlyImpact;
					incomeBreakdownLines.push(`${pattern.description} (${pattern.frequency}): $${monthlyImpact.toFixed(2)}/mo`);
				});

				// Add manual income entries
				incomeEntries.forEach((entry) => {
					let monthlyImpact = entry.amount || 0;
					if (entry.frequency === "yearly") {
						monthlyImpact = monthlyImpact / 12;
					} else if (entry.frequency === "biweekly") {
						monthlyImpact = monthlyImpact * (26 / 12);
					} else if (entry.frequency === "weekly") {
						monthlyImpact = monthlyImpact * (52 / 12);
					} else if (entry.frequency === "semi-monthly") {
						monthlyImpact = monthlyImpact * 2;
					}
					// monthly frequency stays the same, once frequency is not included

					if (entry.frequency !== "once") {
						monthlyIncome += monthlyImpact;
						incomeBreakdownLines.push(
							`${entry.description || entry.source || "Manual Income"} (${entry.frequency}): $${monthlyImpact.toFixed(2)}/mo`,
						);
					}
				});

				// Process category spending FIRST to get actual monthly data
				const categoryMap = new Map<
					string,
					{ current: number; last: number; count: number; total: number; monthlyTotals: number[] }
				>();

				transactions.forEach((t) => {
					const cat = (t.category as string) || "Other";
					const amount = (t.amount || 0) / 100;
					const txDate = t.date instanceof Date ? t.date : new Date(t.date as any);
					const now = new Date();
					const isCurrentMonth = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
					const isLastMonth =
						(txDate.getMonth() === now.getMonth() - 1 || (now.getMonth() === 0 && txDate.getMonth() === 11)) &&
						(txDate.getFullYear() === now.getFullYear() || txDate.getFullYear() === now.getFullYear() - 1);

					if (!categoryMap.has(cat)) {
						categoryMap.set(cat, { current: 0, last: 0, count: 0, total: 0, monthlyTotals: [] });
					}

					const data = categoryMap.get(cat)!;
					if (isCurrentMonth) data.current += amount;
					if (isLastMonth) data.last += amount;
					data.total += amount;
					data.count += 1;
				});

				// Calculate actual monthly totals from transactions
				const lastMonthTotal = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.last, 0);
				const currentMonthTotal = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.current, 0);

				// Use LAST MONTH as the baseline for monthly income/expenses (not current incomplete month)
				// For the metric cards, display configured income/expenses from the /income page
				let displayIncome = monthlyIncome;
				let displayExpenses = monthlyExpensesAbsolute;

				// Calculate savings rate based on configured amounts
				const savingsRate =
					displayIncome > 0 ? Math.round(((displayIncome - displayExpenses) / displayIncome) * 100) : 0;

				// For chart, calculate actual monthly values from transactions for each month
				const now = new Date();
				const chartDataPoints: ChartData[] = [];
				const monthlyByCategoryMap = new Map<string, number[]>(); // Track monthly totals per category

				for (let i = 5; i >= 0; i--) {
					const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
					const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

					let monthIncome = 0;
					let monthExpenses = 0;

					transactions.forEach((t) => {
						const txDate = t.date instanceof Date ? t.date : new Date(t.date as any);
						if (txDate >= monthStart && txDate <= monthEnd) {
							const cat = (t.category as string) || "Other";
							const amount = (t.amount || 0) / 100;

							// Track monthly totals per category
							if (!monthlyByCategoryMap.has(cat)) {
								monthlyByCategoryMap.set(cat, [0, 0, 0, 0, 0, 0]);
							}
							const monthlyArray = monthlyByCategoryMap.get(cat)!;
							monthlyArray[5 - i] += amount;

							const absAmount = Math.abs(amount);
							if (amount > 0) {
								monthIncome += absAmount;
							} else {
								monthExpenses += absAmount;
							}
						}
					});

					chartDataPoints.push({
						month: monthStart.toLocaleString("default", { month: "short" }),
						income: Math.round(monthIncome * 100) / 100,
						expenses: Math.round(monthExpenses * 100) / 100,
						savings: Math.round((monthIncome - monthExpenses) * 100) / 100,
					});
				}

				const categorySpendingData: CategorySpending[] = Array.from(categoryMap.entries())
					.map(([cat, data]) => {
						// Calculate average from 6-month data
						const monthlyTotals = monthlyByCategoryMap.get(cat) || [0, 0, 0, 0, 0, 0];
						const validMonths = monthlyTotals.filter((total) => total !== 0).length || 1;
						const sixMonthSum = monthlyTotals.reduce((a, b) => a + b, 0);
						const average = sixMonthSum / Math.max(1, validMonths);

						return {
							category: cat,
							currentMonth: data.current,
							lastMonth: data.last,
							average: average,
							trend: data.last > 0 ? Math.round(((data.current - data.last) / data.last) * 100) : 0,
						};
					})
					.filter((cat) => cat.currentMonth < 0) // Only include spending/expense categories (negative values)
					.sort((a, b) => Math.abs(b.currentMonth) - Math.abs(a.currentMonth)) // Sort by absolute value descending
					.slice(0, 8);

				setCategorySpending(categorySpendingData);
				setChartData(chartDataPoints);

				// Count total income sources (detected + manual)
				const totalIncomeSources = incomePatterns.length + incomeEntries.filter((e) => e.frequency !== "once").length;

				setMetrics({
					monthlyIncome: Math.round(displayIncome * 100) / 100,
					monthlyExpenses: Math.round(displayExpenses * 100) / 100,
					savingsRate: savingsRate,
					totalDebt: Math.round(totalDebt / 100),
					netWorth: Math.round(netWorth),
					incomeBreakdown:
						incomeBreakdownLines.length > 0
							? incomeBreakdownLines.join("\n")
							: "No income sources found. Add income entries to track earnings.",
					expensesBreakdown:
						expensesBreakdownLines.length > 0
							? expensesBreakdownLines.join("\n")
							: "No recurring expenses found. Upload transactions to detect patterns.",
				});

				setIncomeSourceCount(totalIncomeSources);
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

	// Check if user needs to provide their name
	useEffect(() => {
		if (!user || !user.uid) return;

		const needsName = !user.displayName || user.displayName === "User" || user.displayName.trim() === "";
		const hasSeenNameModal = localStorage.getItem(`nameModalSeen_${user.uid}`);

		if (needsName && !hasSeenNameModal) {
			setShowNameModal(true);
		}
	}, [user?.uid, user?.displayName]);

	const handleSaveName = async () => {
		const trimmedName = nameInput.trim();
		if (!trimmedName) {
			showError("Please enter your name");
			return;
		}

		setSavingName(true);
		try {
			await updateDisplayName(trimmedName);
			if (user?.uid) {
				localStorage.setItem(`nameModalSeen_${user.uid}`, "true");
			}
			setShowNameModal(false);
			setNameInput("");
			showSuccess("Name saved successfully!");
		} catch (err) {
			console.error("Failed to update name:", err);
			showError("Failed to save name. Please try again.");
		} finally {
			setSavingName(false);
		}
	};

	const handleSkipName = () => {
		if (user?.uid) {
			localStorage.setItem(`nameModalSeen_${user.uid}`, "true");
		}
		setShowNameModal(false);
	};

	return (
		<div className="space-y-8 pb-8">
			{/* Header */}
			<div>
				<h1 className="text-4xl font-bold text-gray-900 dark:text-white">
					Welcome back, {user?.displayName || "User"}! 👋
				</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">Your financial overview at a glance</p>
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
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Upload a bank statement to analyze your spending and get personalized insights.
					</p>
					<Link
						href="/transactions/upload"
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						<Plus className="w-5 h-5" />
						Upload Your First Statement
					</Link>
				</div>
			) : (
				<>
					{/* Top Metrics Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						{/* Monthly Income */}
						<Link
							href="/income"
							className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-lg p-6 border border-emerald-200 dark:border-emerald-800 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer">
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">Monthly Income</span>
								<ArrowDownLeft className="w-4 h-4 text-emerald-600" />
							</div>
							<p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
								${metrics.monthlyIncome.toLocaleString("en-US", { maximumFractionDigits: 2 })}
							</p>
							<p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
								From {incomeSourceCount} income sources
							</p>
						</Link>

						{/* Monthly Expenses */}
						<Link
							href="/expenses"
							className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 rounded-lg p-6 border border-red-200 dark:border-red-800 hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all cursor-pointer">
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-medium text-red-900 dark:text-red-300">Monthly Expenses</span>
								<ArrowUpRight className="w-4 h-4 text-red-600" />
							</div>
							<p className="text-3xl font-bold text-red-900 dark:text-red-100">
								${metrics.monthlyExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}
							</p>
							<p className="text-xs text-red-700 dark:text-red-300 mt-2">
								{Math.round((metrics.monthlyExpenses / metrics.monthlyIncome) * 100)}% of income
							</p>
						</Link>

						{/* Savings Rate */}
						<div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-medium text-blue-900 dark:text-blue-300">Savings Rate</span>
								<TrendingUp className="w-4 h-4 text-blue-600" />
							</div>
							<p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{metrics.savingsRate}%</p>
							<p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
								$
								{Math.max(0, metrics.monthlyIncome - metrics.monthlyExpenses).toLocaleString("en-US", {
									maximumFractionDigits: 0,
								})}
								/mo
							</p>
						</div>

						{/* Total Debt */}
						<div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
							<div className="flex items-center justify-between mb-3">
								<span className="text-sm font-medium text-purple-900 dark:text-purple-300">Total Debt</span>
								<AlertCircle className="w-4 h-4 text-purple-600" />
							</div>
							<p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
								${metrics.totalDebt.toLocaleString("en-US", { maximumFractionDigits: 0 })}
							</p>
							<p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
								{metrics.savingsRate > 0
									? `~${Math.round(metrics.totalDebt / Math.max(metrics.monthlyIncome - metrics.monthlyExpenses, 1))} months to pay off`
									: "Add savings to pay down"}
							</p>
						</div>
					</div>

					{/* Charts Section */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Income vs Expenses Trend */}
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">6-Month Trend</h3>
							<ResponsiveContainer width="100%" height={300}>
								<BarChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 100, 100, 0.1)" />
									<XAxis dataKey="month" stroke="#999" />
									<YAxis stroke="#999" />
									<Tooltip
										contentStyle={{
											backgroundColor: "#1f2937",
											border: "1px solid #374151",
											borderRadius: "6px",
										}}
										labelStyle={{ color: "#fff" }}
									/>
									<Legend />
									<ReferenceLine y={0} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="3 3" />
									<Bar dataKey="income" fill="#10b981" radius={[8, 8, 0, 0]} />
									<Bar dataKey="expenses" fill="#ef4444" radius={[8, 8, 0, 0]} />
									<Bar dataKey="savings" fill="#3b82f6" radius={[8, 8, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						</div>

						{/* Category Breakdown */}
						<div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Spending by Category</h3>
							{categorySpending.length > 0 ? (
								<div className="w-full overflow-x-auto">
									<ResponsiveContainer width="100%" height={350}>
										<PieChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
											<Pie
												data={categorySpending.slice(0, 6).map((cat) => ({
													name: cat.category,
													value: parseFloat(Math.abs(cat.currentMonth).toFixed(2)),
												}))}
												cx="45%"
												cy="50%"
												labelLine={true}
												label={({ name, value }) => `${name}: $${value}`}
												outerRadius={70}
												fill="#8884d8"
												dataKey="value">
												{categorySpending.slice(0, 6).map((entry, index) => (
													<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
												))}
											</Pie>
											<Tooltip formatter={(value) => `$${typeof value === "number" ? value.toFixed(2) : "0.00"}`} />
										</PieChart>
									</ResponsiveContainer>
								</div>
							) : (
								<div className="flex items-center justify-center h-64 text-gray-400">No spending data</div>
							)}
						</div>
					</div>

					{/* Category Comparison Cards */}
					{categorySpending.length > 0 && (
						<div>
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Breakdown</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
								{categorySpending.map((cat, idx) => {
									const trendUp = cat.trend > 0;
									const trendColor = trendUp ? "text-red-600" : "text-emerald-600";
									const bgColor = `bg-slate-50 dark:bg-slate-700/50`;

									return (
										<div
											key={idx}
											className={`${bgColor} rounded-lg p-4 border border-gray-200 dark:border-slate-600 cursor-pointer hover:shadow-lg transition-shadow`}
											onClick={() => setSelectedCategory(cat.category)}>
											<div className="flex items-start justify-between mb-3">
												<h4 className="font-medium text-gray-900 dark:text-white text-sm">{cat.category}</h4>
												{cat.trend !== 0 && (
													<div className={`flex items-center gap-1 ${trendColor}`}>
														{trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
														<span className="text-xs font-medium">{Math.abs(cat.trend)}%</span>
													</div>
												)}
											</div>

											<p className="text-3xl font-bold text-gray-900 dark:text-white">${cat.currentMonth.toFixed(2)}</p>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This month</p>

											<div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
												<div className="flex justify-between">
													<span>Last month:</span>
													<span className="font-medium text-gray-900 dark:text-white">${cat.lastMonth.toFixed(2)}</span>
												</div>
												<div className="flex justify-between">
													<span>Average:</span>
													<span className="font-medium text-gray-700 dark:text-gray-500 text-xs">${cat.average.toFixed(2)}</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Quick Actions */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Link
							href="/transactions/upload"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer">
							<div className="flex items-center gap-3 mb-3">
								<Plus className="w-5 h-5 text-blue-600" />
								<h3 className="font-semibold text-gray-900 dark:text-white">Upload Statement</h3>
							</div>
							<p className="text-sm text-gray-600 dark:text-gray-400">Import new transaction data</p>
						</Link>

						<Link
							href="/debts"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-600 transition-all cursor-pointer">
							<div className="flex items-center gap-3 mb-3">
								<AlertCircle className="w-5 h-5 text-orange-600" />
								<h3 className="font-semibold text-gray-900 dark:text-white">Manage Debts</h3>
							</div>
							<p className="text-sm text-gray-600 dark:text-gray-400">Review payoff strategies</p>
						</Link>

						<Link
							href="/payoff-plan"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer">
							<div className="flex items-center gap-3 mb-3">
								<TrendingUp className="w-5 h-5 text-emerald-600" />
								<h3 className="font-semibold text-gray-900 dark:text-white">Payoff Plan</h3>
							</div>
							<p className="text-sm text-gray-600 dark:text-gray-400">Create debt strategy</p>
						</Link>
					</div>
				</>
			)}

			{/* Name Modal */}
			{showNameModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-slate-700">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">What's your name?</h3>
							<button onClick={handleSkipName} className="text-gray-400 hover:text-gray-600">
								<X className="w-5 h-5" />
							</button>
						</div>

						<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">We'd love to know who we're helping!</p>

						<input
							type="text"
							value={nameInput}
							onChange={(e) => setNameInput(e.target.value)}
							placeholder="Enter your name"
							className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-blue-600"
							onKeyPress={(e) => {
								if (e.key === "Enter") handleSaveName();
							}}
						/>

						<div className="flex gap-3">
							<button
								onClick={handleSkipName}
								disabled={savingName}
								className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors disabled:opacity-50">
								Skip
							</button>
							<button
								onClick={handleSaveName}
								disabled={savingName || !nameInput.trim()}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
								{savingName ? "Saving..." : "Save"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
