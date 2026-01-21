/**
 * Core domain types for the financial advisor application
 */

export interface User {
	uid: string;
	email: string;
	displayName?: string;
	photoURL?: string;
	createdAt: Date;
	updatedAt: Date;
}

export type TransactionCategory =
	| "Groceries"
	| "Gas/Fuel"
	| "Restaurants"
	| "Utilities"
	| "Insurance"
	| "Shopping"
	| "Entertainment"
	| "Transportation"
	| "Healthcare"
	| "Subscriptions"
	| "Transfer"
	| "Salary"
	| "Debts"
	| "Investment"
	| "Other";

export interface Transaction {
	id: string;
	userId: string;
	date: Date;
	description: string;
	amount: number; // in cents to avoid floating point issues
	merchant?: string;
	category: TransactionCategory;
	categoryConfirmed: boolean;
	userClarification?: string;
	vendorOverride?: string;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface RecurringTransaction {
	id: string;
	userId: string;
	transactionIds: string[];
	description: string;
	merchant?: string;
	amount: number;
	category: TransactionCategory;
	frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
	nextDueDate: Date;
	confirmed: boolean;
	ignored: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface BudgetCategory {
	category: TransactionCategory;
	limit: number; // in cents
	spent: number; // in cents
	percentageUsed: number;
}

export interface Budget {
	id: string;
	userId: string;
	month: string; // YYYY-MM format
	categories: BudgetCategory[];
	totalBudget: number;
	totalSpent: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Debt {
	id: string;
	userId: string;
	name: string;
	balance: number; // in cents
	interestRate: number; // percentage, e.g., 21.5
	minimumPayment: number; // in cents
	monthlyPayment: number; // in cents (can be higher than minimum)
	creditor?: string;
	type: "credit-card" | "personal-loan" | "mortgage" | "car-loan" | "student-loan" | "other";
	createdAt: Date;
	updatedAt: Date;
}

export interface DebtPayoffPlan {
	id: string;
	userId: string;
	debts: Debt[];
	strategy: "snowball" | "avalanche";
	extraPayment: number; // in cents
	schedule: PayoffScheduleMonth[];
	totalInterestPaid: number; // in cents
	monthsToPayoff: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface PayoffScheduleMonth {
	month: number;
	date: Date;
	payments: DebtPayment[];
	remainingBalance: number;
	interestPaid: number;
}

export interface DebtPayment {
	debtId: string;
	debtName: string;
	principal: number; // in cents
	interest: number; // in cents
	total: number; // in cents
	newBalance: number; // in cents
}

export interface StatementUpload {
	id: string;
	userId: string;
	filename: string;
	fileType: "csv" | "ofx" | "pdf";
	uploadedAt: Date;
	transactionCount: number;
	dateRange: {
		start: Date;
		end: Date;
	};
	processed: boolean;
}

export interface DashboardSummary {
	netWorth: number;
	monthlyIncome: number;
	monthlyExpenses: number;
	savingsRate: number;
	debtSummary: {
		totalDebt: number;
		averageInterestRate: number;
		minimumPayment: number;
	};
	budgetStatus: {
		totalBudget: number;
		spent: number;
		remaining: number;
		percentageUsed: number;
	};
	transactionCount: number;
	accountHealth: "excellent" | "good" | "fair" | "poor";
}

export interface CustomCategory {
	id: string;
	userId: string;
	name: string;
	color: string;
	icon?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Income {
	id: string;
	userId: string;
	description: string;
	amount: number; // in cents
	frequency: "once" | "weekly" | "biweekly" | "semi-monthly" | "monthly" | "yearly";
	source: string;
	startDate: Date;
	endDate?: Date;
	createdAt: Date;
	updatedAt: Date;
}
