/**
 * Comprehensive data export/import functionality
 * This module handles exporting and importing all user data to ensure futureproof backups
 * New features can be added to the export format by extending the UserDataExport interface
 */

import { collection, getDocs, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";
import { CustomCategory, Debt, Budget, Income } from "@/types";

/**
 * Comprehensive export format that includes all user data
 * Version field allows for forward compatibility
 */
export interface UserDataExport {
	version: "1.0"; // Increment when adding new fields
	exportDate: string;
	customCategories: Array<CustomCategory & { id: string }>;
	recurringExpenseOverrides: Array<any>;
	ignoredRecurringExpenses: Array<any>;
	incomeEntries: Array<Income & { id: string }>;
	debts: Array<Debt & { id: string }>;
	budgets: Array<Budget & { id: string }>;
	// Future fields can be added here without breaking compatibility
}

/**
 * Export all user data to a JSON file
 * Includes all customizations and personal data for seamless backup/restore
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
	try {
		// Fetch all user data in parallel
		const [customCats, recurringExpOverrides, ignoredExpenses, incomeEntries, debts, budgets] = await Promise.all([
			// Get custom categories
			getDocs(query(collection(db, "users", userId, "categories"))).then((snap) =>
				snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomCategory & { id: string }),
			),
			// Get recurring expense overrides
			getDocs(query(collection(db, "users", userId, "recurringExpenseOverrides"))).then((snap) =>
				snap.docs.map((d) => ({ id: d.id, ...d.data() })),
			),
			// Get ignored recurring expenses
			getDocs(query(collection(db, "users", userId, "ignoredRecurringExpenses"))).then((snap) =>
				snap.docs.map((d) => ({ id: d.id, ...d.data() })),
			),
			// Get income entries
			getDocs(query(collection(db, "users", userId, "income"))).then((snap) =>
				snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Income & { id: string }),
			),
			// Get debts
			getDocs(query(collection(db, "users", userId, "debts"))).then((snap) =>
				snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Debt & { id: string }),
			),
			// Get budgets
			getDocs(query(collection(db, "users", userId, "budgets"))).then((snap) =>
				snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Budget & { id: string }),
			),
		]);

		return {
			version: "1.0",
			exportDate: new Date().toISOString(),
			customCategories: customCats,
			recurringExpenseOverrides: recurringExpOverrides,
			ignoredRecurringExpenses: ignoredExpenses,
			incomeEntries: incomeEntries,
			debts: debts,
			budgets: budgets,
		};
	} catch (error) {
		console.error("Error exporting user data:", error);
		throw new Error("Failed to export user data");
	}
}

/**
 * Import previously exported user data
 * Restores all customizations and personal data without touching transactions
 */
export async function importUserData(userId: string, data: UserDataExport): Promise<void> {
	try {
		// Validate export format
		if (!data.version || data.version !== "1.0") {
			throw new Error("Invalid or unsupported export format version");
		}

		// Import custom categories
		if (data.customCategories && Array.isArray(data.customCategories)) {
			for (const category of data.customCategories) {
				const { id, ...categoryData } = category;
				await addDoc(collection(db, "users", userId, "categories"), {
					...categoryData,
					createdAt:
						categoryData.createdAt instanceof Date ? categoryData.createdAt : new Date(categoryData.createdAt || ""),
					updatedAt:
						categoryData.updatedAt instanceof Date ? categoryData.updatedAt : new Date(categoryData.updatedAt || ""),
				});
			}
		}

		// Import recurring expense overrides
		if (data.recurringExpenseOverrides && Array.isArray(data.recurringExpenseOverrides)) {
			for (const override of data.recurringExpenseOverrides) {
				const { id, ...overrideData } = override;
				await addDoc(collection(db, "users", userId, "recurringExpenseOverrides"), overrideData);
			}
		}

		// Import ignored recurring expenses
		if (data.ignoredRecurringExpenses && Array.isArray(data.ignoredRecurringExpenses)) {
			for (const ignored of data.ignoredRecurringExpenses) {
				const { id, ...ignoredData } = ignored;
				await addDoc(collection(db, "users", userId, "ignoredRecurringExpenses"), ignoredData);
			}
		}

		// Import income entries
		if (data.incomeEntries && Array.isArray(data.incomeEntries)) {
			for (const income of data.incomeEntries) {
				const { id, ...incomeData } = income;
				await addDoc(collection(db, "users", userId, "income"), {
					...incomeData,
					createdAt: incomeData.createdAt instanceof Date ? incomeData.createdAt : new Date(incomeData.createdAt || ""),
					updatedAt: incomeData.updatedAt instanceof Date ? incomeData.updatedAt : new Date(incomeData.updatedAt || ""),
				});
			}
		}

		// Import debts
		if (data.debts && Array.isArray(data.debts)) {
			for (const debt of data.debts) {
				const { id, ...debtData } = debt;
				await addDoc(collection(db, "users", userId, "debts"), {
					...debtData,
					createdAt: debtData.createdAt instanceof Date ? debtData.createdAt : new Date(debtData.createdAt || ""),
					updatedAt: debtData.updatedAt instanceof Date ? debtData.updatedAt : new Date(debtData.updatedAt || ""),
				});
			}
		}

		// Import budgets
		if (data.budgets && Array.isArray(data.budgets)) {
			for (const budget of data.budgets) {
				const { id, ...budgetData } = budget;
				await addDoc(collection(db, "users", userId, "budgets"), {
					...budgetData,
					createdAt: budgetData.createdAt instanceof Date ? budgetData.createdAt : new Date(budgetData.createdAt || ""),
					updatedAt: budgetData.updatedAt instanceof Date ? budgetData.updatedAt : new Date(budgetData.updatedAt || ""),
				});
			}
		}
	} catch (error) {
		console.error("Error importing user data:", error);
		throw new Error(error instanceof Error ? error.message : "Failed to import user data");
	}
}

/**
 * Download exported data as a JSON file
 */
export function downloadDataAsFile(data: UserDataExport, fileName: string = "financial-advisor-export.json"): void {
	const jsonString = JSON.stringify(data, null, 2);
	const blob = new Blob([jsonString], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Parse a JSON file and return the exported data
 */
export async function parseExportFile(file: File): Promise<UserDataExport> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const data = JSON.parse(event.target?.result as string);
				resolve(data as UserDataExport);
			} catch (error) {
				reject(new Error("Invalid JSON file format"));
			}
		};
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}
