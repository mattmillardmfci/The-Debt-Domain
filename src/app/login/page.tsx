"use client";

import { useState } from "react";
import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signInWithPopup,
	GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isSignUp, setIsSignUp] = useState(false);
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleEmailAuth = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			if (isSignUp) {
				await createUserWithEmailAndPassword(auth, email, password);
			} else {
				await signInWithEmailAndPassword(auth, email, password);
			}
			router.push("/dashboard");
		} catch (error: any) {
			setError(error.message || "Authentication failed");
		} finally {
			setLoading(false);
		}
	};

	const handleGoogleAuth = async () => {
		setError("");
		setLoading(true);

		try {
			const provider = new GoogleAuthProvider();
			await signInWithPopup(auth, provider);
			router.push("/dashboard");
		} catch (error: any) {
			setError(error.message || "Google authentication failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				{/* Header */}
				<div className="text-center mb-8">
					<div className="flex items-center justify-center gap-2 mb-4">
						<LogIn className="w-8 h-8 text-blue-500" />
						<h1 className="text-3xl font-bold text-white">TheDebtDomain</h1>
					</div>
					<p className="text-gray-400">{isSignUp ? "Create your account" : "Welcome back"}</p>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">{error}</div>
				)}

				{/* Email/Password Form */}
				<form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
							className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							required
							className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors">
						{loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
					</button>
				</form>

				{/* Forgot Password & Toggle Auth Mode */}
				<div className="flex items-center justify-between mb-6 text-sm text-gray-400">
					<div>
						{isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
						<button
							type="button"
							onClick={() => setIsSignUp(!isSignUp)}
							className="text-blue-400 hover:text-blue-300 font-medium">
							{isSignUp ? "Sign In" : "Sign Up"}
						</button>
					</div>
					{!isSignUp && (
						<Link href="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium">
							Forgot password?
						</Link>
					)}
				</div>

				{/* Divider */}
				<div className="flex items-center gap-4 mb-6">
					<div className="flex-1 h-px bg-slate-600"></div>
					<span className="text-gray-400 text-sm">Or continue with</span>
					<div className="flex-1 h-px bg-slate-600"></div>
				</div>

				{/* Google Sign In */}
				<button
					onClick={handleGoogleAuth}
					disabled={loading}
					className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
					<svg className="w-5 h-5" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="currentColor"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="currentColor"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="currentColor"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					{loading ? "Loading..." : "Google"}
				</button>

				{/* Security Disclaimer */}
				<div className="mt-8 p-4 bg-slate-800 border border-slate-600 rounded-lg">
					<h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
						<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
						</svg>
						Your Data Is Secure
					</h3>
					<ul className="text-gray-400 text-xs space-y-1">
						<li>🔐 End-to-end encrypted with industry-standard security</li>
						<li>🔒 Firebase authentication - your data is yours alone</li>
						<li>👤 Only you can access your financial information</li>
						<li>🚫 We never sell or share your personal data</li>
					</ul>
				</div>

				{/* Footer */}
				<p className="text-center text-gray-500 text-xs mt-6">
					By signing in, you agree to our Terms of Service and Privacy Policy
				</p>
			</div>
		</div>
	);
}
