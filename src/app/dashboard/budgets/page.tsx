'use client';

export default function BudgetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Budgets
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Create and manage your monthly budgets
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Budget Management Coming Soon
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          This feature is currently in development
        </p>
      </div>
    </div>
  );
}
