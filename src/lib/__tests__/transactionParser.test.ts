import { validateTransaction, getDateRange } from '@/lib/transactionParser';
import { Transaction } from '@/types';

describe('Transaction Parser', () => {
  // CSV parsing tests require mocking PapaParse library - covered in integration tests

  describe('validateTransaction', () => {
    it('should validate a complete transaction', () => {
      const transaction: Partial<Transaction> = {
        date: new Date(),
        description: 'Test Transaction',
        amount: 10000,
      };

      expect(validateTransaction(transaction)).toBe(true);
    });

    it('should reject transaction without date', () => {
      const transaction: Partial<Transaction> = {
        description: 'Test Transaction',
        amount: 10000,
      };

      expect(validateTransaction(transaction)).toBe(false);
    });

    it('should reject transaction without amount', () => {
      const transaction: Partial<Transaction> = {
        date: new Date(),
        description: 'Test Transaction',
      };

      expect(validateTransaction(transaction)).toBe(false);
    });

    it('should reject transaction without description', () => {
      const transaction: Partial<Transaction> = {
        date: new Date(),
        amount: 10000,
      };

      expect(validateTransaction(transaction)).toBe(false);
    });
  });

  describe('getDateRange', () => {
    it('should extract date range from transactions', () => {
      const transactions: Partial<Transaction>[] = [
        { date: new Date(2024, 0, 15), description: 'T1', amount: -100 },
        { date: new Date(2024, 0, 20), description: 'T2', amount: -200 },
        { date: new Date(2024, 0, 10), description: 'T3', amount: -300 },
      ];

      const range = getDateRange(transactions);

      expect(range.start).toEqual(new Date(2024, 0, 10));
      expect(range.end).toEqual(new Date(2024, 0, 20));
    });

    it('should handle single transaction', () => {
      const transactions: Partial<Transaction>[] = [
        { date: new Date(2024, 0, 15), description: 'T1', amount: -100 },
      ];

      const range = getDateRange(transactions);

      expect(range.start).toEqual(new Date(2024, 0, 15));
      expect(range.end).toEqual(new Date(2024, 0, 15));
    });

    it('should handle empty transaction array', () => {
      const transactions: Partial<Transaction>[] = [];

      const range = getDateRange(transactions);

      expect(range.start).toBeDefined();
      expect(range.end).toBeDefined();
    });
  });
});
