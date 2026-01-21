"use client";

import { useState } from "react";
import { parseCSV } from "@/lib/transactionParser";
import { autoCategorizeTransaction, getCategorizationConfidence } from "@/lib/categorizer";
import { saveTransactions } from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";
import { Transaction } from "@/types";
import { Upload, CheckCircle, AlertCircle, Loader } from "lucide-react";
import Link from "next/link";

type UploadStep = "upload" | "preview" | "confirm" | "success";

export default function TransactionUploadPage() {
	const { user } = useAuth();
	const [step, setStep] = useState<UploadStep>("upload");
	const [file, setFile] = useState<File | null>(null);
	const [transactions, setTransactions] = useState<Partial<Transaction>[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [dragActive, setDragActive] = useState(false);

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		const files = e.dataTransfer.files;
		if (files && files[0]) {
			processFile(files[0]);
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			processFile(e.target.files[0]);
		}
	};

	const processFile = async (selectedFile: File) => {
		setError("");
		setFile(selectedFile);
		setLoading(true);

		try {
			// Parse CSV file
			const parsed = await parseCSV(selectedFile);

			if (parsed.length === 0) {
				throw new Error("No valid transactions found in file");
			}

			// Auto-categorize transactions
			const categorized = parsed.map((t) => ({
				...t,
				category: autoCategorizeTransaction(t.description || "", t.merchant, t.amount),
				confidence: getCategorizationConfidence(t.description || "", t.merchant, t.category || "Other"),
			}));

			setTransactions(categorized);
			setStep("preview");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to parse file";
			setError(message);
			setFile(null);
		} finally {
			setLoading(false);
		}
	};

	const handleConfirmUpload = async () => {
		if (!user?.uid) {
			setError("You must be logged in to upload transactions");
			return;
		}

		setLoading(true);
		try {
			// Save transactions to Firestore
			await saveTransactions(user.uid, transactions);
			console.log("Uploaded", transactions.length, "transactions to Firestore");

			// Simulate delay
			await new Promise((resolve) => setTimeout(resolve, 1000));

			setStep("success");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to upload transactions";
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	if (step === "upload") {
		return (
			<div className="max-w-2xl mx-auto space-y-6">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload Bank Statement</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						Upload your bank statement in CSV format to get started
					</p>
				</div>

				{/* Upload Area */}
				<div
					onDragEnter={handleDrag}
					onDragLeave={handleDrag}
					onDragOver={handleDrag}
					onDrop={handleDrop}
					className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
						dragActive
							? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
							: "border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500"
					}`}>
					<input type="file" id="file-upload" onChange={handleFileChange} accept=".csv" className="hidden" />

					<label htmlFor="file-upload" className="cursor-pointer">
						<div className="flex justify-center mb-4">
							<Upload className="w-12 h-12 text-gray-400" />
						</div>
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Drag and drop your CSV file</h2>
						<p className="text-gray-600 dark:text-gray-400 mb-4">Or click to browse your files</p>
						<div className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
							Choose File
						</div>
					</label>
				</div>

				{/* Supported Formats */}
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
					<h3 className="font-semibold text-gray-900 dark:text-white mb-2">Supported Formats</h3>
					<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
						<li>• CSV files with columns: Date, Description, Amount</li>
						<li>• Date formats: MM/DD/YYYY, YYYY-MM-DD</li>
						<li>• At least 120 days of transaction history</li>
					</ul>
				</div>

				{/* Security & Privacy Disclaimer */}
				<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
					<h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
						<svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
							<path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
						</svg>
						Your Financial Data Is Completely Safe
					</h3>
					<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
						<li>
							🔐 <strong>Encrypted Storage:</strong> All data encrypted at rest using industry-standard protocols
						</li>
						<li>
							🔒 <strong>Secure Transmission:</strong> HTTPS and end-to-end encryption in transit
						</li>
						<li>
							👤 <strong>Private & Confidential:</strong> Only YOU can access your financial information
						</li>
						<li>
							🚫 <strong>No Third-Party Access:</strong> We never share, sell, or access your personal data
						</li>
						<li>
							✅ <strong>Firebase Security:</strong> Enterprise-grade security with automatic backups
						</li>
					</ul>
				</div>

				{/* Error Message */}
				{error && (
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex gap-3">
						<AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
						<div>
							<h3 className="font-semibold text-gray-900 dark:text-white">Error</h3>
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{error}</p>
						</div>
					</div>
				)}
			</div>
		);
	}

	if (step === "preview") {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Review Transactions</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						{transactions.length} transactions found • Review and confirm categorization
					</p>
				</div>

				{/* Transaction Table */}
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Date
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Description
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Amount
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Category
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
								{transactions.slice(0, 10).map((t, i) => (
									<tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700">
										<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
											{t.date?.toLocaleDateString()}
										</td>
										<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{t.description}</td>
										<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
											${((t.amount || 0) / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-sm">
											<span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
												{t.category}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{transactions.length > 10 && (
					<p className="text-sm text-gray-600 dark:text-gray-400">Showing 10 of {transactions.length} transactions</p>
				)}

				{/* Actions */}
				<div className="flex gap-3 justify-end">
					<button
						onClick={() => setStep("upload")}
						className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
						Back
					</button>
					<button
						onClick={handleConfirmUpload}
						disabled={loading}
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
						{loading && <Loader className="w-4 h-4 animate-spin" />}
						{loading ? "Uploading..." : "Confirm & Upload"}
					</button>
				</div>
			</div>
		);
	}

	if (step === "success") {
		return (
			<div className="max-w-2xl mx-auto text-center space-y-6 py-12">
				<div className="flex justify-center">
					<CheckCircle className="w-16 h-16 text-green-600" />
				</div>

				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Upload Complete!</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">
						{transactions.length} transactions have been successfully imported & securely encrypted
					</p>
				</div>

				<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-left">
					<h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
						<svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
							<path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
						</svg>
						Your Data Is Safe & Secure
					</h3>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
						Your financial data is now encrypted and stored securely. Only you have access to it.
					</p>
					<ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mb-4">
						<li>🔐 All data encrypted with industry-standard encryption</li>
						<li>🔒 Firebase security prevents unauthorized access</li>
						<li>👤 Only you can view your financial information</li>
						<li>🚫 No third parties have access to your data</li>
					</ul>
					<h3 className="font-semibold text-gray-900 dark:text-white mb-2 mt-4">What's next?</h3>
					<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
						<li>✓ Review transaction categories for accuracy</li>
						<li>✓ Set up your monthly budget based on spending</li>
						<li>✓ Add your debts and create a payoff plan</li>
						<li>✓ Track your financial progress</li>
					</ul>
				</div>
				<div className="flex gap-3 justify-center">
					<Link
						href="/transactions"
						className="px-6 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
						Review Transactions
					</Link>
					<Link
						href="/budgets"
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						Create Budget
					</Link>
				</div>
			</div>
		);
	}

	return null;
}
