"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navigation = [
	{ href: "/dashboard", label: "Dashboard" },
	{ href: "/transactions", label: "Transactions" },
	{ href: "/categories", label: "Categories" },
	{ href: "/budgets", label: "Budgets" },
	{ href: "/debts", label: "Debts" },
	{ href: "/payoff-plan", label: "Payoff Plan" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { logout, user } = useAuth();
	const router = useRouter();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const handleLogout = async () => {
		await logout();
		router.push("/login");
	};

	return (
		<ProtectedRoute>
			<div className="min-h-screen bg-gray-50 dark:bg-slate-900">
				{/* Navigation */}
				<nav className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between items-center h-16">
							{/* Logo */}
							<Link href="/dashboard" className="flex items-center gap-2">
								<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
									<span className="text-white font-bold text-lg">FA</span>
								</div>
								<span className="text-xl font-bold text-gray-900 dark:text-white">FinanceAdvisor</span>
							</Link>

							{/* Desktop Navigation */}
							<div className="hidden md:flex gap-6">
								{navigation.map((item) => (
									<Link
										key={item.href}
										href={item.href}
										className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium">
										{item.label}
									</Link>
								))}
							</div>

							{/* User Menu */}
							<div className="flex items-center gap-4">
								<div className="hidden sm:flex items-center gap-3">
									<div className="text-right">
										<p className="text-sm font-medium text-gray-900 dark:text-white">{user?.displayName || "User"}</p>
										<p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
									</div>
								</div>

								<button
									onClick={handleLogout}
									className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
									<LogOut className="w-4 h-4" />
									<span className="hidden sm:inline">Logout</span>
								</button>

								{/* Mobile Menu Button */}
								<button
									onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
									className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
									{mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
								</button>
							</div>
						</div>

						{/* Mobile Navigation */}
						{mobileMenuOpen && (
							<div className="md:hidden border-t border-gray-200 dark:border-slate-700 py-4">
								<div className="flex flex-col gap-3">
									{navigation.map((item) => (
										<Link
											key={item.href}
											href={item.href}
											className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium px-3 py-2"
											onClick={() => setMobileMenuOpen(false)}>
											{item.label}
										</Link>
									))}
								</div>
							</div>
						)}
					</div>
				</nav>

				{/* Main Content */}
				<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
			</div>
		</ProtectedRoute>
	);
}
