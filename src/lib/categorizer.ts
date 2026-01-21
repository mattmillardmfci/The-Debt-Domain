import { TransactionCategory } from "@/types";

/**
 * Vendor database for automatic categorization
 * Maps merchant names to categories
 */
const VENDOR_DATABASE: Record<string, TransactionCategory> = {
	// Groceries
	"whole foods": "Groceries",
	"trader joes": "Groceries",
	safeway: "Groceries",
	kroger: "Groceries",
	hyvee: "Groceries",
	walmart: "Groceries",
	"wal-mart": "Groceries",
	"wm supercenter": "Groceries",
	samsclub: "Groceries",
	"sam's club": "Groceries",
	target: "Groceries",
	costco: "Groceries",
	publix: "Groceries",
	instacart: "Groceries",
	walgreens: "Healthcare",

	// Gas/Fuel
	shell: "Gas/Fuel",
	chevron: "Gas/Fuel",
	exxon: "Gas/Fuel",
	mobil: "Gas/Fuel",
	speedway: "Gas/Fuel",
	texaco: "Gas/Fuel",
	bp: "Gas/Fuel",
	sunoco: "Gas/Fuel",
	"76": "Gas/Fuel",
	sinclair: "Gas/Fuel",
	citgo: "Gas/Fuel",
	"phillips 66": "Gas/Fuel",
	phillips: "Gas/Fuel",
	rocket: "Gas/Fuel",
	caseys: "Gas/Fuel",
	"casey's": "Gas/Fuel",
	"break time": "Gas/Fuel",

	// Restaurants
	mcdonalds: "Restaurants",
	subway: "Restaurants",
	"burger king": "Restaurants",
	"taco bell": "Restaurants",
	"chick-fil-a": "Restaurants",
	chipotle: "Restaurants",
	panera: "Restaurants",
	"olive garden": "Restaurants",
	applebees: "Restaurants",
	"buffalo wild wings": "Restaurants",
	"pizza hut": "Restaurants",
	dominos: "Restaurants",
	"papa john's": "Restaurants",
	starbucks: "Restaurants",
	dunkin: "Restaurants",

	// Utilities
	electric: "Utilities",
	water: "Utilities",
	gas: "Utilities",
	internet: "Utilities",
	cable: "Utilities",
	phone: "Utilities",

	// Insurance
	geico: "Insurance",
	"state farm": "Insurance",
	allstate: "Insurance",
	progressive: "Insurance",
	"liberty mutual": "Insurance",
	insurance: "Insurance",

	// Subscriptions
	netflix: "Subscriptions",
	spotify: "Subscriptions",
	hulu: "Subscriptions",
	disney: "Subscriptions",
	adobe: "Subscriptions",
	microsoft: "Subscriptions",
	apple: "Subscriptions",
	"amazon prime": "Subscriptions",
	gym: "Subscriptions",
	membership: "Subscriptions",

	// Entertainment
	movie: "Entertainment",
	cinema: "Entertainment",
	theatre: "Entertainment",
	concert: "Entertainment",
	game: "Entertainment",
	steam: "Entertainment",
	playstation: "Entertainment",
	xbox: "Entertainment",

	// Transportation
	uber: "Transportation",
	lyft: "Transportation",
	taxi: "Transportation",
	parking: "Transportation",
	metro: "Transportation",
	transit: "Transportation",
	airline: "Transportation",
	delta: "Transportation",
	united: "Transportation",
	american: "Transportation",

	// Debts (credit card, loan, line of credit payments)
	discover: "Debts",
	"e-payment": "Debts",
	"credit card": "Debts",
	"loan payment": "Debts",

	// Shopping
	amazon: "Shopping",
	ebay: "Shopping",
	mall: "Shopping",
	store: "Shopping",
	shop: "Shopping",
};

/**
 * Keywords for category detection
 */
const CATEGORY_KEYWORDS: Record<TransactionCategory, string[]> = {
	Groceries: ["grocery", "supermarket", "produce", "market", "food", "fruit", "vegetable"],
	"Gas/Fuel": ["gas station", "fuel", "petrol", "pump", "diesel"],
	Restaurants: ["restaurant", "cafe", "cafe", "diner", "food service", "fast food", "delivery"],
	Utilities: ["utility", "power", "electricity", "water", "gas service", "internet service", "cable service"],
	Insurance: ["insurance", "premium"],
	Shopping: ["retail", "merchandise", "clothing", "apparel", "shoes", "electronics"],
	Entertainment: ["movie", "entertainment", "game", "sports", "ticket", "recreation"],
	Transportation: ["transportation", "vehicle", "car", "transit", "parking", "taxi", "airline", "travel"],
	Healthcare: ["health", "medical", "healthcare", "prescription", "hospital", "clinic", "wellness"],
	Subscriptions: ["subscription", "monthly", "recurring", "membership", "premium"],
	Transfer: ["transfer", "deposit", "withdrawal"],
	Debts: ["e-payment", "credit card", "loan payment", "ach payment"],
	Salary: ["payroll", "salary", "income", "wage"],
	Investment: ["investment", "brokerage", "stock", "mutual fund"],
	Other: [],
};

