"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, LayoutDashboard, CreditCard, DollarSign, Tag, PieChart, User } from "lucide-react";

export function Navbar() {
	const { user, logout } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	const handleLogout = async () => {
		await logout();
		router.push("/login");
	};

	const navItems = [
		{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
		{ href: "/transactions", label: "Transactions", icon: CreditCard },
		{ href: "/debts", label: "Debts", icon: DollarSign },
		{ href: "/budgets", label: "Budgets", icon: PieChart },
		{ href: "/categories", label: "Categories", icon: Tag },
		{ href: "/profile", label: "Profile", icon: User },
	];

	return (
		<nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">
					{/* Logo/Brand */}
					<div className="flex-shrink-0">
						<h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">TheDebtDomain</h1>
					</div>

					{/* Nav Items */}
					<div className="hidden md:flex md:space-x-1">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = pathname === item.href || pathname.startsWith(item.href);
							return (
								<button
									key={item.href}
									onClick={() => router.push(item.href)}
									className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
										isActive
											? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
											: "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
									}`}>
									<Icon className="w-4 h-4 mr-2" />
									{item.label}
								</button>
							);
						})}
					</div>

					{/* User Menu */}
					<div className="flex items-center space-x-4">
						<span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">{user?.email}</span>
						<button
							onClick={handleLogout}
							className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300">
							<LogOut className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Mobile Menu */}
				<div className="md:hidden flex flex-wrap gap-2 pb-3">
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = pathname === item.href || pathname.startsWith(item.href);
						return (
							<button
								key={item.href}
								onClick={() => router.push(item.href)}
								className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-all duration-300 ${
									isActive
										? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
										: "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
								}`}>
								<Icon className="w-3 h-3 mr-1" />
								{item.label}
							</button>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
