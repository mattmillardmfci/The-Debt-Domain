"use client";

import { useState } from "react";
import { Debt } from "@/types";
import { Plus, Trash2, Calculator } from "lucide-react";
import Link from "next/link";

export default function DebtsPage() {
	const [debts, setDebts] = useState<Debt[]>([]);
	const [showForm, setShowForm] = useState(false);
	const [formData, setFormData] = useState<Partial<Debt>>({
		type: "credit-card",
		balance: 0,
		interestRate: 0,
		minimumPayment: 0,
		monthlyPayment: 0,
	});

	const handleAddDebt = () => {
		if (!formData.name || formData.balance === undefined) {
			alert("Please fill in all required fields");
			return;
		}

		const newDebt: Debt = {
			id: `debt-${Date.now()}`,
			userId: "current-user-id", // TODO: Get from auth context
			name: formData.name,
			balance: Math.round((formData.balance as number) * 100),
			interestRate: formData.interestRate || 0,
			minimumPayment: Math.round((formData.minimumPayment || 0) * 100),
			monthlyPayment: Math.round((formData.monthlyPayment || formData.minimumPayment || 0) * 100),
			creditor: formData.creditor,
			type: formData.type || "credit-card",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		setDebts([...debts, newDebt]);
		setFormData({
			type: "credit-card",
			balance: 0,
			interestRate: 0,
			minimumPayment: 0,
			monthlyPayment: 0,
		});
		setShowForm(false);
	};

	const handleDeleteDebt = (id: string) => {
		setDebts(debts.filter((d) => d.id !== id));
	};

	const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
	const totalMinimumPayment = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
	const avgInterestRate = debts.length > 0 ? debts.reduce((sum, d) => sum + d.interestRate, 0) / debts.length : 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Your Debts</h1>
				<p className="text-gray-600 dark:text-gray-400 mt-2">Track all your debts and get a personalized payoff plan</p>
			</div>

			{/* Summary Cards */}
			{debts.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Debt</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">${(totalDebt / 100).toFixed(2)}</p>
					</div>
					<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Minimum Payment</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
							${(totalMinimumPayment / 100).toFixed(2)}/mo
						</p>
					</div>
					<div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Interest Rate</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{avgInterestRate.toFixed(1)}%</p>
					</div>
					<div>
						{debts.length > 0 && (
							<Link
								href="/payoff-plan"
								className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
								<Calculator className="w-5 h-5" />
								Create Plan
							</Link>
						)}
					</div>
				</div>
			)}

			{/* Add Debt Form */}
			{showForm ? (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Add New Debt</h2>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Debt Name *</label>
							<input
								type="text"
								placeholder="e.g., Chase Credit Card"
								value={formData.name || ""}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type *</label>
								<select
									value={formData.type || "credit-card"}
									onChange={(e) =>
										setFormData({
											...formData,
											type: e.target.value as any,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500">
									<option value="credit-card">Credit Card</option>
									<option value="personal-loan">Personal Loan</option>
									<option value="student-loan">Student Loan</option>
									<option value="car-loan">Car Loan</option>
									<option value="mortgage">Mortgage</option>
									<option value="other">Other</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Creditor (Optional)
								</label>
								<input
									type="text"
									placeholder="e.g., Chase Bank"
									value={formData.creditor || ""}
									onChange={(e) => setFormData({ ...formData, creditor: e.target.value })}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Balance ($) *</label>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={formData.balance || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											balance: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Interest Rate (%) *
								</label>
								<input
									type="number"
									step="0.1"
									min="0"
									max="100"
									placeholder="0.0"
									value={formData.interestRate || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											interestRate: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Minimum Payment ($)
								</label>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={formData.minimumPayment || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											minimumPayment: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Current Payment ($)
								</label>
								<input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									value={formData.monthlyPayment || ""}
									onChange={(e) =>
										setFormData({
											...formData,
											monthlyPayment: parseFloat(e.target.value) || 0,
										})
									}
									className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
								/>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={handleAddDebt}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
								Add Debt
							</button>
							<button
								onClick={() => setShowForm(false)}
								className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
								Cancel
							</button>
						</div>
					</div>
				</div>
			) : (
				<button
					onClick={() => setShowForm(true)}
					className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
					<Plus className="w-5 h-5" />
					Add Debt
				</button>
			)}

			{/* Debts List */}
			{debts.length > 0 && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Debt
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Balance
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Rate
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Min Payment
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Current Payment
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
										Action
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-200 dark:divide-slate-700">
								{debts.map((debt) => (
									<tr key={debt.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
										<td className="px-6 py-4">
											<div>
												<p className="font-medium text-gray-900 dark:text-white">{debt.name}</p>
												<p className="text-xs text-gray-600 dark:text-gray-400">{debt.creditor || debt.type}</p>
											</div>
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											${(debt.balance / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											{debt.interestRate.toFixed(2)}%
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											${(debt.minimumPayment / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-right text-gray-900 dark:text-white">
											${(debt.monthlyPayment / 100).toFixed(2)}
										</td>
										<td className="px-6 py-4 text-right">
											<button
												onClick={() => handleDeleteDebt(debt.id)}
												className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
												<Trash2 className="w-4 h-4" />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Empty State */}
			{debts.length === 0 && !showForm && (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Debts Added Yet</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Start by adding your debts to get a personalized payoff plan
					</p>
				</div>
			)}
		</div>
	);
}
