"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { MonthversaryForm } from "@/components/anniversary/MonthversaryForm";
import { coupleConfig } from "@/lib/coupleConfig";
import { formatMonthDayYear, parseLocalDate } from "@/lib/dateUtils";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteMonthversary,
  subscribeToMonthversaries,
  updateMonthversary,
  uploadMemoryPhotos,
  type MonthversaryMemoryInput,
  type MonthversaryMemory
} from "@/lib/monthversaryService";

export function MemoriesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [memories, setMemories] = useState<MonthversaryMemory[]>([]);
  const [syncStatus, setSyncStatus] = useState("Connecting memories...");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingMemory, setEditingMemory] = useState<MonthversaryMemory | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<MonthversaryMemory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setSyncStatus("");
      setErrorMessage("Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable real-time sync.");
      return;
    }

    let unsubscribeMonthversaries: (() => void) | undefined;
    const { auth } = getFirebaseServices();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setMemories([]);
        setSyncStatus("");
        setErrorMessage("Sign in with one of the two allowed accounts to see synced memories.");
        setSuccessMessage("");
        setEditingMemory(null);
        setMemoryToDelete(null);
        unsubscribeMonthversaries?.();
        return;
      }

      setErrorMessage("");
      setSyncStatus("Syncing all memories...");
      unsubscribeMonthversaries?.();
      unsubscribeMonthversaries = subscribeToMonthversaries(
        coupleConfig.coupleId,
        (nextMemories) => {
          setMemories([...nextMemories].sort(sortByMonthNumber));
          setSyncStatus("Full history synced");
        },
        (error) => {
          setSyncStatus("");
          setErrorMessage(getFriendlyError(error));
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMonthversaries?.();
    };
  }, []);

  async function handleSaveMemory(input: MonthversaryMemoryInput, files: File[]) {
    if (!currentUser || !editingMemory) {
      setErrorMessage("Sign in before editing a memory.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    setUploadStatus("");

    try {
      await updateMonthversary(coupleConfig.coupleId, editingMemory.id, input);

      if (files.length > 0) {
        await uploadMemoryPhotos(
          coupleConfig.coupleId,
          editingMemory.id,
          files,
          currentUser.uid,
          ({ fileName, percent }) => setUploadStatus(`Uploading ${fileName}: ${percent}%`)
        );
      }

      setEditingMemory(null);
      setUploadStatus("");
      setSuccessMessage("Memory updated.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!memoryToDelete) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteMonthversary(coupleConfig.coupleId, memoryToDelete.id);
      setMemoryToDelete(null);
      setSuccessMessage("Memory deleted.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsDeleting(false);
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
            All Memories
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
          All Memories
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          Every 19th we have saved, from the first little date onward.
        </p>
        {syncStatus ? (
          <p className="mt-3 text-sm font-medium text-rose-500">{syncStatus}</p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
            {successMessage}
          </p>
        ) : null}
      </header>

      {memories.length > 0 ? (
        <section className="space-y-4">
          {memories.map((memory) => (
            <FullMemoryCard
              key={memory.id}
              memory={memory}
              onDelete={setMemoryToDelete}
              onEdit={setEditingMemory}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-3xl bg-white/80 px-5 py-6 text-center text-sm font-medium leading-6 text-stone-600 shadow-[0_14px_32px_rgba(176,92,112,0.12)] ring-1 ring-rose-100">
          No memories yet — start your story.
        </section>
      )}

      {editingMemory ? (
        <MonthversaryForm
          initialMemory={editingMemory}
          isSaving={isSaving}
          uploadStatus={uploadStatus}
          onCancel={() => {
            if (!isSaving) {
              setEditingMemory(null);
              setUploadStatus("");
            }
          }}
          onSave={handleSaveMemory}
        />
      ) : null}

      {memoryToDelete ? (
        <DeleteMemoryDialog
          isDeleting={isDeleting}
          memory={memoryToDelete}
          onCancel={() => {
            if (!isDeleting) {
              setMemoryToDelete(null);
            }
          }}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </main>
  );
}

function FullMemoryCard({
  memory,
  onDelete,
  onEdit
}: {
  memory: MonthversaryMemory;
  onDelete: (memory: MonthversaryMemory) => void;
  onEdit: (memory: MonthversaryMemory) => void;
}) {
  const date = parseLocalDate(memory.date);
  const coverPhoto = memory.photos[0];
  const extraPhotoCount = Math.max(0, memory.photos.length - 1);

  return (
    <article className="overflow-hidden rounded-3xl bg-white/82 shadow-[0_14px_32px_rgba(176,92,112,0.12)] ring-1 ring-rose-100/90">
      {coverPhoto ? (
        <div className="relative h-48 w-full overflow-hidden bg-rose-50">
          <img
            alt={memory.title}
            className="h-full w-full object-cover"
            src={coverPhoto.url}
          />
          {extraPhotoCount > 0 ? (
            <span className="absolute right-3 top-3 rounded-full bg-rose-950/82 px-3 py-1 text-xs font-semibold text-rose-50">
              +{extraPhotoCount} photos
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center bg-rose-50 text-4xl text-rose-300">
          ♥
        </div>
      )}
      <div className="px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
          Month {memory.monthNumber}
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-snug text-rose-950">
          {memory.title}
        </h2>
        <p className="mt-1 text-sm font-medium text-stone-500">
          {formatMonthDayYear(date)}
        </p>
        {memory.description ? (
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {memory.description}
          </p>
        ) : null}
        <p className="mt-4 text-xs font-medium text-rose-400">
          {memory.photos.length} photo{memory.photos.length === 1 ? "" : "s"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-label={`Edit ${memory.title}`}
            onClick={() => onEdit(memory)}
            className="rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/15"
          >
            Edit
          </button>
          <button
            type="button"
            aria-label={`Delete ${memory.title}`}
            onClick={() => onDelete(memory)}
            className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function DeleteMemoryDialog({
  isDeleting,
  memory,
  onCancel,
  onConfirm
}: {
  isDeleting: boolean;
  memory: MonthversaryMemory;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="w-full max-w-md rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Delete memory
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Delete this memory?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          This will remove “{memory.title}” and its photos. This cannot be undone.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-red-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-700/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete Memory"}
          </button>
        </div>
      </section>
    </div>
  );
}

function sortByMonthNumber(first: MonthversaryMemory, second: MonthversaryMemory) {
  return first.monthNumber - second.monthNumber || first.date.localeCompare(second.date);
}

function getFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Firebase permissions blocked this page. Check Firestore rules for the two allowed users.";
  }

  if (message.includes("network")) {
    return "Network connection failed. Try again when both devices are online.";
  }

  return message || "Something went wrong while syncing memories.";
}
