"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export default function TransactionsPage() {
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
					href="/dashboard/transactions/upload"
					className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
					<Plus className="w-5 h-5" />
					Upload Statement
				</Link>
			</div>
		</div>
	);
}
