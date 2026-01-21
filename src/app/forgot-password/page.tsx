"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccess(false);
		setLoading(true);

		try {
			await sendPasswordResetEmail(auth, email);
			setSuccess(true);
			setEmail("");
		} catch (error: any) {
			// Firebase error messages
			if (error.code === "auth/user-not-found") {
				setError("No account found with this email address");
			} else if (error.code === "auth/invalid-email") {
				setError("Please enter a valid email address");
			} else {
				setError(error.message || "Failed to send reset email");
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/* Header */}
				<div className="mb-8">
					<Link
						href="/login"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4">
						<ArrowLeft className="w-4 h-4" />
						Back to login
					</Link>
					<div className="flex items-center justify-center gap-2 mb-4">
						<Mail className="w-8 h-8 text-blue-500" />
						<h1 className="text-3xl font-bold text-white">Reset Password</h1>
					</div>
					<p className="text-gray-400">Enter your email address and we'll send you a link to reset your password</p>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">{error}</div>
				)}

				{/* Success Message */}
				{success && (
					<div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg">
						<div className="flex items-start gap-3">
							<CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
							<div>
								<h3 className="font-medium text-green-200 mb-1">Email sent!</h3>
								<p className="text-green-200 text-sm">
									Check your email for a link to reset your password. If you don't see it, check your spam folder.
								</p>
								<p className="text-green-200 text-sm mt-2">The reset link will expire in 24 hours.</p>
							</div>
						</div>
					</div>
				)}

				{/* Email Form */}
				<form onSubmit={handleResetPassword} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
							className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<button
						type="submit"
						disabled={loading || success}
						className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors">
						{loading ? "Sending..." : success ? "Email sent" : "Send reset link"}
					</button>
				</form>

				{/* Alternative Actions */}
				<div className="mt-6 space-y-2 text-center text-sm text-gray-400">
					<p>Remember your password?</p>
					<Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
						Sign in instead
					</Link>
				</div>

				{/* Information Box */}
				<div className="mt-8 p-4 bg-slate-800 border border-slate-600 rounded-lg">
					<h3 className="text-sm font-semibold text-blue-400 mb-2">What happens next?</h3>
					<ul className="text-gray-400 text-xs space-y-1">
						<li>✓ We'll send a password reset link to your email</li>
						<li>✓ Click the link to set a new password</li>
						<li>✓ The link expires in 24 hours for security</li>
						<li>✓ Your data remains completely secure</li>
					</ul>
				</div>

				{/* Footer */}
				<p className="text-center text-gray-500 text-xs mt-6">
					Having trouble? Contact support for assistance
				</p>
			</div>
		</div>
	);
}
