"use client";

// Force deployment to Vercel
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, AlertCircle, Plus, Info, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
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
	budgetUsage: number;
	incomeBreakdown: string; // For tooltip
	expensesBreakdown: string; // For tooltip
}

interface CategorySpending {
	category: string;
	currentMonth: number;
	lastMonth: number;
	average: number;
}

export default function DashboardPage() {
	const { user, updateDisplayName } = useAuth();
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
	const [showNameModal, setShowNameModal] = useState(false);
	const [nameInput, setNameInput] = useState("");
	const [savingName, setSavingName] = useState(false);
	const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);

	useEffect(() => {
		if (!user?.uid) {
			setHasData(false);
			setIsLoading(false);
			return;
		}

		// Fetch data from Firestore and calculate metrics
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

				// Calculate monthly expenses from both detected recurring debts and custom recurring expenses
				let monthlyExpensesAbsolute = 0;
				let expensesBreakdownLines: string[] = [];

				// Process detected recurring debts
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
						`${debt.description} (${debt.estimatedFrequency}): $${debt.avgAmount.toFixed(2)} per occurrence × frequency = $${monthlyImpact.toFixed(2)}/mo`,
					);
				});

				// Process custom recurring expenses
				customExpenses.forEach((custom) => {
					let monthlyImpact = custom.avgAmount;

					// Calculate monthly impact based on frequency
					if (custom.estimatedFrequency === "weekly") {
						monthlyImpact = custom.avgAmount * (52 / 12);
					} else if (custom.estimatedFrequency === "biweekly") {
						monthlyImpact = custom.avgAmount * (26 / 12);
					} else if (custom.estimatedFrequency === "monthly") {
						monthlyImpact = custom.avgAmount;
					} else if (custom.estimatedFrequency === "quarterly") {
						monthlyImpact = custom.avgAmount / 3;
					} else if (custom.estimatedFrequency === "annual") {
						monthlyImpact = custom.avgAmount / 12;
					}

					monthlyExpensesAbsolute += monthlyImpact;
					expensesBreakdownLines.push(
						`${custom.description} (${custom.estimatedFrequency}): $${custom.avgAmount.toFixed(2)} per occurrence × frequency = $${monthlyImpact.toFixed(2)}/mo`,
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
							`${income.description || "Manual Income"} (${income.frequency}): $${amountInDollars.toFixed(2)} × frequency multiplier = $${monthlyAmount.toFixed(2)}/mo`,
						);
					}
				});

				// From detected recurring income patterns
				incomePatterns.forEach((pattern) => {
					monthlyIncome += pattern.monthlyAmount; // Already in dollars
					incomeBreakdownLines.push(
						`${pattern.description} (${pattern.frequency}): $${pattern.amount.toFixed(2)} per occurrence × frequency = $${pattern.monthlyAmount.toFixed(2)}/mo`,
					);
				});
				const savingsRate =
					monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpensesAbsolute) / monthlyIncome) * 100) : 0;

				// Calculate category spending for current month and last month
				const now = new Date();
				const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
				const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

				const categoryMap = new Map<string, { currentMonth: number; lastMonth: number; allTime: number[] }>();

				transactions.forEach((t) => {
					if (t.amount && t.amount < 0) {
						const transDate = t.date instanceof Date ? t.date : new Date(t.date || 0);
						const category = t.category || "Other";
						const amount = Math.abs(t.amount) / 100; // Convert from cents to dollars

						if (!categoryMap.has(category)) {
							categoryMap.set(category, { currentMonth: 0, lastMonth: 0, allTime: [] });
						}

						const catData = categoryMap.get(category)!;
						catData.allTime.push(amount);

						if (transDate >= currentMonthStart) {
							catData.currentMonth += amount;
						} else if (transDate >= lastMonthStart && transDate <= lastMonthEnd) {
							catData.lastMonth += amount;
						}
					}
				});

				const categorySpendingData: CategorySpending[] = Array.from(categoryMap.entries())
					.map(([category, data]) => ({
						category,
						currentMonth: Math.round(data.currentMonth * 100) / 100,
						lastMonth: Math.round(data.lastMonth * 100) / 100,
						average: Math.round((data.allTime.reduce((a, b) => a + b, 0) / data.allTime.length) * 100) / 100,
					}))
					.sort((a, b) => b.currentMonth - a.currentMonth);

				setCategorySpending(categorySpendingData);

				setMetrics({
					monthlyIncome: Math.round(monthlyIncome * 100) / 100,
					monthlyExpenses: Math.round(monthlyExpensesAbsolute * 100) / 100,
					savingsRate: savingsRate,
					totalDebt: Math.round(totalDebt / 100),
					budgetUsage: 0, // TODO: Integrate with budgets
					incomeBreakdown:
						incomeBreakdownLines.length > 0
							? incomeBreakdownLines.join("\n")
							: "No income sources found. Add income entries or upload transactions.",
					expensesBreakdown:
						expensesBreakdownLines.length > 0
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

	// Check if user needs to provide their name
	useEffect(() => {
		if (!user || !user.uid) return;

		// Check if user hasn't provided a real name (still has default "User" or empty)
		const needsName = !user.displayName || user.displayName === "User" || user.displayName.trim() === "";

		// Check localStorage to see if we've already shown this modal
		const hasSeenNameModal = localStorage.getItem(`nameModalSeen_${user.uid}`);

		if (needsName && !hasSeenNameModal) {
			setShowNameModal(true);
		}
	}, [user?.uid, user?.displayName]);

	const handleSaveName = async () => {
		const trimmedName = nameInput.trim();
		if (!trimmedName) {
			alert("Please enter your name");
			return;
		}

		setSavingName(true);
		try {
			await updateDisplayName(trimmedName);
			// Mark this modal as seen in localStorage
			if (user?.uid) {
				localStorage.setItem(`nameModalSeen_${user.uid}`, "true");
			}
			setShowNameModal(false);
			setNameInput("");
		} catch (err) {
			console.error("Failed to update name:", err);
			alert("Failed to save name. Please try again.");
		} finally {
			setSavingName(false);
		}
	};

	const handleSkipName = () => {
		// Mark this modal as seen so we don't show it again
		if (user?.uid) {
			localStorage.setItem(`nameModalSeen_${user.uid}`, "true");
		}
		setShowNameModal(false);
		setNameInput("");
	};

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
							onTouchStart={() => setShowIncomeTooltip(!showIncomeTooltip)}>
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
									<div className="text-gray-400 text-xs">
										Weekly: ×4.33 | Biweekly: ×2.17 | Semi-monthly: ×2 | Monthly: ×1 | Yearly: ÷12
									</div>
								</div>
							)}
						</Link>

						{/* Monthly Expenses */}
						<Link
							href="/expenses"
							className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all cursor-pointer relative"
							onMouseEnter={() => setShowExpensesTooltip(true)}
							onMouseLeave={() => setShowExpensesTooltip(false)}
							onTouchStart={() => setShowExpensesTooltip(!showExpensesTooltip)}>
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
									<div className="text-gray-400 text-xs">
										Weekly: ×4.33 | Biweekly: ×2.17 | Monthly: ×1 | Quarterly: ÷3 | Annual: ÷12
									</div>
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

					{/* Category Breakdown */}
					{categorySpending.length > 0 && (
						<div>
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Spending by Category</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{categorySpending.map((cat) => (
									<div
										key={cat.category}
										className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
										<div className="flex items-start justify-between mb-4">
											<div>
												<p className="text-sm font-medium text-gray-600 dark:text-gray-400">{cat.category}</p>
												<p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
													$
													{cat.currentMonth.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</p>
											</div>
										</div>

										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-gray-600 dark:text-gray-400">This Month:</span>
												<span className="font-semibold text-gray-900 dark:text-white">
													$
													{cat.currentMonth.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-600 dark:text-gray-400">Last Month:</span>
												<span className="font-semibold text-gray-900 dark:text-white">
													$
													{cat.lastMonth.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-600 dark:text-gray-400">Average:</span>
												<span className="font-semibold text-gray-900 dark:text-white">
													$
													{cat.average.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>

											{cat.currentMonth > cat.lastMonth && (
												<div className="pt-2 text-xs text-red-600 dark:text-red-400">
													↑ {(((cat.currentMonth - cat.lastMonth) / cat.lastMonth) * 100).toFixed(0)}% vs last month
												</div>
											)}
											{cat.currentMonth < cat.lastMonth && (
												<div className="pt-2 text-xs text-green-600 dark:text-green-400">
													↓ {(((cat.lastMonth - cat.currentMonth) / cat.lastMonth) * 100).toFixed(0)}% vs last month
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}

			{/* Name Onboarding Modal */}
			{showNameModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-8 w-full max-w-md mx-4 shadow-lg">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome!</h2>
							<button
								onClick={handleSkipName}
								className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
								<X className="w-5 h-5" />
							</button>
						</div>

						<p className="text-gray-600 dark:text-gray-400 mb-6">
							We'd like to personalize your experience. What's your name?
						</p>

						{user?.email && (
							<p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
								Logged in as: <span className="font-medium">{user.email}</span>
							</p>
						)}

						<input
							type="text"
							value={nameInput}
							onChange={(e) => setNameInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleSaveName();
								}
							}}
							placeholder="Enter your name"
							className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-700 dark:text-white mb-6"
							autoFocus
						/>

						<div className="flex gap-3">
							<button
								onClick={handleSkipName}
								className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium">
								Skip for Now
							</button>
							<button
								onClick={handleSaveName}
								disabled={savingName}
								className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-colors font-medium">
								{savingName ? "Saving..." : "Save & Continue"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
