"use client";

import {
	collection,
	addDoc,
	query,
	where,
	getDocs,
	deleteDoc,
	doc,
	updateDoc,
	Timestamp,
	QueryConstraint,
	orderBy,
	limit,
	QueryDocumentSnapshot,
	startAfter,
} from "firebase/firestore";
import { db } from "./firebase";
import { Transaction, Debt, Budget, CustomCategory, Income } from "@/types";

/**
 * Get the user's transactions collection reference
 */
function getTransactionsRef(userId: string) {
	return collection(db, "users", userId, "transactions");
}

/**
 * Get the user's debts collection reference
 */
function getDebtsRef(userId: string) {
	return collection(db, "users", userId, "debts");
}

/**
 * Get the user's budgets collection reference
 */
function getBudgetsRef(userId: string) {
	return collection(db, "users", userId, "budgets");
}

/**
 * Get the user's custom categories collection reference
 */
function getCategoriesRef(userId: string) {
	return collection(db, "users", userId, "categories");
}

/**
 * Get the user's income collection reference
 */
function getIncomeRef(userId: string) {
	return collection(db, "users", userId, "income");
}

/**
 * Save a transaction to Firestore
 */
export async function saveTransaction(userId: string, transaction: Partial<Transaction>) {
	try {
		const ref = getTransactionsRef(userId);
		const data = {
			...transaction,
			date: transaction.date instanceof Date ? Timestamp.fromDate(transaction.date) : transaction.date,
			createdAt: Timestamp.now(),
		};
		const docRef = await addDoc(ref, data);
		return docRef.id;
	} catch (error) {
		console.error("Error saving transaction:", error);
		throw error;
	}
}

/**
 * Save multiple transactions to Firestore
 */
export async function saveTransactions(userId: string, transactions: Partial<Transaction>[]) {
	try {
		const ref = getTransactionsRef(userId);
		const promises = transactions.map((t) => {
			const data = {
				...t,
				date: t.date instanceof Date ? Timestamp.fromDate(t.date) : t.date,
				createdAt: Timestamp.now(),
			};
			return addDoc(ref, data);
		});
		const results = await Promise.all(promises);
		return results.map((r) => r.id);
	} catch (error) {
		console.error("Error saving transactions:", error);
		throw error;
	}
}

/**
 * Get all transactions for a user
 */
export async function getTransactions(userId: string): Promise<(Partial<Transaction> & { id: string })[]> {
	try {
		const ref = getTransactionsRef(userId);
		const q = query(ref);
		const snapshot = await getDocs(q);
		const transactions: (Partial<Transaction> & { id: string })[] = [];

		snapshot.forEach((doc) => {
			const data = doc.data();
			transactions.push({
				...data,
				id: doc.id,
				date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
			} as Partial<Transaction> & { id: string });
		});

		return transactions.sort((a, b) => {
			const dateA = a.date instanceof Date ? a.date.getTime() : 0;
			const dateB = b.date instanceof Date ? b.date.getTime() : 0;
			return dateB - dateA;
		});
	} catch (error) {
		console.error("Error fetching transactions:", error);
		return [];
	}
}

/**
 * Get paginated transactions - optimized for fast loading
 * Default loads 50 most recent transactions
 */
