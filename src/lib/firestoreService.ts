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
	writeBatch,
	setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";
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
		const data: any = {};

		// Only update the fields that are being changed
		for (const [key, value] of Object.entries(updates)) {
			if (key === "date") {
				// Skip date field - it's handled specially
				continue;
			}
			data[key] = value;
		}

		data.updatedAt = Timestamp.now();
		await updateDoc(ref, data);
	} catch (error) {
		console.error("Error updating transaction:", error);
		throw error;
	}
}

/**
 * Bulk rename all transactions with a specific description
 */
export async function bulkRenameTransactionDescription(
	userId: string,
	oldDescription: string,
	newDescription: string,
): Promise<number> {
	try {
		const ref = getTransactionsRef(userId);
		const q = query(ref, where("description", "==", oldDescription));
		const snapshot = await getDocs(q);
		let count = 0;

		// Batch updates for efficiency
		const batch = writeBatch(db);
		snapshot.forEach((doc) => {
			batch.update(doc.ref, {
				description: newDescription,
				updatedAt: Timestamp.now(),
			});
			count++;
		});

		await batch.commit();
		return count;
	} catch (error) {
		console.error("Error bulk renaming transactions:", error);
		throw error;
	}
}

/**
 * Bulk rename a category everywhere: transactions, recurring expenses, debts, budgets
 * This is used when renaming auto-categorized categories universally
 */
export async function bulkRenameCategoryEverywhere(
	userId: string,
	oldCategoryName: string,
	newCategoryName: string,
): Promise<{ transactions: number; expenses: number; budgets: number; debts: number }> {
	try {
		const batch = writeBatch(db);
		let transactionCount = 0;
		let expenseCount = 0;
		let budgetCount = 0;
		let debtCount = 0;

		// 1. Rename in transactions
		const transactionsRef = getTransactionsRef(userId);
		const transactionsQuery = query(transactionsRef, where("category", "==", oldCategoryName));
		const transactionsSnapshot = await getDocs(transactionsQuery);
		transactionsSnapshot.forEach((doc) => {
			batch.update(doc.ref, {
				category: newCategoryName,
				updatedAt: Timestamp.now(),
			});
			transactionCount++;
		});

		// 2. Rename in recurring expense overrides
		const expensesRef = collection(db, "users", userId, "recurringExpenseOverrides");
		const expensesQuery = query(expensesRef, where("categoryOverride", "==", oldCategoryName));
		const expensesSnapshot = await getDocs(expensesQuery);
		expensesSnapshot.forEach((doc) => {
			batch.update(doc.ref, { categoryOverride: newCategoryName });
			expenseCount++;
		});

		// 3. Rename in budgets
		const budgetsRef = collection(db, "users", userId, "budgets");
		const budgetsQuery = query(budgetsRef, where("category", "==", oldCategoryName));
		const budgetsSnapshot = await getDocs(budgetsQuery);
		budgetsSnapshot.forEach((doc) => {
			batch.update(doc.ref, { category: newCategoryName });
			budgetCount++;
		});

		// 4. Rename in debts (if they have a category field)
		const debtsRef = getDebtsRef(userId);
		const debtsQuery = query(debtsRef, where("category", "==", oldCategoryName));
		const debtsSnapshot = await getDocs(debtsQuery);
		debtsSnapshot.forEach((doc) => {
			batch.update(doc.ref, { category: newCategoryName });
			debtCount++;
		});

		await batch.commit();

		return {
			transactions: transactionCount,
			expenses: expenseCount,
			budgets: budgetCount,
			debts: debtCount,
		};
	} catch (error) {
		console.error("Error bulk renaming category everywhere:", error);
		throw error;
	}
}

/**
 * Get all transactions (for debt detection and other analysis)
 */
