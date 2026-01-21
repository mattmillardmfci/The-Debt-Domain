import { Transaction, TransactionCategory } from "@/types";
import Papa from "papaparse";

/**
 * Parse CSV bank statement files
 * Supports common formats: date, description, amount
 */
export async function parseCSV(file: File): Promise<Partial<Transaction>[]> {
	return new Promise((resolve, reject) => {
		Papa.parse(file, {
			header: false,
			skipEmptyLines: true,
			complete: (results) => {
				try {
					const transactions = results.data as any[];
					const parsed = transactions.filter((row) => row.length >= 3).map((row) => parseCSVRow(row));

					// Filter out invalid transactions
					const validTransactions = parsed.filter((t) => t.date && t.amount !== undefined);
					resolve(validTransactions);
				} catch (error) {
					reject(error);
				}
			},
			error: (error) => reject(error),
		});
	});
}

/**
 * Parse a single CSV row to a transaction
 * Handles various date formats and amount formats
 */
function parseCSVRow(row: any[]): Partial<Transaction> {
	const [dateStr, descriptionStr, amountStr, ...rest] = row;

	// Try to parse date (common formats: MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY)
	const date = parseDate(dateStr);
	if (!date) {
		throw new Error(`Invalid date format: ${dateStr}`);
	}

	// Description is typically the merchant/category info
	const description = descriptionStr?.trim() || "Unknown";

	// Amount - handle negative amounts and various formats
	let amount: number | undefined;
	const cleanAmount = amountStr?.toString().replace(/[^\d.-]/g, "");
	if (cleanAmount) {
		amount = Math.round(parseFloat(cleanAmount) * 100); // Convert to cents
	}

	if (amount === undefined || amount === null) {
		throw new Error(`Invalid amount: ${amountStr}`);
	}

	return {
		date,
		description,
		amount,
		merchant: extractMerchant(description),
		category: "Other" as TransactionCategory,
		categoryConfirmed: false,
	};
}

/**
 * Parse various date formats
 */
function parseDate(dateStr: string): Date | null {
	if (!dateStr) return null;

	// Try MM/DD/YYYY
	let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) {
		const [, month, day, year] = match;
		return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
	}

	// Try YYYY-MM-DD
	match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		const [, year, month, day] = match;
		return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
	}

	// Try DD/MM/YYYY
	match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (match) {
		const [, day, month, year] = match;
		// Ambiguous format - assume MM/DD/YYYY (US standard) unless day > 12
		const parsedDay = parseInt(day);
		const parsedMonth = parseInt(month);
		if (parsedDay > 12) {
			return new Date(parseInt(year), parsedMonth - 1, parsedDay);
		}
	}

	try {
		const date = new Date(dateStr);
		if (!isNaN(date.getTime())) {
			return date;
		}
	} catch (error) {
		// Ignore
	}

	return null;
}

/**
 * Extract merchant name from transaction description
 */
function extractMerchant(description: string): string {
	// Remove common prefixes
	let merchant = description
		.replace(/^(DEBIT|CREDIT|TRANSACTION|CHECK|ACH|TRANSFER|WITHDRAWAL|DEPOSIT)[\s-]*/i, "")
		.trim();

	// Extract first meaningful word/segment
	const parts = merchant.split(/[\s-]/);
	merchant = parts.find((p) => p.length > 2) || merchant;

	return merchant.substring(0, 50); // Limit to 50 chars
}

/**
 * Validate a transaction has minimum required fields
 */
export function validateTransaction(transaction: Partial<Transaction>): boolean {
	return !!(transaction.date && transaction.amount !== undefined && transaction.description);
}

/**
 * Calculate date range from transactions
 */
export function getDateRange(transactions: Partial<Transaction>[]): { start: Date; end: Date } {
	const dates = transactions
		.map((t) => t.date)
		.filter((d) => d instanceof Date)
		.sort((a, b) => a!.getTime() - b!.getTime());

	return {
		start: dates[0] || new Date(),
		end: dates[dates.length - 1] || new Date(),
	};
}
