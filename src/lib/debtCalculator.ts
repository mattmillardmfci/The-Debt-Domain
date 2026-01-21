import { Debt, DebtPayoffPlan, PayoffScheduleMonth, DebtPayment } from "@/types";

/**
 * Calculate debt payoff schedule using Snowball method
 * Pays off smallest balance first
 */
export function calculateSnowballPayoff(
	debts: Debt[],
	extraPayment: number = 0,
	monthlyPayment: number = 0,
): DebtPayoffPlan {
	// Sort debts by balance (smallest first)
	const sortedDebts = [...debts].sort((a, b) => a.balance - b.balance);

	const schedule = generatePayoffSchedule(sortedDebts, extraPayment, monthlyPayment);
	const totalInterestPaid = schedule.reduce((sum, month) => {
		return sum + month.payments.reduce((pSum, p) => pSum + p.interest, 0);
	}, 0);

	return {
		id: `payoff-${Date.now()}`,
		userId: debts[0]?.userId || "",
		debts: sortedDebts,
		strategy: "snowball",
		extraPayment,
		schedule,
		totalInterestPaid,
		monthsToPayoff: schedule.length,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

/**
 * Calculate debt payoff schedule using Avalanche method
 * Pays off highest interest rate first
 */
export function calculateAvalanchePayoff(
	debts: Debt[],
	extraPayment: number = 0,
	monthlyPayment: number = 0,
): DebtPayoffPlan {
	// Sort debts by interest rate (highest first)
	const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);

	const schedule = generatePayoffSchedule(sortedDebts, extraPayment, monthlyPayment);
	const totalInterestPaid = schedule.reduce((sum, month) => {
		return sum + month.payments.reduce((pSum, p) => pSum + p.interest, 0);
	}, 0);

	return {
		id: `payoff-${Date.now()}`,
		userId: debts[0]?.userId || "",
		debts: sortedDebts,
		strategy: "avalanche",
		extraPayment,
		schedule,
		totalInterestPaid,
		monthsToPayoff: schedule.length,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

/**
 * Generate month-by-month payoff schedule
 */
function generatePayoffSchedule(
	debts: Debt[],
	extraPayment: number = 0,
	baseMonthlyPayment: number = 0,
): PayoffScheduleMonth[] {
	// Create working copies of debts
	const workingDebts = debts.map((d) => ({
		...d,
		remainingBalance: d.balance,
	}));

	const schedule: PayoffScheduleMonth[] = [];
	let monthNumber = 0;
	const maxMonths = 600; // Safety limit (50 years)

	while (workingDebts.some((d) => d.remainingBalance > 0) && monthNumber < maxMonths) {
		monthNumber++;
		const monthDate = new Date();
		monthDate.setMonth(monthDate.getMonth() + monthNumber);

		const payments: DebtPayment[] = [];
		let totalMonthlyPayment = baseMonthlyPayment;

		// Calculate interest and minimum payments
		let totalMinimumPayment = 0;
		for (const debt of workingDebts) {
			if (debt.remainingBalance > 0) {
				// Calculate interest for this month
				const monthlyRate = debt.interestRate / 100 / 12;
				const interest = Math.round(debt.remainingBalance * monthlyRate);
				const minimumPayment = debt.minimumPayment || Math.max(25 * 100, debt.remainingBalance * 0.02);

				totalMinimumPayment += Math.max(minimumPayment, interest);
			}
		}

		// Determine total available payment
		totalMonthlyPayment = Math.max(totalMonthlyPayment, totalMinimumPayment) + extraPayment;

		// Allocate payments to debts
		let remainingPayment = totalMonthlyPayment;
		let remainingBalance = 0;

		for (let i = 0; i < workingDebts.length; i++) {
			const debt = workingDebts[i];

			if (remainingPayment <= 0 || debt.remainingBalance <= 0) {
				remainingBalance += debt.remainingBalance;
				continue;
			}

			// Calculate interest
			const monthlyRate = debt.interestRate / 100 / 12;
			const interest = Math.round(debt.remainingBalance * monthlyRate);

			// Minimum payment to avoid default
			const minPayment = Math.max(
				25 * 100, // $25 minimum
				debt.minimumPayment || debt.remainingBalance * 0.02,
			);

			// Calculate principal payment
			let principal = remainingPayment;

			// If this is not the last debt, pay minimum
			if (i < workingDebts.length - 1) {
				principal = Math.max(
					interest + minPayment - interest,
					Math.min(remainingPayment, interest + minPayment - interest),
				);
				principal = Math.min(principal, remainingPayment);
			}

			// Ensure we don't overpay
			const totalPayment = Math.min(principal + interest, remainingPayment);
			principal = Math.max(0, totalPayment - interest);

			// Apply payment
			debt.remainingBalance = Math.max(0, debt.remainingBalance - principal);
			remainingPayment -= totalPayment;
			remainingBalance += debt.remainingBalance;

			if (totalPayment > 0) {
				payments.push({
					debtId: debt.id,
					debtName: debt.name,
					principal,
					interest,
					total: totalPayment,
					newBalance: debt.remainingBalance,
				});
			}
		}

		// Only add month if payment was made
		if (payments.length > 0) {
			const totalInterest = payments.reduce((sum, p) => sum + p.interest, 0);
			schedule.push({
				month: monthNumber,
				date: monthDate,
				payments,
				remainingBalance,
				interestPaid: totalInterest,
			});
		}

		// Check if all debts are paid
		if (remainingBalance <= 0) {
			break;
		}
	}

	return schedule;
}

/**
 * Compare payoff strategies
 */
export function comparePayoffStrategies(
	debts: Debt[],
	extraPayment: number = 0,
	monthlyPayment: number = 0,
): { snowball: DebtPayoffPlan; avalanche: DebtPayoffPlan; savings: number } {
	const snowball = calculateSnowballPayoff(debts, extraPayment, monthlyPayment);
	const avalanche = calculateAvalanchePayoff(debts, extraPayment, monthlyPayment);

	const savings = snowball.totalInterestPaid - avalanche.totalInterestPaid;

	return {
		snowball,
		avalanche,
		savings,
	};
}

/**
 * Calculate payoff time with different extra payment amounts
 */
export function projectPayoffTime(debt: Debt, extraPayment: number = 0): { months: number; totalInterest: number } {
	let balance = debt.balance;
	let totalInterest = 0;
	let months = 0;
	const maxMonths = 600;

	const monthlyRate = debt.interestRate / 100 / 12;

	while (balance > 0 && months < maxMonths) {
		months++;

		// Calculate interest
		const interest = Math.round(balance * monthlyRate);
		totalInterest += interest;

		// Calculate payment
		const monthlyPayment = (debt.monthlyPayment || debt.minimumPayment) + extraPayment;
		const principalPayment = Math.max(0, monthlyPayment - interest);

		// Reduce balance
		balance -= principalPayment;
	}

	return {
		months,
		totalInterest,
	};
}

/**
 * Format payoff schedule for display
 */
export function formatPayoffSchedule(plan: DebtPayoffPlan): {
	yearsToPayoff: number;
	monthsToPayoff: number;
	totalInterestPaid: string;
	monthlyPayment: string;
} {
	const years = Math.floor(plan.monthsToPayoff / 12);
	const months = plan.monthsToPayoff % 12;

	let yearText = "";
	if (years > 0) {
		yearText = `${years} year${years !== 1 ? "s" : ""}`;
	}
	if (months > 0) {
		yearText += (yearText ? " " : "") + `${months} month${months !== 1 ? "s" : ""}`;
	}

	const avgMonthlyPayment =
		plan.schedule.reduce((sum, m) => {
			const total = m.payments.reduce((s, p) => s + p.total, 0);
			return sum + total;
		}, 0) / plan.schedule.length;

	return {
		yearsToPayoff: years,
		monthsToPayoff: months,
		totalInterestPaid: `$${(plan.totalInterestPaid / 100).toFixed(2)}`,
		monthlyPayment: `$${(avgMonthlyPayment / 100).toFixed(2)}`,
	};
}
