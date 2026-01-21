"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { Transaction } from "@/types";

export default function TransactionsPage() {
	const [transactions, setTransactions] = useState<Partial<Transaction>[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Load transactions from localStorage (temporary until Firestore integration)
		const stored = localStorage.getItem("transactions");
		if (stored) {
			try {
				setTransactions(JSON.parse(stored));
			} catch (err) {
				console.error("Failed to load transactions:", err);
			}
		}
		setLoading(false);
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	if (transactions.length === 0) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">View and categorize your transactions</p>
				</div>

				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">No Transactions Yet</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Upload a bank statement to get started with transaction analysis
					</p>
					<Link
						href="/transactions/upload"
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						<Plus className="w-5 h-5" />
						Upload Statement
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">{transactions.length} transactions found</p>
				</div>
				<Link
					href="/transactions/upload"
					className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
					<Plus className="w-5 h-5" />
					Upload More
				</Link>
			</div>

			{/* Transaction Table */}
			<div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
				<table className="w-full">
					<thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
						<tr>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Date
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Description
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Category
							</th>
							<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Amount
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
						{transactions.slice(0, 20).map((t, idx) => (
							<tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700">
								<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
									{t.date instanceof Date ? t.date.toLocaleDateString() : t.date}
								</td>
								<td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{t.description}</td>
								<td className="px-6 py-4 text-sm">
									<span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
										{t.category || "Other"}
									</span>
								</td>
								<td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
									${((t.amount || 0) / 100).toFixed(2)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{transactions.length > 20 && (
				<p className="text-sm text-gray-600 dark:text-gray-400">Showing 20 of {transactions.length} transactions</p>
			)}
		</div>
	);
}
