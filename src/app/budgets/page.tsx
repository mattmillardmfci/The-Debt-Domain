"use client";

import { useState, useEffect } from "react";
import { Budget, TransactionCategory } from "@/types";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getBudgets, saveBudget, deleteBudget, updateBudget } from "@/lib/firestoreService";

const CATEGORIES: TransactionCategory[] = [
	"Groceries",
	"Gas/Fuel",
	"Restaurants",
	"Utilities",
	"Insurance",
	"Shopping",
	"Entertainment",
	"Transportation",
	"Healthcare",
	"Subscriptions",
];

export default function BudgetsPage() {
	const { user } = useAuth();
	const [budgets, setBudgets] = useState<(Partial<Budget> & { id: string })[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<Budget>>({
		month: new Date().toISOString().slice(0, 7),
		totalBudget: 0,
		categories: [],
	});

	// Load budgets from Firestore
	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		const loadBudgets = async () => {
			try {
				const data = await getBudgets(user.uid);
				setBudgets(data);
			} catch (err) {
				console.error("Failed to load budgets:", err);
			} finally {
				setLoading(false);
			}
		};

		loadBudgets();
	}, [user?.uid]);

	const handleSaveBudget = async () => {
		if (!formData.month || !formData.totalBudget) {
			alert("Please fill in all required fields");
			return;
		}

		if (!user?.uid) {
			alert("You must be logged in");
			return;
		}

		try {
			if (editingId) {
				await updateBudget(user.uid, editingId, formData);
				setBudgets(budgets.map((b) => (b.id === editingId ? { ...b, ...formData } : b)));
				setEditingId(null);
			} else {
				const docId = await saveBudget(user.uid, formData);
				setBudgets([...budgets, { ...formData, id: docId }]);
			}

			setFormData({
				month: new Date().toISOString().slice(0, 7),
				totalBudget: 0,
				categories: [],
			});
			setShowForm(false);
		} catch (err) {
			console.error("Failed to save budget:", err);
			alert("Failed to save budget. Please try again.");
		}
	};

	const handleDeleteBudget = async (id: string) => {
		if (!user?.uid) return;

		if (!confirm("Delete this budget?")) return;

		try {
			await deleteBudget(user.uid, id);
			setBudgets(budgets.filter((b) => b.id !== id));
		} catch (err) {
			console.error("Failed to delete budget:", err);
			alert("Failed to delete budget.");
		}
	};

	const handleEditBudget = (budget: Partial<Budget> & { id: string }) => {
		setEditingId(budget.id);
		setFormData({
			month: budget.month,
			totalBudget: budget.totalBudget,
			categories: budget.categories,
		});
		setShowForm(true);
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setFormData({
			month: new Date().toISOString().slice(0, 7),
			totalBudget: 0,
			categories: [],
		});
		setShowForm(false);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Budgets</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">Create and manage your monthly budgets</p>
				</div>
				{!showForm && (
					<button
						onClick={() => setShowForm(true)}
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
						<Plus className="w-5 h-5" />
						New Budget
					</button>
				)}
			</div>

			{/* Budget Form */}
			{showForm && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
						{editingId ? "Edit Budget" : "Create Budget"}
					</h2>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Month *</label>
							<input
								type="month"
								value={formData.month || ""}
								onChange={(e) => setFormData({ ...formData, month: e.target.value })}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Total Budget ($) *
							</label>
							<input
								type="number"
								step="0.01"
								min="0"
								value={formData.totalBudget || ""}
								onChange={(e) => setFormData({ ...formData, totalBudget: parseFloat(e.target.value) || 0 })}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
							/>
						</div>

						<div className="flex gap-3">
							<button
								onClick={handleSaveBudget}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
								{editingId ? "Update Budget" : "Create Budget"}
							</button>
							<button
								onClick={handleCancelEdit}
								className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Budgets List */}
			{budgets.length === 0 ? (
				<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Budgets Yet</h2>
					<p className="text-gray-600 dark:text-gray-400">Create a budget to track spending by category</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6">
					{budgets.map((budget) => (
						<div
							key={budget.id}
							className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-lg font-semibold text-gray-900 dark:text-white">{budget.month}</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Total Budget: ${budget.totalBudget?.toFixed(2)}
									</p>
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => handleEditBudget(budget)}
										className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
										<Edit2 className="w-4 h-4" />
									</button>
									<button
										onClick={() => handleDeleteBudget(budget.id)}
										className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
										<Trash2 className="w-4 h-4" />
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
