"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";

type AuthCardProps = {
  onError: (message: string) => void;
  variant?: "card" | "screen";
};

export function AuthCard({ onError, variant = "card" }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");

    if (!isFirebaseConfigured()) {
      onError("Firebase is not configured yet. Add your NEXT_PUBLIC_FIREBASE_* values in .env.local.");
      return;
    }

    if (!email.trim() || !password) {
      onError("Enter your email and password to sign in.");
      return;
    }

    setIsSigningIn(true);

    try {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      onError(getSignInError(error));
    } finally {
      setIsSigningIn(false);
    }
  }

  const sectionClassName =
    variant === "screen"
      ? "w-full rounded-[2rem] bg-white/84 px-5 py-6 shadow-[0_20px_48px_rgba(176,92,112,0.16)] ring-1 ring-rose-100/90"
      : "mt-6 rounded-[2rem] bg-white/84 px-5 py-6 shadow-[0_20px_48px_rgba(176,92,112,0.16)] ring-1 ring-rose-100/90";

  return (
    <section className={sectionClassName}>
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
        Private for us
      </p>
      <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
        Sign in to our memories
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        Use one of the two Firebase accounts allowed for this app.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-semibold text-rose-950">Email</span>
          <input
            autoComplete="email"
            className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-rose-950">Password</span>
          <input
            autoComplete="current-password"
            className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button
          className="w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSigningIn}
          type="submit"
        >
          {isSigningIn ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </section>
  );
}

function getSignInError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
    return "The email or password is not right.";
  }

  if (message.includes("auth/user-not-found")) {
    return "No Firebase user exists for that email yet.";
  }

  if (message.includes("auth/too-many-requests")) {
    return "Too many sign-in attempts. Wait a little and try again.";
  }

  if (message.includes("auth/operation-not-allowed")) {
    return "Enable Email/Password sign-in in Firebase Authentication first.";
  }

  return "Could not sign in. Check Firebase Auth and try again.";
}
