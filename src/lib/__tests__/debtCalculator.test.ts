import {
	calculateSnowballPayoff,
	calculateAvalanchePayoff,
	comparePayoffStrategies,
	projectPayoffTime,
	formatPayoffSchedule,
} from "@/lib/debtCalculator";
import { Debt } from "@/types";

const mockDebts: Debt[] = [
	{
		id: "debt-1",
		userId: "user-123",
		name: "Credit Card A",
		balance: 300000, // $3,000
		interestRate: 19.99,
		minimumPayment: 5000, // $50
		monthlyPayment: 10000, // $100
		type: "credit-card",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "debt-2",
		userId: "user-123",
		name: "Credit Card B",
		balance: 500000, // $5,000
		interestRate: 21.5,
		minimumPayment: 7500, // $75
		monthlyPayment: 15000, // $150
		type: "credit-card",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "debt-3",
		userId: "user-123",
		name: "Personal Loan",
		balance: 1000000, // $10,000
		interestRate: 8.5,
		minimumPayment: 15000, // $150
		monthlyPayment: 30000, // $300
		type: "personal-loan",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
];

describe("Debt Payoff Calculator", () => {
	describe("calculateSnowballPayoff", () => {
		it("should generate a payoff schedule sorted by balance (smallest first)", () => {
			const plan = calculateSnowballPayoff(mockDebts);

			expect(plan.strategy).toBe("snowball");
			expect(plan.debts.length).toBe(3);

			// Check that debts are sorted by balance (smallest first)
			expect(plan.debts[0].balance).toBeLessThanOrEqual(plan.debts[1].balance);
			expect(plan.debts[1].balance).toBeLessThanOrEqual(plan.debts[2].balance);
		});

		it("should create a valid payment schedule", () => {
			const plan = calculateSnowballPayoff(mockDebts, 0, 1000);

			expect(plan.schedule.length).toBeGreaterThan(0);
			expect(plan.monthsToPayoff).toBe(plan.schedule.length);

			// Check that schedule progresses
			expect(plan.schedule[0].month).toBe(1);
			expect(plan.schedule[plan.schedule.length - 1].month).toBe(plan.schedule.length);
		});

		it("should calculate total interest paid", () => {
			const plan = calculateSnowballPayoff(mockDebts, 0, 2000);

			expect(plan.totalInterestPaid).toBeGreaterThan(0);
		});

		it("should reduce balance over time", () => {
			const plan = calculateSnowballPayoff(mockDebts, 0, 2000);

			expect(plan.schedule[0].remainingBalance).toBeLessThan(mockDebts.reduce((sum, d) => sum + d.balance, 0));
		});
	});

	describe("calculateAvalanchePayoff", () => {
		it("should generate a payoff schedule sorted by interest rate (highest first)", () => {
			const plan = calculateAvalanchePayoff(mockDebts);

			expect(plan.strategy).toBe("avalanche");
			expect(plan.debts.length).toBe(3);

			// Check that debts are sorted by interest rate (highest first)
			expect(plan.debts[0].interestRate).toBeGreaterThanOrEqual(plan.debts[1].interestRate);
			expect(plan.debts[1].interestRate).toBeGreaterThanOrEqual(plan.debts[2].interestRate);
		});

		it("should save money compared to snowball method", () => {
			const snowball = calculateSnowballPayoff(mockDebts, 0, 2000);
			const avalanche = calculateAvalanchePayoff(mockDebts, 0, 2000);

			// Avalanche should pay less interest (in most cases)
			// This is a general principle but not always true for every scenario
			expect(avalanche.totalInterestPaid).toBeLessThanOrEqual(snowball.totalInterestPaid);
		});
	});

	describe("comparePayoffStrategies", () => {
		it("should return both strategies with savings calculation", () => {
			const comparison = comparePayoffStrategies(mockDebts, 0, 2000);

			expect(comparison.snowball).toBeDefined();
			expect(comparison.avalanche).toBeDefined();
			expect(comparison.savings).toBeDefined();
			expect(typeof comparison.savings).toBe("number");
		});

		it("should show savings as positive when avalanche is better", () => {
			const comparison = comparePayoffStrategies(mockDebts, 0, 2000);

			// Avalanche saves money on interest compared to snowball
			expect(comparison.savings).toBeGreaterThanOrEqual(0);
		});
	});

	describe("projectPayoffTime", () => {
		it("should project payoff time for a single debt", () => {
			const projection = projectPayoffTime(mockDebts[0]);

			expect(projection.months).toBeGreaterThan(0);
			expect(projection.totalInterest).toBeGreaterThan(0);
		});

		it("should show faster payoff with extra payments", () => {
			const baseline = projectPayoffTime(mockDebts[0], 0);
			const withExtra = projectPayoffTime(mockDebts[0], 5000); // $50 extra

			expect(withExtra.months).toBeLessThan(baseline.months);
			expect(withExtra.totalInterest).toBeLessThan(baseline.totalInterest);
		});

		it("should respect maximum month limit to prevent infinite loops", () => {
			const veryHighBalance: Debt = {
				...mockDebts[0],
				balance: 100000000, // Very high balance
				minimumPayment: 1000, // Very low payment
			};

			const projection = projectPayoffTime(veryHighBalance);

			// Should not exceed 600 months (50 years)
			expect(projection.months).toBeLessThanOrEqual(600);
		});
	});

	describe("formatPayoffSchedule", () => {
		it("should format schedule into readable format", () => {
			const plan = calculateSnowballPayoff(mockDebts, 0, 2000);
			const formatted = formatPayoffSchedule(plan);

			expect(formatted.yearsToPayoff).toBeGreaterThanOrEqual(0);
			expect(formatted.monthsToPayoff).toBeGreaterThanOrEqual(0);
			expect(formatted.totalInterestPaid).toBeDefined();
			expect(formatted.monthlyPayment).toBeDefined();
		});

		it("should format currency correctly", () => {
			const plan = calculateSnowballPayoff(mockDebts, 0, 2000);
			const formatted = formatPayoffSchedule(plan);

			// Check that it's formatted as currency
			expect(formatted.totalInterestPaid).toMatch(/^\$/);
			expect(formatted.monthlyPayment).toMatch(/^\$/);
		});
	});

	describe("Edge Cases", () => {
		it("should handle single debt", () => {
			const singleDebt = [mockDebts[0]];
			const plan = calculateSnowballPayoff(singleDebt, 0, 2000);

			expect(plan.debts.length).toBe(1);
			expect(plan.schedule.length).toBeGreaterThan(0);
		});

		it("should handle zero interest debt", () => {
			const zeroInterest: Debt = {
				...mockDebts[0],
				interestRate: 0,
			};

			const plan = calculateSnowballPayoff([zeroInterest], 0, 2000);

			// With zero interest, total interest should be minimal
			expect(plan.totalInterestPaid).toBeLessThan(1000); // Less than $10
		});

		it("should handle high extra payment amounts", () => {
			const plan = calculateSnowballPayoff(mockDebts, 50000, 0); // $500/month extra

			expect(plan.monthsToPayoff).toBeLessThan(calculateSnowballPayoff(mockDebts, 0, 2000).monthsToPayoff);
		});
	});
});