export async function getTransactionsPaginated(
	userId: string,
	pageSize: number = 50,
	lastDoc?: QueryDocumentSnapshot,
): Promise<{
	transactions: (Partial<Transaction> & { id: string })[];
	lastDoc: QueryDocumentSnapshot | null;
	hasMore: boolean;
}> {
	try {
		const ref = getTransactionsRef(userId);

		// Build query: order by date descending, limit to pageSize + 1 to check if there are more
		let q = query(ref, orderBy("date", "desc"), limit(pageSize + 1));

		// If we have a last document, start after it for pagination
		if (lastDoc) {
			q = query(ref, orderBy("date", "desc"), startAfter(lastDoc), limit(pageSize + 1));
		}

		const snapshot = await getDocs(q);
		const transactions: (Partial<Transaction> & { id: string })[] = [];
		let newLastDoc: QueryDocumentSnapshot | null = null;
		let hasMore = false;

		for (let i = 0; i < snapshot.docs.length; i++) {
			const doc = snapshot.docs[i];
			// Don't include the extra doc we fetched to check for more
			if (i < pageSize) {
				const data = doc.data();
				transactions.push({
					...data,
					id: doc.id,
					date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
				} as Partial<Transaction> & { id: string });
				newLastDoc = doc;
			} else {
				// There's more data beyond this page
				hasMore = true;
			}
		}

		return {
			transactions,
			lastDoc: newLastDoc,
			hasMore,
		};
	} catch (error) {
		console.error("Error fetching paginated transactions:", error);
		return {
			transactions: [],
			lastDoc: null,
			hasMore: false,
		};
	}
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(userId: string, transactionId: string) {
	try {
		const ref = doc(db, "users", userId, "transactions", transactionId);
		await deleteDoc(ref);
	} catch (error) {
		console.error("Error deleting transaction:", error);
		throw error;
	}
}

/**
 * Update a transaction
 */
export async function updateTransaction(userId: string, transactionId: string, updates: Partial<Transaction>) {
	try {
		const ref = doc(db, "users", userId, "transactions", transactionId);
		const data = {
			...updates,
			date: updates.date instanceof Date ? Timestamp.fromDate(updates.date) : updates.date,
			updatedAt: Timestamp.now(),
		};
		await updateDoc(ref, data);
	} catch (error) {
		console.error("Error updating transaction:", error);
		throw error;
	}
}

/**
 * Save a debt to Firestore
 */
export async function saveDebt(userId: string, debt: Partial<Debt>) {
	try {
		const ref = getDebtsRef(userId);
		const data = {
			...debt,
			createdAt: Timestamp.now(),
		};
		const docRef = await addDoc(ref, data);
		return docRef.id;
	} catch (error) {
		console.error("Error saving debt:", error);
		throw error;
	}
}

/**
 * Get all debts for a user
 */
export async function getDebts(userId: string): Promise<(Partial<Debt> & { id: string })[]> {
	try {
		const ref = getDebtsRef(userId);
		const q = query(ref);
		const snapshot = await getDocs(q);
		const debts: (Partial<Debt> & { id: string })[] = [];

		snapshot.forEach((doc) => {
			debts.push({
				...doc.data(),
				id: doc.id,
			} as Partial<Debt> & { id: string });
		});

		return debts;
	} catch (error) {
		console.error("Error fetching debts:", error);
		return [];
	}
}

/**
 * Delete a debt
 */
export async function deleteDebt(userId: string, debtId: string) {
	try {
		const ref = doc(db, "users", userId, "debts", debtId);
		await deleteDoc(ref);
	} catch (error) {
		console.error("Error deleting debt:", error);
		throw error;
	}
}

/**
 * Update a debt
 */
export async function updateDebt(userId: string, debtId: string, updates: Partial<Debt>) {
	try {
		const ref = doc(db, "users", userId, "debts", debtId);
		await updateDoc(ref, {
			...updates,
			updatedAt: Timestamp.now(),
		});
	} catch (error) {
		console.error("Error updating debt:", error);
		throw error;
	}
}

/**
 * Save a budget to Firestore
 */
export async function saveBudget(userId: string, budget: Partial<Budget>) {
	try {
		const ref = getBudgetsRef(userId);
		const data = {
			...budget,
			createdAt: Timestamp.now(),
		};
		const docRef = await addDoc(ref, data);
		return docRef.id;
	} catch (error) {
		console.error("Error saving budget:", error);
		throw error;
	}
}

/**
 * Get all budgets for a user
 */
export async function getBudgets(userId: string): Promise<(Partial<Budget> & { id: string })[]> {
	try {
		const ref = getBudgetsRef(userId);
		const q = query(ref);
		const snapshot = await getDocs(q);
		const budgets: (Partial<Budget> & { id: string })[] = [];

		snapshot.forEach((doc) => {
			budgets.push({
				...doc.data(),
				id: doc.id,
			} as Partial<Budget> & { id: string });
		});

		return budgets;
	} catch (error) {
		console.error("Error fetching budgets:", error);
		return [];
	}
}

/**
 * Delete a budget
 */
export async function deleteBudget(userId: string, budgetId: string) {
	try {
		const ref = doc(db, "users", userId, "budgets", budgetId);
		await deleteDoc(ref);
	} catch (error) {
		console.error("Error deleting budget:", error);
		throw error;
	}
}

/**
 * Update a budget
 */
export async function updateBudget(userId: string, budgetId: string, updates: Partial<Budget>) {
	try {
		const ref = doc(db, "users", userId, "budgets", budgetId);
		await updateDoc(ref, {
			...updates,
			updatedAt: Timestamp.now(),
		});
	} catch (error) {
		console.error("Error updating budget:", error);
		throw error;
	}
}

/**
 * Save a custom category to Firestore
 */
export async function saveCustomCategory(userId: string, category: Partial<CustomCategory>) {
	try {
		const ref = getCategoriesRef(userId);
		const data = {
			...category,
			createdAt: Timestamp.now(),
		};
		const docRef = await addDoc(ref, data);
		return docRef.id;
	} catch (error) {
		console.error("Error saving category:", error);
		throw error;
	}
}

/**
 * Get all custom categories for a user
 */
export async function getCustomCategories(userId: string): Promise<(Partial<CustomCategory> & { id: string })[]> {
	try {
		const ref = getCategoriesRef(userId);
		const q = query(ref);
		const snapshot = await getDocs(q);
		const categories: (Partial<CustomCategory> & { id: string })[] = [];

		snapshot.forEach((doc) => {
			categories.push({
				...doc.data(),
				id: doc.id,
			} as Partial<CustomCategory> & { id: string });
		});

		return categories;
	} catch (error) {
		console.error("Error fetching categories:", error);
		return [];
	}
}

/**
 * Delete a custom category
 */
export async function deleteCustomCategory(userId: string, categoryId: string) {
	try {
		const ref = doc(db, "users", userId, "categories", categoryId);
		await deleteDoc(ref);
	} catch (error) {
		console.error("Error deleting category:", error);
		throw error;
	}
}

/**
 * Update a custom category
 */
export async function updateCustomCategory(userId: string, categoryId: string, updates: Partial<CustomCategory>) {
	try {
		const ref = doc(db, "users", userId, "categories", categoryId);
		await updateDoc(ref, {
			...updates,
			updatedAt: Timestamp.now(),
		});
	} catch (error) {
		console.error("Error updating category:", error);
		throw error;
	}
}

/**
 * Save income to Firestore
 */
export async function saveIncome(userId: string, income: Partial<Income>) {
	try {
		const ref = getIncomeRef(userId);
		const data = {
			...income,
			startDate: income.startDate instanceof Date ? Timestamp.fromDate(income.startDate) : income.startDate,
			endDate: income.endDate instanceof Date ? Timestamp.fromDate(income.endDate) : income.endDate,
			createdAt: Timestamp.now(),
		};
		const docRef = await addDoc(ref, data);
		return docRef.id;
	} catch (error) {
		console.error("Error saving income:", error);
		throw error;
	}
}

/**
 * Get all income entries for a user
 */
export async function getIncome(userId: string): Promise<(Partial<Income> & { id: string })[]> {
	try {
		const ref = getIncomeRef(userId);
		const q = query(ref);
		const snapshot = await getDocs(q);
		const incomeEntries: (Partial<Income> & { id: string })[] = [];

		snapshot.forEach((doc) => {
			const data = doc.data();
			incomeEntries.push({
				...data,
				id: doc.id,
				startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : new Date(data.startDate),
				endDate:
					data.endDate instanceof Timestamp ? data.endDate.toDate() : data.endDate ? new Date(data.endDate) : undefined,
			} as Partial<Income> & { id: string });
		});

		return incomeEntries;
	} catch (error) {
		console.error("Error fetching income:", error);
		return [];
	}
}

/**
 * Delete income entry
 */
export async function deleteIncome(userId: string, incomeId: string) {
	try {
		const ref = doc(db, "users", userId, "income", incomeId);
		await deleteDoc(ref);
	} catch (error) {
		console.error("Error deleting income:", error);
		throw error;
	}
}

/**
 * Update income entry
 */
export async function updateIncome(userId: string, incomeId: string, updates: Partial<Income>) {
	try {
		const ref = doc(db, "users", userId, "income", incomeId);
		const data = {
			...updates,
			startDate: updates.startDate instanceof Date ? Timestamp.fromDate(updates.startDate) : updates.startDate,
			endDate: updates.endDate instanceof Date ? Timestamp.fromDate(updates.endDate) : updates.endDate,
			updatedAt: Timestamp.now(),
		};
		await updateDoc(ref, data);
	} catch (error) {
		console.error("Error updating income:", error);
		throw error;
	}
}

/**
 * Delete all transactions for a user
 */
export async function deleteAllTransactions(userId: string) {
	try {
		const transactionsRef = getTransactionsRef(userId);
		const snapshot = await getDocs(transactionsRef);

		// Delete all transactions in parallel with batch operations for better performance
		const batchSize = 500; // Firestore batch write limit is 500
		const deletePromises = [];

		for (let i = 0; i < snapshot.docs.length; i += batchSize) {
			const batch = snapshot.docs.slice(i, i + batchSize);
			const batchPromises = batch.map((doc) => deleteDoc(doc.ref));
			deletePromises.push(...batchPromises);
		}

		await Promise.all(deletePromises);
	} catch (error) {
		console.error("Error deleting all transactions:", error);
		throw error;
	}
}

/**
 * Delete all user data (transactions, debts, budgets, categories, income)
 * WARNING: This is destructive and cannot be undone
 */
export async function deleteAllUserData(userId: string) {
	try {
		const collections = [
			getTransactionsRef(userId),
			getDebtsRef(userId),
			getBudgetsRef(userId),
			getCategoriesRef(userId),
			getIncomeRef(userId),
		];

		// Fetch all collections in parallel instead of sequentially
		const snapshots = await Promise.all(collections.map((collectionRef) => getDocs(collectionRef)));

		// Collect all delete promises from all collections and execute in parallel
		const allDeletePromises: Promise<void>[] = [];
		snapshots.forEach((snapshot) => {
			snapshot.docs.forEach((doc) => {
				allDeletePromises.push(deleteDoc(doc.ref));
			});
		});

		await Promise.all(allDeletePromises);
	} catch (error) {
		console.error("Error deleting all user data:", error);
		throw error;
	}
}