export async function getAllTransactions(userId: string): Promise<(Partial<Transaction> & { id: string })[]> {
	try {
		const ref = getTransactionsRef(userId);
		const q = query(ref, orderBy("date", "desc"));
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

		return transactions;
	} catch (error) {
		console.error("Error fetching all transactions:", error);
		return [];
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
 * Detect recurring debts from transaction patterns
 */
export interface RecurringDebtPattern {
	description: string;
	category?: string;
	count: number;
	avgAmount: number;
	totalAmount: number;
	lastOccurrence: Date;
	estimatedFrequency?: string;
}

export async function detectRecurringDebts(userId: string): Promise<RecurringDebtPattern[]> {
	try {
		const transactions = await getAllTransactions(userId);
		const ignoredExpenses = await getIgnoredRecurringExpenses(userId);

		// Filter for negative amounts (expenses/payments)
		const negativeTransactions = transactions.filter((t) => t.amount !== undefined && t.amount < 0);

		// Helper: Normalize vendor description for fuzzy matching
		const normalizeVendor = (desc: string): string => {
			return (
				desc
					.toLowerCase()
					.trim()
					// Remove common patterns
					.replace(/\s*(debit|credit|payment|withdrawal|transfer|purchase|refund)\s*/gi, " ")
					// Remove trailing account numbers or reference numbers
					.replace(/\s*[\d]{4,}\s*$/g, "")
					// Remove extra spaces
					.replace(/\s+/g, " ")
					.trim()
			);
		};

		// Helper: Calculate Levenshtein distance for fuzzy matching
		const levenshteinDistance = (a: string, b: string): number => {
			const aLen = a.length;
			const bLen = b.length;
			const dp: number[][] = Array(aLen + 1)
				.fill(null)
				.map(() => Array(bLen + 1).fill(0));

			for (let i = 0; i <= aLen; i++) dp[i][0] = i;
			for (let j = 0; j <= bLen; j++) dp[0][j] = j;

			for (let i = 1; i <= aLen; i++) {
				for (let j = 1; j <= bLen; j++) {
					const cost = a[i - 1] === b[j - 1] ? 0 : 1;
					dp[i][j] = Math.min(dp[i][j - 1] + 1, dp[i + 1][j - 1] + 1, dp[i][j - 1] + cost);
				}
			}
			return dp[aLen][bLen];
		};

		// Helper: Check if two vendor names are similar enough (>80% match)
		const isVendorSimilar = (vendor1: string, vendor2: string): boolean => {
			if (vendor1 === vendor2) return true;
			const norm1 = normalizeVendor(vendor1);
			const norm2 = normalizeVendor(vendor2);
			if (norm1 === norm2) return true;

			// Allow up to 30% character difference for fuzzy matching
			const maxDistance = Math.max(norm1.length, norm2.length) * 0.2;
			return levenshteinDistance(norm1, norm2) <= maxDistance;
		};

		// Helper: Detect if description is a check
		const isCheckTransaction = (desc: string): boolean => {
			const checkPatterns = [/check\s*#/i, /^chk\s*/i, /^check$/i, /^ck\s*/i];
			return checkPatterns.some((pattern) => pattern.test(desc));
		};

		// Group transactions by vendor+amount combination
		// This groups transactions with BOTH similar vendor names AND similar amounts
		interface ChargeGroup {
			description: string;
			normalizedDescription: string;
			amount: number; // median amount in dollars
			transactions: Partial<Transaction>[];
		}

		const chargeGroups: ChargeGroup[] = [];

		negativeTransactions.forEach((t) => {
			const description = (t.description || "Unknown").trim();
			const amount = Math.abs(t.amount || 0) / 100; // Convert cents to dollars

			// Try to find existing group with BOTH similar vendor AND similar amount
			let foundGroup = chargeGroups.find((group) => {
				const vendorMatch = isVendorSimilar(group.description, description);
				const amountMatch = Math.abs(group.amount - amount) / Math.max(Math.abs(group.amount), Math.abs(amount)) < 0.05; // Within 5%
				return vendorMatch && amountMatch;
			});

			if (!foundGroup) {
				foundGroup = {
					description,
					normalizedDescription: normalizeVendor(description),
					amount,
					transactions: [],
				};
				chargeGroups.push(foundGroup);
			}

			foundGroup.transactions.push(t);
		});

		// Filter and create patterns
		const patterns: RecurringDebtPattern[] = [];

		chargeGroups.forEach((chargeGroup) => {
			const txnCount = chargeGroup.transactions.length;

			// Determine minimum threshold based on confidence
			let minOccurrences = 3;

			// Lower threshold for high-confidence patterns
			const isCheck = isCheckTransaction(chargeGroup.description);
			if (isCheck) {
				// Checks with patterns like $300 weekly or $1200 monthly need just 2+ occurrences
				// But ONLY if the amount is consistent (already checked in grouping)
				minOccurrences = 2;
			} else if (
				chargeGroup.normalizedDescription.toLowerCase().includes("spotify") ||
				chargeGroup.normalizedDescription.toLowerCase().includes("netflix") ||
				chargeGroup.normalizedDescription.toLowerCase().includes("subscription") ||
				chargeGroup.normalizedDescription.toLowerCase().includes("membership")
			) {
				// Subscription services with consistent amounts
				minOccurrences = 2;
			}

			if (txnCount >= minOccurrences) {
				const transactions = chargeGroup.transactions;
				const amounts = transactions.map((t) => Math.abs(t.amount || 0) / 100);
				const amountDollars = amounts.reduce((a, b) => a + b, 0) / amounts.length;

				// Get the most recent category
				const mostRecentTransaction = transactions.sort(
					(a, b) => (b.date instanceof Date ? b.date.getTime() : 0) - (a.date instanceof Date ? a.date.getTime() : 0),
				)[0];
				const category = mostRecentTransaction?.category || "Other";
				const description = chargeGroup.description;

				// Get last occurrence date
				const lastOccurrence = transactions
					.map((t) => (t.date instanceof Date ? t.date : new Date(t.date || 0)))
					.sort((a, b) => b.getTime() - a.getTime())[0];

				// Estimate frequency based on date gaps
				let estimatedFrequency = "monthly"; // default to monthly
				if (transactions.length >= 2) {
					const dates = transactions
						.map((t) => (t.date instanceof Date ? t.date : new Date(t.date || 0)))
						.sort((a, b) => a.getTime() - b.getTime());

					const gaps: number[] = [];
					for (let i = 1; i < dates.length; i++) {
						const diffDays = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
						gaps.push(diffDays);
					}

					if (gaps.length > 0) {
						const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
						const gapStdDev = Math.sqrt(gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length);

						// Special handling for checks: look for weekly or monthly patterns
						if (isCheck) {
							if (avgGap <= 8) {
								estimatedFrequency = "weekly";
							} else if (avgGap >= 20 && avgGap <= 35) {
								estimatedFrequency = "monthly";
							} else {
								estimatedFrequency = "biweekly";
							}
						} else {
							// Detect frequency based on gap patterns
							if (avgGap < 10) {
								estimatedFrequency = "weekly";
							} else if (avgGap < 18) {
								estimatedFrequency = "biweekly";
							} else if (avgGap >= 25 && avgGap <= 35) {
								estimatedFrequency = "monthly";
							} else if (avgGap < 40) {
								// Uncertain range: use gap consistency as tiebreaker
								if (gapStdDev < 5) {
									estimatedFrequency = "monthly";
								} else {
									estimatedFrequency = "biweekly";
								}
							} else if (avgGap < 100) {
								estimatedFrequency = "quarterly";
							} else {
								estimatedFrequency = "annual";
							}
						}
					}
				}

				// Only include patterns that are at least biweekly or more frequent
				if (estimatedFrequency === "weekly" || estimatedFrequency === "biweekly" || estimatedFrequency === "monthly") {
					// Filter out expenses that haven't occurred in the last 6 months
					const now = new Date();
					const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

					if (lastOccurrence >= sixMonthsAgo) {
						patterns.push({
							description,
							category,
							count: transactions.length,
							avgAmount: amountDollars,
							totalAmount: Math.round(amountDollars * transactions.length * 100) / 100,
							lastOccurrence,
							estimatedFrequency,
						});
					}
				}
			}
		});

		// Filter out ignored expenses
		const filteredPatterns = patterns.filter((pattern) => {
			return !ignoredExpenses.some(
				(ignored) => ignored.description === pattern.description && Math.abs(ignored.amount - pattern.avgAmount) < 0.01, // Allow for floating point rounding
			);
		});

		// Sort by frequency (most recent first)
		return filteredPatterns.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());
	} catch (error) {
		console.error("Error detecting recurring debts:", error);
		return [];
	}
}

/**
 * Detect recurring income sources from transaction history
 * Analyzes salary/income transactions to estimate monthly income based on patterns
 */
export interface IncomePattern {
	description: string;
	amount: number; // Average per paycheck in dollars
	frequency: string; // weekly, biweekly, monthly
	monthlyAmount: number; // Calculated monthly income
	count: number;
	lastOccurrence: Date;
}

export async function detectIncomePatterns(userId: string): Promise<IncomePattern[]> {
	try {
		const transactions = await getAllTransactions(userId);

		// Filter for positive amounts (income) that match salary-like descriptions
		const salaryTransactions = transactions.filter((t) => {
			const isIncome = t.amount !== undefined && t.amount > 0;
			const isSalaryCategory =
				t.category === "Salary" ||
				(t.description &&
					(t.description.toLowerCase().includes("salary") ||
						t.description.toLowerCase().includes("paycheck") ||
						t.description.toLowerCase().includes("payroll") ||
						t.description.toLowerCase().includes("income")));
			return isIncome && isSalaryCategory;
		});

		// Group by description to find patterns
		const grouped = new Map<string, Partial<Transaction>[]>();
		salaryTransactions.forEach((t) => {
			const desc = t.description || "Unknown";
			if (!grouped.has(desc)) {
				grouped.set(desc, []);
			}
			grouped.get(desc)!.push(t);
		});

		// Find recurring income patterns (2+ occurrences)
		const patterns: IncomePattern[] = [];
		grouped.forEach((transactions, description) => {
			if (transactions.length >= 2) {
				const amounts = transactions.map((t) => t.amount || 0).filter((a) => a !== 0);
				const avgAmount = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length / 100 : 0; // Convert cents to dollars

				// Get last occurrence date
				const lastOccurrence = transactions
					.map((t) => (t.date instanceof Date ? t.date : new Date(t.date || 0)))
					.sort((a, b) => b.getTime() - a.getTime())[0];

				// Estimate frequency based on date gaps and day-of-month patterns
				let estimatedFrequency = "monthly";
				let monthlyAmount = avgAmount;

				if (transactions.length >= 3) {
					const dates = transactions
						.map((t) => (t.date instanceof Date ? t.date : new Date(t.date || 0)))
						.sort((a, b) => a.getTime() - b.getTime());

					const gaps: number[] = [];
					for (let i = 1; i < dates.length; i++) {
						const diffDays = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
						gaps.push(diffDays);
					}

					if (gaps.length > 0) {
						const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

						// Check if this is semi-monthly (twice a month) vs biweekly
						// Semi-monthly: typically occurs on specific days like 1st and 15th, or 15th and 30th
						if (avgGap >= 12 && avgGap <= 18) {
							// Could be either semi-monthly or biweekly
							// Analyze the day-of-month pattern and transaction count to distinguish
							const dayOfMonths = dates.map((d) => d.getDate());

							// For semi-monthly, we expect typically 2 distinct day-of-month values
							// (e.g., around 1st and 15th, or 15th and 30th)
							const uniqueDays = new Set(dayOfMonths);

							// Count how many months have approximately 2 paychecks
							const monthlyPaychecks = new Map<string, number>();
							dates.forEach((d) => {
								const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
								monthlyPaychecks.set(monthKey, (monthlyPaychecks.get(monthKey) || 0) + 1);
							});

							// If most months have 2 paychecks and there are 2 distinct days, it's likely semi-monthly
							const monthsWithTwoPaychecks = Array.from(monthlyPaychecks.values()).filter(
								(count) => count === 2,
							).length;
							const totalMonths = monthlyPaychecks.size;

							// Use transaction count as additional confirmation:
							// Semi-monthly: ~24 paychecks/year, Biweekly: ~26 paychecks/year
							const monthsOfData =
								(dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24 * 30);
							const paychecksPerYear = monthsOfData > 0 ? (transactions.length / monthsOfData) * 12 : 0;

							// Decision logic:
							// 1. If pattern shows 2 consistent days per month (semi-monthly pattern), prefer semi-monthly
							// 2. Use paycheck count as tiebreaker: < 25/year = semi-monthly, >= 25/year = biweekly
							if (uniqueDays.size === 2 && monthsWithTwoPaychecks >= totalMonths * 0.7) {
								// Clear semi-monthly pattern: 2 distinct days, most months have 2 paychecks
								estimatedFrequency = "semi-monthly";
								monthlyAmount = avgAmount * 2;
							} else if (avgGap >= 12 && avgGap <= 16 && paychecksPerYear > 25) {
								// Biweekly pattern: 14-day gap, count suggests 26+ per year
								estimatedFrequency = "biweekly";
								monthlyAmount = avgAmount * (26 / 12);
							} else if (
								paychecksPerYear <= 25 ||
								(uniqueDays.size === 2 && monthsWithTwoPaychecks >= totalMonths * 0.6)
							) {
								// Count suggests semi-monthly (< 25/year) or pattern suggests 2 days per month
								estimatedFrequency = "semi-monthly";
								monthlyAmount = avgAmount * 2;
							} else {
								// Default to biweekly if ambiguous
								estimatedFrequency = "biweekly";
								monthlyAmount = avgAmount * (26 / 12);
							}
						} else if (avgGap < 10) {
							estimatedFrequency = "weekly";
							monthlyAmount = avgAmount * (52 / 12);
						} else if (avgGap >= 25 && avgGap < 40) {
							estimatedFrequency = "monthly";
							monthlyAmount = avgAmount;
						} else if (avgGap < 100) {
							estimatedFrequency = "quarterly";
							monthlyAmount = avgAmount / 3;
						} else {
							estimatedFrequency = "annual";
							monthlyAmount = avgAmount / 12;
						}
					}
				}

				patterns.push({
					description,
					amount: avgAmount,
					frequency: estimatedFrequency,
					monthlyAmount,
					count: transactions.length,
					lastOccurrence,
				});
			}
		});

		// Sort by most recent first
		return patterns.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());
	} catch (error) {
		console.error("Error detecting income patterns:", error);
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
			collection(db, "users", userId, "customRecurringExpenses"),
			collection(db, "users", userId, "ignoredRecurringExpenses"),
			collection(db, "users", userId, "recurringExpenseOverrides"),
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

/**
 * Delete the entire user profile including auth account and all Firestore data
 * This allows the user to completely recreate their profile with the same email
 */
export async function deleteUserProfile(userId: string) {
	try {
		// First delete all Firestore data
		await deleteAllUserData(userId);

		// Then delete the authentication account
		const currentUser = auth.currentUser;
		if (currentUser && currentUser.uid === userId) {
			try {
				await currentUser.delete();
			} catch (authError: any) {
				// Check for requires-recent-login error
				if (authError.code === "auth/requires-recent-login") {
					throw new Error(
						"REQUIRES_REAUTHENTICATION: Please log out and log back in, then try deleting your account again.",
					);
				}
				throw authError;
			}
		}
	} catch (error) {
		console.error("Error deleting user profile:", error);
		throw error;
	}
}

/**
 * Save ignored recurring expense (when user removes it from tracking)
 */
export async function saveIgnoredRecurringExpense(
	userId: string,
	expense: {
		description: string;
		amount: number;
		vendor: string;
		reason: string;
	},
) {
	try {
		const ref = collection(db, "users", userId, "ignoredRecurringExpenses");
		await addDoc(ref, {
			...expense,
			createdAt: Timestamp.now(),
		});
	} catch (error) {
		console.error("Error saving ignored recurring expense:", error);
		throw error;
	}
}

/**
 * Get all ignored recurring expenses
 */
export async function getIgnoredRecurringExpenses(
	userId: string,
): Promise<Array<{ description: string; amount: number }>> {
	try {
		const ref = collection(db, "users", userId, "ignoredRecurringExpenses");
		const snapshot = await getDocs(ref);
		return snapshot.docs.map((doc) => {
			const data = doc.data();
			return {
				description: data.description,
				amount: data.amount,
			};
		});
	} catch (error) {
		console.error("Error getting ignored recurring expenses:", error);
		return [];
	}
}

/**
 * Save override for recurring expense (category change, description override)
 */
export async function updateRecurringExpenseOverride(
	userId: string,
	override: {
		originalDescription: string;
		amount: number;
		categoryOverride?: string;
		descriptionOverride?: string;
	},
) {
	try {
		const ref = collection(db, "users", userId, "recurringExpenseOverrides");
		// Use original description + amount as composite key
		const docId = `${override.originalDescription}-${override.amount}`.replace(/\s+/g, "-");
		await setDoc(doc(ref, docId), {
			...override,
			updatedAt: Timestamp.now(),
		});
	} catch (error) {
		console.error("Error updating recurring expense override:", error);
		throw error;
	}
}

/**
 * Get all recurring expense overrides
 */
export async function getRecurringExpenseOverrides(
	userId: string,
): Promise<
	Array<{
		originalDescription: string;
		amount: number;
		categoryOverride?: string;
		descriptionOverride?: string;
	}>
> {
	try {
		const ref = collection(db, "users", userId, "recurringExpenseOverrides");
		const snapshot = await getDocs(ref);
		return snapshot.docs.map((doc) => doc.data() as any);
	} catch (error) {
		console.error("Error getting recurring expense overrides:", error);
		return [];
	}
}

/**
 * Save a custom recurring expense (user-created, not auto-detected)
 */
export async function saveCustomRecurringExpense(
	userId: string,
	expense: {
		description: string;
		amount: number;
		frequency: string;
		category: string;
		lastOccurrence: Date;
		count?: number; // Optional: preserve original detection count
	},
) {
	try {
		const ref = collection(db, "users", userId, "customRecurringExpenses");
		// Round to 2 decimal places to ensure consistency with delete operations
		const roundedAmount = Math.round(expense.amount * 100) / 100;
		const docId = `${expense.description}-${roundedAmount}`.replace(/\s+/g, "-");
		await setDoc(doc(ref, docId), {
			...expense,
			amount: roundedAmount,
			count: expense.count || 0, // Store the count for later retrieval
			lastOccurrence: Timestamp.fromDate(expense.lastOccurrence),
			createdAt: Timestamp.now(),
		});
	} catch (error) {
		console.error("Error saving custom recurring expense:", error);
		throw error;
	}
}

/**
 * Get all custom recurring expenses
 */
export async function getCustomRecurringExpenses(userId: string): Promise<RecurringDebtPattern[]> {
	try {
		const ref = collection(db, "users", userId, "customRecurringExpenses");
		const snapshot = await getDocs(ref);
		return snapshot.docs.map((doc) => {
			const data = doc.data();
			return {
				description: data.description,
				amount: data.amount,
				category: data.category,
				count: data.count || 0, // Return stored count from when it was originally detected
				avgAmount: data.amount,
				totalAmount: data.amount,
				lastOccurrence: data.lastOccurrence.toDate(),
				estimatedFrequency: data.frequency,
			};
		});
	} catch (error) {
		console.error("Error getting custom recurring expenses:", error);
		return [];
	}
}

/**
 * Delete a custom recurring expense
 */
export async function deleteCustomRecurringExpense(userId: string, description: string, amount: number) {
	try {
		const ref = collection(db, "users", userId, "customRecurringExpenses");
		// Round to 2 decimal places to handle floating point issues
		const roundedAmount = Math.round(amount * 100) / 100;
		
		// First try to find by description and amount (handles renamed expenses)
		const q = query(
			ref,
			where("description", "==", description),
			where("amount", "==", roundedAmount)
		);
		const snapshot = await getDocs(q);
		
		if (snapshot.empty) {
			// If not found, try the old docId format (for backwards compatibility)
			const docId = `${description}-${roundedAmount}`.replace(/\s+/g, "-");
			await deleteDoc(doc(ref, docId));
		} else {
			// Delete all matching documents (should only be one)
			const batch = writeBatch(db);
			snapshot.docs.forEach((docSnap) => {
				batch.delete(docSnap.ref);
			});
			await batch.commit();
		}
	} catch (error) {
		console.error("Error deleting custom recurring expense:", error);
		throw error;
	}
}

/**
 * Rename all custom recurring expenses with a specific description
 */
export async function bulkRenameRecurringExpenseDescription(
	userId: string,
	oldDescription: string,
	newDescription: string,
) {
	try {
		const ref = collection(db, "users", userId, "customRecurringExpenses");
		const q = query(ref, where("description", "==", oldDescription));
		const snapshot = await getDocs(q);

		const batch = writeBatch(db);
		snapshot.docs.forEach((docSnap) => {
			batch.update(docSnap.ref, { description: newDescription });
		});

		await batch.commit();
	} catch (error) {
		console.error("Error renaming recurring expenses:", error);
		throw error;
	}
}

/**
 * Find undetected recurring transaction patterns
 * Looks for transactions with 2+ occurrences that weren't caught by detectRecurringDebts
 * Returns grouped transactions by amount that could be marked as recurring
 */
export async function findUndetectedRecurringExpenses(userId: string): Promise<
	Array<{
		description: string;
		amount: number;
		count: number;
		lastOccurrence: Date;
		category?: string;
		transactions: Partial<Transaction>[];
	}>
> {
	try {
		const transactions = await getAllTransactions(userId);
		const detectedExpenses = await detectRecurringDebts(userId);

		// Filter for negative amounts (expenses)
		const negativeTransactions = transactions.filter((t) => t.amount !== undefined && t.amount < 0);

		// Create a set of already-detected amounts for quick lookup
		const detectedAmounts = new Set(detectedExpenses.map((e) => Math.round(e.avgAmount * 100) / 100));

		// Group by amount (in dollars, rounded to nearest cent) and find patterns with 2+ occurrences
		// Transaction amounts are stored in cents, so divide by 100
		const amountGroups = new Map<number, Partial<Transaction>[]>();
		negativeTransactions.forEach((t) => {
			const amountInDollars = Math.round((Math.abs(t.amount || 0) / 100) * 100) / 100;
			if (!amountGroups.has(amountInDollars)) {
				amountGroups.set(amountInDollars, []);
			}
			amountGroups.get(amountInDollars)!.push(t);
		});

		// Find groups with 2+ transactions that aren't already detected
		const undetected: Array<{
			description: string;
			amount: number;
			count: number;
			lastOccurrence: Date;
			category?: string;
			transactions: Partial<Transaction>[];
		}> = [];

		amountGroups.forEach((txns, amount) => {
			if (txns.length >= 2 && !detectedAmounts.has(amount)) {
				// Use the most recent transaction's description as the main description
				const mostRecent = txns.sort(
					(a, b) => (b.date instanceof Date ? b.date.getTime() : 0) - (a.date instanceof Date ? a.date.getTime() : 0),
				)[0];

				const lastOccurrence = txns
					.map((t) => (t.date instanceof Date ? t.date : new Date(t.date || 0)))
					.sort((a, b) => b.getTime() - a.getTime())[0];

				undetected.push({
					description: mostRecent?.description || "Unknown",
					amount: -amount, // Negate back to negative for expenses
					count: txns.length,
					lastOccurrence,
					category: mostRecent?.category || "Other",
					transactions: txns,
				});
			}
		});

		// Sort by most recent first
		undetected.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());

		return undetected;
	} catch (error) {
		console.error("Error finding undetected recurring expenses:", error);
		return [];
	}
}
