"use client";

import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { detectIncomePatterns, getIncome } from "@/lib/firestoreService";

interface IncomeSource {
	description: string;
	amount: number; // Per occurrence in dollars
	frequency: string;
	monthlyAmount: number;
	count: number;
	lastOccurrence: Date;
	source: "detected" | "manual";
}

export default function IncomePage() {
	const { user } = useAuth();
	const [income, setIncome] = useState<IncomeSource[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);

	useEffect(() => {
		if (!user?.uid) {
			setIsLoading(false);
			return;
		}

		const loadIncome = async () => {
			try {
				const [incomePatterns, manualIncomeEntries] = await Promise.all([
					detectIncomePatterns(user.uid),
					getIncome(user.uid),
				]);

				const incomeSources: IncomeSource[] = [];

				// Add detected income patterns
				incomePatterns.forEach((pattern) => {
					incomeSources.push({
						description: pattern.description,
						amount: pattern.amount,
						frequency: pattern.frequency,
						monthlyAmount: pattern.monthlyAmount,
						count: pattern.count,
						lastOccurrence: pattern.lastOccurrence,
						source: "detected",
					});
				});

				// Add manual income entries
				manualIncomeEntries.forEach((entry) => {
					let monthlyAmount = entry.amount || 0;
					if (entry.frequency === "yearly") {
						monthlyAmount = monthlyAmount / 12;
					} else if (entry.frequency === "biweekly") {
						monthlyAmount = monthlyAmount * (26 / 12);
					} else if (entry.frequency === "weekly") {
						monthlyAmount = monthlyAmount * (52 / 12);
					} else if (entry.frequency === "semi-monthly") {
						monthlyAmount = monthlyAmount * 2;
					}
					// monthly frequency stays the same, once frequency is not included

					if (entry.frequency !== "once") {
						incomeSources.push({
							description: entry.description || entry.source || "Manual Income",
							amount: entry.amount || 0,
							frequency: entry.frequency || "monthly",
							monthlyAmount,
							count: 1,
							lastOccurrence: entry.startDate || new Date(),
							source: "manual",
						});
					}
				});

				// Sort by monthly amount (highest first)
				incomeSources.sort((a, b) => b.monthlyAmount - a.monthlyAmount);

				// Calculate total
				const total = incomeSources.reduce((sum, inc) => sum + inc.monthlyAmount, 0);

				setIncome(incomeSources);
				setTotalMonthlyIncome(total);
			} catch (error) {
				console.error("Failed to load income:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadIncome();
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
					<p className="text-gray-600 dark:text-gray-400">Loading income sources...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Navigation */}
			<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Monthly Income</h1>
					<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
						All income sources and how they contribute to your monthly earnings
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
						<p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Monthly Income</p>
						<p className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-2">
							{formatCurrency(totalMonthlyIncome)}
						</p>
						<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
							From {income.length} income source{income.length !== 1 ? "s" : ""}
						</p>
					</div>
					<TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 opacity-20 flex-shrink-0" />
				</div>
			</div>

			{/* Income Sources */}
			{income.length > 0 ? (
				<>
					{/* Desktop Table */}
					<div className="hidden sm:block bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
									<tr>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Source
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Type
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Frequency
										</th>
										<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Per Occurrence
										</th>
										<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
											Monthly Income
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
									{income.map((source) => (
										<tr
											key={source.description}
											className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
											<td className="px-6 py-4">
												<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
													{source.description}
												</p>
											</td>
											<td className="px-6 py-4">
												<span
													className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
														source.source === "detected"
															? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
															: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
													}`}>
													{source.source === "detected" ? "Auto-Detected" : "Manual"}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 capitalize">
												{source.frequency}
											</td>
											<td className="px-6 py-4 text-right">
												<p className="text-sm font-medium text-gray-900 dark:text-white">
													{formatCurrency(source.amount)}
												</p>
											</td>
											<td className="px-6 py-4 text-right">
												<p className="text-sm font-bold text-green-600 dark:text-green-400">
													{formatCurrency(source.monthlyAmount)}
												</p>
											</td>
											<td className="px-6 py-4">
												<span className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
													{source.count}x
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
												{source.lastOccurrence.toLocaleDateString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Total Footer */}
						<div className="bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end">
							<div className="text-right">
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Monthly Income</p>
								<p className="text-2xl font-bold text-green-600 dark:text-green-400">
									{formatCurrency(totalMonthlyIncome)}
								</p>
							</div>
						</div>
					</div>

					{/* Mobile Cards */}
					<div className="sm:hidden space-y-3">
						{income.map((source) => (
							<div key={source.description} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
								<div className="space-y-3">
									{/* Source name and type */}
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
											{source.description}
										</p>
										<span
											className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${
												source.source === "detected"
													? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
													: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
											}`}>
											{source.source === "detected" ? "Auto-Detected" : "Manual"}
										</span>
									</div>

									{/* Monthly income highlight */}
									<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
										<p className="text-xs text-green-600 dark:text-green-400">Monthly Income</p>
										<p className="text-lg font-bold text-green-700 dark:text-green-300">
											{formatCurrency(source.monthlyAmount)}
										</p>
									</div>

									{/* Details grid */}
									<div className="grid grid-cols-2 gap-3 text-xs">
										<div>
											<p className="text-gray-600 dark:text-gray-400">Per Occurrence</p>
											<p className="font-medium text-gray-900 dark:text-white">
												{formatCurrency(source.amount)}
											</p>
										</div>
										<div>
											<p className="text-gray-600 dark:text-gray-400">Frequency</p>
											<p className="font-medium text-gray-900 dark:text-white capitalize">
												{source.frequency}
											</p>
										</div>
										<div>
											<p className="text-gray-600 dark:text-gray-400">Count</p>
											<p className="font-medium text-gray-900 dark:text-white">
												{source.count}x
											</p>
										</div>
										<div>
											<p className="text-gray-600 dark:text-gray-400">Last Occurrence</p>
											<p className="font-medium text-gray-900 dark:text-white">
												{source.lastOccurrence.toLocaleDateString()}
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
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Income Sources Found</h2>
					<p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
						Upload your bank statements to identify salary deposits and recurring income sources.
					</p>
				</div>
			)}

			{/* Info Section */}
			<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 sm:p-6">
				<h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">How This Works</h3>
				<ul className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 space-y-2">
					<li>
						<strong>Auto-Detected:</strong> Salary and income transactions appearing 2+ times are analyzed for patterns
					</li>
					<li>
						<strong>Manual Entries:</strong> Income sources you manually add in the profile section
					</li>
					<li>
						<strong>Frequency Analysis:</strong> Time gaps between deposits determine if it's weekly, biweekly, semi-monthly, or monthly
					</li>
					<li>
						<strong>Semi-Monthly Detection:</strong> Identifies payroll on specific days of the month (e.g., 1st & 15th)
					</li>
					<li>
						<strong>Biweekly Detection:</strong> Identifies payroll every 14 days regardless of day-of-month
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
							<li>$1,624.74 biweekly = $1,624.74 × 2.167 = $3,530.27/month</li>
							<li>$1,500 semi-monthly (1st & 15th) = $1,500 × 2 = $3,000/month</li>
						</ul>
					</li>
				</ul>
			</div>
		</div>
	);
}
