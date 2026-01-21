"use client";

import { AppLayout } from "@/components/AppLayout";

export default function PayoffPlanLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppLayout>
			<div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">{children}</div>
		</AppLayout>
	);
}
