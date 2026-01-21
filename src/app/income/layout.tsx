import { AppLayout } from "@/components/AppLayout";

export const metadata = {
	title: "Monthly Income | Debt Domain",
	description: "View and manage your monthly income sources",
};

export default function IncomeLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppLayout>
			<div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">{children}</div>
		</AppLayout>
	);
}
