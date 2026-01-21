"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Transaction } from "@/types";
import { getTransactions, deleteTransaction } from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";

export default function TransactionsPage() {
	const { user } = useAuth();
	const [transactions, setTransactions] = useState<(Partial<Transaction> & { id: string })[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		// Load transactions from Firestore
		const loadTransactions = async () => {
			try {
				const data = await getTransactions(user.uid);
				setTransactions(data);
			} catch (err) {
				console.error("Failed to load transactions:", err);
			} finally {
				setLoading(false);
			}
		};

		loadTransactions();
	}, [user?.uid]);

	const handleDeleteTransaction = async (transactionId: string) => {
		if (!user?.uid) return;

		if (!confirm("Are you sure you want to delete this transaction?")) {
			return;
		}

		try {
			await deleteTransaction(user.uid, transactionId);
			setTransactions(transactions.filter((t) => t.id !== transactionId));
		} catch (err) {
			console.error("Failed to delete transaction:", err);
			alert("Failed to delete transaction. Please try again.");
		}
	};

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
							<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
								Action
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
						{transactions.slice(0, 50).map((t) => (
							<tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
								<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
									{t.date instanceof Date ? t.date.toLocaleDateString() : new Date(t.date as any).toLocaleDateString()}
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
								<td className="px-6 py-4 text-sm text-right">
									<button
										onClick={() => handleDeleteTransaction(t.id)}
										className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
										<Trash2 className="w-4 h-4" />
									</button>
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
