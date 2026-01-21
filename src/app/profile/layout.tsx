"use client";

import { AppLayout } from "@/components/AppLayout";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
	return (
		<AppLayout>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
		</AppLayout>
	);
}
