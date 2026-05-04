"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SuggestionBoxHero } from "@/components/suggestions/SuggestionBoxHero";
import { SuggestionForm } from "@/components/suggestions/SuggestionForm";
import { SuggestionList } from "@/components/suggestions/SuggestionList";
import { coupleConfig } from "@/lib/coupleConfig";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  addSuggestion,
  deleteSuggestion,
  setSuggestionDone,
  subscribeToSuggestions,
  toggleSuggestionLike,
  type Suggestion,
  type SuggestionFilter,
  type SuggestionInput
} from "@/lib/suggestions";

const filters: Array<{ id: SuggestionFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "mine", label: "Mine" }
];

export function SuggestionBoxPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeFilter, setActiveFilter] = useState<SuggestionFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Opening the box...");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setSyncStatus("");
      setErrorMessage("Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable the suggestion box.");
      return;
    }

    let unsubscribeSuggestions: (() => void) | undefined;
    const { auth } = getFirebaseServices();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setSuggestions([]);
        setSyncStatus("");
        setErrorMessage("Sign in with one of the two allowed accounts to open the suggestion box.");
        unsubscribeSuggestions?.();
        return;
      }

      setErrorMessage("");
      setSyncStatus("Syncing notes...");
      unsubscribeSuggestions?.();
      unsubscribeSuggestions = subscribeToSuggestions(
        coupleConfig.coupleId,
        (nextSuggestions) => {
          setSuggestions(nextSuggestions.filter((suggestion) => !suggestion.archived));
          setSyncStatus("Suggestion box synced");
        },
        (error) => {
          setSyncStatus("");
          setErrorMessage(getFriendlyError(error));
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSuggestions?.();
    };
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    switch (activeFilter) {
      case "open":
        return suggestions.filter((suggestion) => !suggestion.done);
      case "done":
        return suggestions.filter((suggestion) => suggestion.done);
      case "mine":
        return suggestions.filter((suggestion) => suggestion.createdBy === currentUser.uid);
      default:
        return suggestions;
    }
  }, [activeFilter, currentUser, suggestions]);
  const openCount = suggestions.filter((suggestion) => !suggestion.done).length;
  const doneCount = suggestions.filter((suggestion) => suggestion.done).length;

  async function handleSaveSuggestion(input: SuggestionInput) {
    if (!currentUser) {
      setErrorMessage("Sign in before adding a note.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      await addSuggestion(coupleConfig.coupleId, currentUser.uid, input);
      setIsFormOpen(false);
      setActiveFilter("all");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleLike(suggestion: Suggestion) {
    if (!currentUser) {
      return;
    }

    setErrorMessage("");

    try {
      await toggleSuggestionLike(coupleConfig.coupleId, suggestion, currentUser.uid);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  async function handleToggleDone(suggestion: Suggestion) {
    setErrorMessage("");

    try {
      await setSuggestionDone(coupleConfig.coupleId, suggestion.id, !suggestion.done);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  async function handleDeleteSuggestion(suggestion: Suggestion) {
    if (!currentUser || suggestion.createdBy !== currentUser.uid) {
      setErrorMessage("You can only delete your own notes.");
      return;
    }

    setErrorMessage("");

    try {
      await deleteSuggestion(coupleConfig.coupleId, suggestion.id);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-5 rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
          >
            ← Back
          </button>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
            {coupleConfig.appName}
          </p>
          <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.98] text-rose-950">
            Suggestion Box
          </h1>
          {errorMessage ? (
            <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
              {errorMessage}
            </p>
          ) : null}
        </header>
        <AuthCard variant="screen" onError={setErrorMessage} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
        >
          ← Back
        </button>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
          {coupleConfig.appName}
        </p>
      </header>

      {errorMessage ? (
        <p className="mb-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
          {errorMessage}
        </p>
      ) : null}

      <SuggestionBoxHero
        openCount={openCount}
        doneCount={doneCount}
        onAdd={() => setIsFormOpen(true)}
      />

      <section className="mt-5">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`shrink-0 rounded-full px-4 py-3 text-sm font-semibold ring-1 ${
                activeFilter === filter.id
                  ? "bg-rose-950 text-rose-50 ring-rose-950"
                  : "bg-white/80 text-rose-700 ring-rose-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {syncStatus ? (
          <p className="mt-1 text-sm font-medium text-rose-500">{syncStatus}</p>
        ) : null}
      </section>

      <div className="mt-4">
        <SuggestionList
          currentUserId={currentUser.uid}
          suggestions={filteredSuggestions}
          onAdd={() => setIsFormOpen(true)}
          onDelete={handleDeleteSuggestion}
          onToggleDone={handleToggleDone}
          onToggleLike={handleToggleLike}
        />
      </div>

      {isFormOpen ? (
        <SuggestionForm
          isSaving={isSaving}
          onCancel={() => setIsFormOpen(false)}
          onSave={handleSaveSuggestion}
        />
      ) : null}
    </main>
  );
}

function getFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Firebase permissions blocked the suggestion box. Check Firestore rules for the two allowed users.";
  }

  if (message.includes("network")) {
    return "Network connection failed. Try again when both devices are online.";
  }

  return message || "Something went wrong while syncing the suggestion box.";
}
