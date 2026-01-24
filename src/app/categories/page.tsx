"use client";

import { useState, useEffect } from "react";
import { CustomCategory } from "@/types";
import { Plus, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import ConfirmModal from "@/components/ConfirmModal";
import {
	getCustomCategories,
	saveCustomCategory,
	deleteCustomCategory,
	updateCustomCategory,
	getTransactions,
	updateTransaction,
	bulkRenameCategoryEverywhere,
} from "@/lib/firestoreService";

const COLORS = [
	"#EF4444",
	"#F97316",
	"#FBBF24",
	"#FACA15",
	"#34D399",
	"#10B981",
	"#06B6D4",
	"#0EA5E9",
	"#3B82F6",
	"#6366F1",
	"#8B5CF6",
	"#D946EF",
];

const COMMON_AUTO_CATEGORIES = [
	"Groceries",
	"Restaurants",
	"Gas/Fuel",
	"Utilities",
	"Entertainment",
	"Shopping",
	"Healthcare",
	"Transportation",
	"Housing",
	"Insurance",
	"Salary",
	"Transfer",
	"Other",
];

export default function CategoriesPage() {
	const { user } = useAuth();
	const { showError, showSuccess } = useAlert();
	const [categories, setCategories] = useState<(Partial<CustomCategory> & { id: string })[]>([]);
	const [transactionCategories, setTransactionCategories] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingAutoCategory, setEditingAutoCategory] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; categoryId: string | null }>({
		isOpen: false,
		categoryId: null,
	});
	const [formData, setFormData] = useState<Partial<CustomCategory>>({
		name: "",
		color: COLORS[0],
	});

	// Load categories from Firestore
	useEffect(() => {
		if (!user?.uid) {
			setLoading(false);
			return;
		}

		const loadCategories = async () => {
			try {
				const data = await getCustomCategories(user.uid);
				setCategories(data);

				// Load transaction categories
				const allTransactions = await getTransactions(user.uid);
				const categoriesFromTransactions = Array.from(new Set(allTransactions.map((t) => t.category || "Other")));
				setTransactionCategories(categoriesFromTransactions);
			} catch (err) {
				console.error("Failed to load categories:", err);
			} finally {
				setLoading(false);
			}
		};

		loadCategories();
	}, [user?.uid]);

	const handleSaveCategory = async () => {
		if (!formData.name) {
			showError("Please enter a category name");
			return;
		}

		if (!user?.uid) {
			showError("You must be logged in");
			return;
		}

		try {
			// Check if we're renaming an auto-category
			if (editingAutoCategory) {
				// This is a rename of an auto-category (e.g., "Groceries" -> "Grocery")
				// Apply the rename globally everywhere
				const oldCategoryName = editingAutoCategory;
				const newCategoryName = formData.name;

				if (oldCategoryName !== newCategoryName) {
					// Bulk rename in all places
					await bulkRenameCategoryEverywhere(user.uid, oldCategoryName, newCategoryName);
				}

				// Update transaction categories in local state
				setTransactionCategories(transactionCategories.map((cat) => (cat === oldCategoryName ? newCategoryName : cat)));

				setEditingAutoCategory(null);
				showSuccess(`Category "${oldCategoryName}" renamed to "${newCategoryName}" everywhere!`);
			} else if (editingId) {
				// This is editing an existing custom category
				const existingCategory = categories.find((c) => c.id === editingId);
				const oldCategoryName = existingCategory?.name;
				const newCategoryName = formData.name;

				// If name changed, update it globally
				if (oldCategoryName && newCategoryName && oldCategoryName !== newCategoryName) {
					await bulkRenameCategoryEverywhere(user.uid, oldCategoryName, newCategoryName);
				}

				await updateCustomCategory(user.uid, editingId, formData);
				setCategories(categories.map((c) => (c.id === editingId ? { ...c, ...formData } : c)));
				setEditingId(null);
				showSuccess("Category updated successfully!");
			} else {
				// This is creating a new custom category
				const docId = await saveCustomCategory(user.uid, formData);
				setCategories([...categories, { ...formData, id: docId }]);
				showSuccess("Category created successfully!");
			}

			setFormData({ name: "", color: COLORS[0] });
			setShowForm(false);
		} catch (err) {
			console.error("Failed to save category:", err);
			showError("Failed to save category. Please try again.");
		}
	};

	const handleDeleteCategory = (id: string) => {
		setDeleteModal({ isOpen: true, categoryId: id });
	};

	const handleConfirmDelete = async () => {
		if (!user?.uid || !deleteModal.categoryId) return;

		setDeleting(true);
		try {
			await deleteCustomCategory(user.uid, deleteModal.categoryId);
			setCategories(categories.filter((c) => c.id !== deleteModal.categoryId));
			setDeleteModal({ isOpen: false, categoryId: null });
		} catch (err) {
			console.error("Failed to delete category:", err);
			showError("Failed to delete category.");
		} finally {
			setDeleting(false);
		}
	};

	const handleEditCategory = (category: Partial<CustomCategory> & { id: string }) => {
		setEditingId(category.id);
		setFormData({ name: category.name, color: category.color });
		setShowForm(true);
	};

	const handleEditAutoCategory = (autoCategoryName: string) => {
		// Check if already customized (by looking for the override marker in description)
		const existing = categories.find((c) => c.description?.includes(`Customized from: ${autoCategoryName}`));
		if (existing) {
			handleEditCategory(existing);
		} else {
			// Start new custom override
			setEditingAutoCategory(autoCategoryName);
			setFormData({ name: autoCategoryName, color: COLORS[0] });
			setShowForm(true);
		}
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setEditingAutoCategory(null);
		setFormData({ name: "", color: COLORS[0] });
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
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white">Categories</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-2">Create and manage custom transaction categories</p>
				</div>
				<Link
					href="/categories/management"
					className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors">
					Manage Transaction Categories
				</Link>
			</div>

			{!showForm && (
				<button
					onClick={() => setShowForm(true)}
					className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
					<Plus className="w-5 h-5" />
					New Category
				</button>
			)}
			{/* Category Form */}
			{showForm && (
				<div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
						{editingId || editingAutoCategory ? "Edit Category" : "Create Category"}
					</h2>

					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name *</label>
							<input
								type="text"
								placeholder="e.g., Coffee Shops"
								value={formData.name || ""}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
							<div className="grid grid-cols-6 gap-2">
								{COLORS.map((color) => (
									<button
										key={color}
										onClick={() => setFormData({ ...formData, color })}
										className={`h-10 rounded-lg transition-all ${formData.color === color ? "ring-2 ring-offset-2 ring-gray-400" : ""}`}
										style={{
											backgroundColor: color,
										}}
										title={color}
									/>
								))}
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={handleSaveCategory}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
								{editingId || editingAutoCategory ? "Update Category" : "Create Category"}
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

			{/* Auto-Categorization Categories */}
			<div className="mt-8">
				<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Auto-Categorized Categories</h2>
				<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Transactions are automatically categorized into these categories based on vendor matching. Click the edit icon
					to customize the name.
				</p>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
					{COMMON_AUTO_CATEGORIES.filter(
						(cat) => !categories.some((c) => c.description?.includes(`Customized from: ${cat}`)),
					).map((category) => (
						<div
							key={category}
							className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-600 rounded-lg border border-gray-200 dark:border-slate-500 p-4 flex items-center justify-between group">
							<span className="font-medium text-gray-900 dark:text-white text-sm flex-1">{category}</span>
							<button
								onClick={() => handleEditAutoCategory(category)}
								className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
								title="Customize this category name">
								<Edit2 className="w-4 h-4" />
							</button>
						</div>
					))}
				</div>
			</div>

			{/* Transaction Categories */}
			{transactionCategories.length > 0 && (
				<div className="mt-8">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Transaction Categories</h2>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Categories found in your transactions</p>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
						{transactionCategories.map((category) => (
							<div
								key={category}
								className="bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/30 rounded-lg border border-amber-200 dark:border-amber-700 p-4 text-center">
								<span className="font-medium text-gray-900 dark:text-white text-sm">{category}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Custom Categories Section */}
			<div className="mt-8">
				<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Custom Categories</h2>
				<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Categories you created or customized for your personal organization
				</p>

				{/* Categories List */}
				{categories.length === 0 ? (
					<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
						<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Custom Categories</h2>
						<p className="text-gray-600 dark:text-gray-400">
							Create custom categories to better organize your transactions
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{categories.map((category) => (
							<div
								key={category.id}
								className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
									<span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => handleEditCategory(category)}
										className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
										<Edit2 className="w-4 h-4" />
									</button>
									<button
										onClick={() => handleDeleteCategory(category.id)}
										className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
										<Trash2 className="w-4 h-4" />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			<ConfirmModal
				isOpen={deleteModal.isOpen}
				title="Delete Category"
				message="Are you sure you want to delete this custom category? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
				isDangerous={true}
				isLoading={deleting}
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteModal({ isOpen: false, categoryId: null })}
			/>
		</div>
	);
}
