import { autoCategorizeTransaction, getCategorizationConfidence, addVendorOverride } from "@/lib/categorizer";

describe("Transaction Categorization", () => {
	describe("autoCategorizeTransaction", () => {
		it("should categorize grocery stores correctly", () => {
			const groceryDescriptions = ["WHOLE FOODS #123", "TRADER JOES MARKET", "KROGER SUPERMARKET", "HYVEE GROCERY"];

			groceryDescriptions.forEach((desc) => {
				const category = autoCategorizeTransaction(desc);
				expect(category).toBe("Groceries");
			});
		});

		it("should categorize gas stations correctly", () => {
			const gasDescriptions = ["SHELL GAS STATION", "CHEVRON FUEL", "EXXON MOBIL"];

			gasDescriptions.forEach((desc) => {
				const category = autoCategorizeTransaction(desc);
				expect(category).toBe("Gas/Fuel");
			});
		});

		it("should categorize restaurants correctly", () => {
			const restaurantDescriptions = [
				"MCDONALDS #456",
				"CHIPOTLE MEXICAN",
				"OLIVE GARDEN RESTAURANT",
				"STARBUCKS COFFEE",
			];

			restaurantDescriptions.forEach((desc) => {
				const category = autoCategorizeTransaction(desc);
				expect(category).toBe("Restaurants");
			});
		});

		it("should categorize subscriptions correctly", () => {
			const subscriptionDescriptions = ["NETFLIX MONTHLY", "SPOTIFY PREMIUM", "HULU SUBSCRIPTION", "ADOBE CREATIVE"];

			subscriptionDescriptions.forEach((desc) => {
				const category = autoCategorizeTransaction(desc);
				expect(category).toBe("Subscriptions");
			});
		});

		it("should categorize utilities correctly", () => {
			const utilityDescriptions = [
				"ELECTRIC POWER COMPANY",
				"WATER UTILITY BILL",
				"GAS SERVICE PAYMENT",
				"INTERNET SERVICE PROVIDER",
			];

			utilityDescriptions.forEach((desc) => {
				const category = autoCategorizeTransaction(desc);
				expect(category).toBe("Utilities");
			});
		});

		it("should handle merchant parameter for better categorization", () => {
			const category = autoCategorizeTransaction("TRANSACTION #123", "amazon.com");
			expect(category).toBe("Shopping");
		});

		it("should default to Other for unknown transactions", () => {
			const category = autoCategorizeTransaction("UNKNOWN XYZ 789");
			expect(category).toBe("Other");
		});

		it("should be case insensitive", () => {
			const cat1 = autoCategorizeTransaction("netflix subscription");
			const cat2 = autoCategorizeTransaction("NETFLIX SUBSCRIPTION");
			const cat3 = autoCategorizeTransaction("NetFlix Subscription");

			expect(cat1).toBe(cat2);
			expect(cat2).toBe(cat3);
			expect(cat1).toBe("Subscriptions");
		});
	});

	describe("getCategorizationConfidence", () => {
		it("should return high confidence for exact matches", () => {
			const confidence = getCategorizationConfidence("STARBUCKS COFFEE SHOP", "starbucks.com", "Restaurants");
			expect(confidence).toBeGreaterThan(50);
		});

		it("should return low confidence for generic descriptions", () => {
			const confidence = getCategorizationConfidence("TRANSACTION #123", undefined, "Other");
			expect(confidence).toBeLessThanOrEqual(50);
		});

		it("should return value between 0 and 100", () => {
			const confidence = getCategorizationConfidence("SOME PURCHASE", "merchant.com", "Shopping");
			expect(confidence).toBeGreaterThanOrEqual(0);
			expect(confidence).toBeLessThanOrEqual(100);
		});
	});

	describe("vendor overrides", () => {
		it("should apply custom vendor overrides", () => {
			addVendorOverride("testmerchant123", "Entertainment");

			const category = autoCategorizeTransaction("TESTMERCHANT123 PURCHASE");
			expect(category).toBe("Entertainment");
		});
	});
});
