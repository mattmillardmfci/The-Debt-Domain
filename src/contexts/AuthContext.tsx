"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { User } from "@/types";

interface AuthContextType {
	user: User | null;
	firebaseUser: FirebaseUser | null;
	loading: boolean;
	logout: () => Promise<void>;
	isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
			if (fbUser) {
				setFirebaseUser(fbUser);
				setUser({
					uid: fbUser.uid,
					email: fbUser.email || "",
					displayName: fbUser.displayName || undefined,
					photoURL: fbUser.photoURL || undefined,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			} else {
				setFirebaseUser(null);
				setUser(null);
			}
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	const logout = async () => {
		try {
			await signOut(auth);
			setUser(null);
			setFirebaseUser(null);
		} catch (error) {
			console.error("Error logging out:", error);
		}
	};

	return (
		<AuthContext.Provider value={{ user, firebaseUser, loading, logout, isAuthenticated: !!user }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