/**
 * Auto-categorize a transaction based on merchant and description
 */
export function autoCategorizeTransaction(
	description: string,
	merchant?: string,
	amount?: number,
): TransactionCategory {
	const searchText = `${description} ${merchant || ""}`.toLowerCase();

	// Debts/Payments: Check for credit card payments and ACH transfers FIRST
	// These should be categorized as Debts, not Salary or Transfer
	if (amount && amount < 0) {
		if (
			searchText.includes("ach") ||
			searchText.includes("e-payment") ||
			searchText.includes("credit card") ||
			(searchText.includes("discover") && searchText.includes("payment")) ||
			searchText.includes("loan payment")
		) {
			return "Debts";
		}
	}

	// Salary: Only for POSITIVE amounts (income)
	// PayPal transfers and other transfers should NOT be Salary
	if (amount && amount > 0) {
		if (
			searchText.includes("payroll") ||
			searchText.includes("salary") ||
			(searchText.includes("income") && !searchText.includes("paypal"))
		) {
			return "Salary";
		}
	}

	// Check vendor database first (most reliable)
	if (merchant) {
		const merchantLower = merchant.toLowerCase();
		for (const [vendorName, category] of Object.entries(VENDOR_DATABASE)) {
			if (merchantLower.includes(vendorName) || vendorName.includes(merchantLower)) {
				return category;
			}
		}
	}

	// Check description against vendor database
	for (const [vendorName, category] of Object.entries(VENDOR_DATABASE)) {
		if (searchText.includes(vendorName)) {
			return category;
		}
	}

	// Check keywords for each category (except Salary which we handled above)
	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
		if (category === "Salary") continue; // Skip salary keywords to use amount-based logic above
		for (const keyword of keywords) {
			if (searchText.includes(keyword)) {
				return category as TransactionCategory;
			}
		}
	}

	// Default to Other
	return "Other";
}

/**
 * Get categorization confidence (0-100)
 * Based on how many matching signals we found
 */
export function getCategorizationConfidence(
	description: string,
	merchant: string | undefined,
	category: TransactionCategory,
): number {
	const searchText = `${description} ${merchant || ""}`.toLowerCase();
	let matchCount = 0;

	// Check merchant database
	if (merchant) {
		const merchantLower = merchant.toLowerCase();
		for (const [vendorName, vendorCategory] of Object.entries(VENDOR_DATABASE)) {
			if (vendorCategory === category) {
				if (merchantLower.includes(vendorName) || vendorName.includes(merchantLower)) {
					matchCount += 2;
				}
			}
		}
	}

	// Check keywords
	const categoryKeywords = CATEGORY_KEYWORDS[category] || [];
	for (const keyword of categoryKeywords) {
		if (searchText.includes(keyword)) {
			matchCount += 1;
		}
	}

	// Return confidence as percentage
	return Math.min(100, Math.round((matchCount / 3) * 100));
}

/**
 * Add/override vendor mapping
 */
export function addVendorOverride(vendor: string, category: TransactionCategory): void {
	VENDOR_DATABASE[vendor.toLowerCase()] = category;
}

/**
 * Get similar transactions for batch categorization
 */
export function findSimilarTransactions(
	description: string,
	merchant: string | undefined,
	transactions: Array<{ description: string; merchant?: string; category: TransactionCategory }>,
): Array<{ description: string; merchant?: string; category: TransactionCategory }> {
	const searchText = `${description} ${merchant || ""}`.toLowerCase();

	return transactions.filter((t) => {
		const compareText = `${t.description} ${t.merchant || ""}`.toLowerCase();
		const similarity = calculateStringSimilarity(searchText, compareText);
		return similarity > 0.6; // 60% similarity threshold
	});
}

/**
 * Simple string similarity calculation (Levenshtein distance)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
	const longer = str1.length > str2.length ? str1 : str2;
	const shorter = str1.length > str2.length ? str2 : str1;

	if (longer.length === 0) return 1.0;

	const editDistance = getEditDistance(longer, shorter);
	return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate edit distance between two strings
 */
function getEditDistance(str1: string, str2: string): number {
	const costs: number[] = [];

	for (let i = 0; i <= str1.length; i++) {
		let lastValue = i;
		for (let j = 0; j <= str2.length; j++) {
			if (i === 0) {
				costs[j] = j;
			} else if (j > 0) {
				let newValue = costs[j - 1];
				if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
					newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
				}
				costs[j - 1] = lastValue;
				lastValue = newValue;
			}
		}
		if (i > 0) costs[str2.length] = lastValue;
	}

	return costs[str2.length];
}
