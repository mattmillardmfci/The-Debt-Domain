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

		// Filter for negative amounts (expenses/payments)
		const negativeTransactions = transactions.filter((t) => t.amount !== undefined && t.amount < 0);

		// Normalize description: extract the meaningful part (first 3-4 words usually identify the merchant)
		const normalizeDescription = (desc: string): string => {
			if (!desc) return "Unknown";
			// Remove extra spaces and convert to uppercase for comparison
			const cleaned = desc.trim().toUpperCase();

			// Special handling for PayPal transfers - extract the actual service name
			// PayPal descriptions often include "PAYPAL INST XFER SPOTIFY*P3E5D5EP"
			// We want to extract "SPOTIFY" from these
			const paypalMatch = cleaned.match(/PAYPAL.*\*?([A-Z]+)/);
			if (paypalMatch && paypalMatch[1]) {
				return paypalMatch[1];
			}

			// Extract first few meaningful words (usually merchant name)
			const words = cleaned.split(/\s+/);
			// Filter out common transfer-related words that don't identify the merchant
			const filteredWords = words.filter(
				(word) => !["ACH", "XFER", "EXT", "TRNSFR", "INST", "TRANSFER", "PAYPAL"].includes(word),
			);

			// Take first 3-4 meaningful words which usually identify the merchant
			const meaningfulWords = filteredWords.slice(0, 4);
			return meaningfulWords.length > 0 ? meaningfulWords.join(" ") : words.slice(0, 4).join(" ");
		};

		// NEW APPROACH: Group by CHARGE AMOUNT first, then verify vendor consistency
		// This prevents grouping different purchases from the same vendor
		// (e.g., different pharmacy items with different costs)

		interface ChargeGroup {
			amount: number; // in cents (absolute value)
			vendors: Set<string>; // normalized vendor names
			transactions: Partial<Transaction>[];
		}

		// Round amounts to nearest 5 cents to handle minor variation (e.g., $9.12 vs $9.13)
		const roundAmount = (amount: number): number => Math.round(Math.abs(amount) / 5) * 5;

		// Group by rounded charge amount
		const chargeGroups = new Map<number, ChargeGroup>();
		negativeTransactions.forEach((t) => {
			const roundedAmount = roundAmount(t.amount || 0);
			const normalizedDesc = normalizeDescription(t.description || "Unknown");

			if (!chargeGroups.has(roundedAmount)) {
				chargeGroups.set(roundedAmount, {
					amount: roundedAmount,
					vendors: new Set(),
					transactions: [],
				});
			}

			const group = chargeGroups.get(roundedAmount)!;
			group.vendors.add(normalizedDesc);
			group.transactions.push(t);
		});

		// Filter for recurring (2+ occurrences) and calculate stats
		const patterns: RecurringDebtPattern[] = [];
		chargeGroups.forEach((chargeGroup) => {
			if (chargeGroup.transactions.length >= 2) {
				const transactions = chargeGroup.transactions;
				const amounts = transactions.map((t) => t.amount || 0).filter((a) => a !== 0);
				const totalAmount = amounts.reduce((a, b) => a + b, 0);
				// Convert from cents to dollars by dividing by 100
				const avgAmount = amounts.length > 0 ? totalAmount / amounts.length / 100 : 0;
				const totalAmountDollars = totalAmount / 100;

				// IMPROVED VALIDATION: For same-amount charges, require VERY consistent vendor names
				// (within reasonable normalization tolerance)
				// This catches cases like "AMAZON PRIME" vs "AMAZON PRIME PMTS Amzn.com/bill"
				const vendors = Array.from(chargeGroup.vendors);

				// If we have multiple different vendor names for the same charge amount,
				// try to find a common base (e.g., "AMAZON" appears in both)
				let mainVendor = vendors[0];
				if (vendors.length > 1) {
					// Check if all vendors share a common word (the main merchant name)
					const allWords = vendors.flatMap((v) => v.split(/\s+/));
					const wordCounts = new Map<string, number>();
					allWords.forEach((word) => {
						wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
					});

					// Find the most common word that appears in multiple vendors
					let commonWord = "";
					let maxCount = 0;
					wordCounts.forEach((count, word) => {
						if (count >= Math.ceil(vendors.length / 2) && word.length > 2 && count > maxCount) {
							commonWord = word;
							maxCount = count;
						}
					});

					// If we found a common word (likely the main merchant), validate it
					if (commonWord) {
						mainVendor = commonWord;
						// Verify that all vendors contain the main word
						const allVendorsHaveCommonWord = vendors.every((v) => v.includes(commonWord));
						if (!allVendorsHaveCommonWord) {
							// Vendors don't share a common merchant name - likely different charges
							return;
						}
					} else {
						// Multiple different vendors for same amount - likely different charges
						// Skip this unless they're very similar
						const firstVendor = vendors[0];
						const allSimilar = vendors.every((v) => {
							const similarity = (a: string, b: string) => {
								const aParts = a.split(/\s+/);
								const bParts = b.split(/\s+/);
								const common = aParts.filter((part) => bParts.includes(part)).length;
								return common > 0;
							};
							return similarity(firstVendor, v);
						});

						if (!allSimilar) {
							// Vendors are too different - skip this charge group
							return;
						}
					}
				}

				// Calculate coefficient of variation to ensure amount consistency
				// (should be very low since we grouped by amount, but check for rounding variance)
				const mean = Math.abs(avgAmount);
				if (mean > 0) {
					const variance =
						amounts.reduce((sum, amount) => {
							const absDollars = Math.abs(amount / 100);
							return sum + Math.pow(absDollars - mean, 2);
						}, 0) / amounts.length;
					const stdDev = Math.sqrt(variance);
					const coefficientOfVariation = stdDev / mean;

					// For charge-based grouping, amounts should be nearly identical
					// Use stricter threshold (10%) than vendor-based (30%)
					if (coefficientOfVariation > 0.1) {
						// Skip this pattern - amounts vary too much for same charge
						return;
					}
				}

				// Get the most recent category for this recurring transaction
				const mostRecentTransaction = transactions.sort(
					(a, b) => (b.date instanceof Date ? b.date.getTime() : 0) - (a.date instanceof Date ? a.date.getTime() : 0),
				)[0];
				const category = mostRecentTransaction?.category || "Other";
				// Use the most recent (original) description for display
				const description = mostRecentTransaction?.description || mainVendor;

				// Get last occurrence date
				const lastOccurrence = transactions
					.map((t) => (t.date instanceof Date ? t.date : new Date(t.date || 0)))
					.sort((a, b) => b.getTime() - a.getTime())[0];

				// Estimate frequency based on date gaps
				let estimatedFrequency = "multiple";
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
						if (avgGap < 10) estimatedFrequency = "weekly";
						else if (avgGap < 20) estimatedFrequency = "biweekly";
						else if (avgGap < 40) estimatedFrequency = "monthly";
						else if (avgGap < 100) estimatedFrequency = "quarterly";
						else estimatedFrequency = "annual";
					} else if (transactions.length >= 2) {
						// With 2+ transactions but no gap data, assume monthly
						// This handles cases with minimal transaction history
						estimatedFrequency = "monthly";
					}
				}

				// Only include patterns that are at least biweekly or more frequent
				// (exclude quarterly/annual as they're not true "monthly expenses")
				if (estimatedFrequency === "weekly" || estimatedFrequency === "biweekly" || estimatedFrequency === "monthly") {
					// Filter out expenses that haven't occurred in the last 6 months
					const now = new Date();
					const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

					if (lastOccurrence >= sixMonthsAgo) {
						patterns.push({
							description,
							category,
							count: transactions.length,
							avgAmount: Math.round(avgAmount * 100) / 100,
							totalAmount: Math.round(totalAmountDollars * 100) / 100,
							lastOccurrence,
							estimatedFrequency,
						});
					}
				}
			}
		});

		// Sort by frequency (most recent first)
		return patterns.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());
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
			await currentUser.delete();
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
	},
) {
	try {
		const ref = collection(db, "users", userId, "customRecurringExpenses");
		const docId = `${expense.description}-${expense.amount}`.replace(/\s+/g, "-");
		await setDoc(doc(ref, docId), {
			...expense,
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
				count: 0, // Custom expenses don't have transaction count
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
		const docId = `${description}-${amount}`.replace(/\s+/g, "-");
		await deleteDoc(doc(ref, docId));
	} catch (error) {
		console.error("Error deleting custom recurring expense:", error);
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

		// Group by amount (rounded to nearest cent) and find patterns with 2+ occurrences
		const amountGroups = new Map<number, Partial<Transaction>[]>();
		negativeTransactions.forEach((t) => {
			const roundedAmount = Math.round(Math.abs(t.amount || 0) * 100) / 100;
			if (!amountGroups.has(roundedAmount)) {
				amountGroups.set(roundedAmount, []);
			}
			amountGroups.get(roundedAmount)!.push(t);
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
