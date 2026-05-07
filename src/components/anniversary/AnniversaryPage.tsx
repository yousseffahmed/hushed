"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { coupleConfig } from "@/lib/coupleConfig";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  getDaysUntil,
  getNextMonthlyAnniversary,
  getTotalDaysTogether,
  getTotalMonthsTogether,
  isSameLocalDay,
  parseLocalDate
} from "@/lib/dateUtils";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  addMonthversary,
  deleteMemoryPhoto,
  deleteMonthversary,
  seedDefaultMonthversaries,
  subscribeToMonthversaries,
  updateMonthversary,
  uploadMemoryPhotos,
  type MonthversaryMemory,
  type MonthversaryMemoryInput
} from "@/lib/monthversaryService";
import { MonthversaryCard } from "./MonthversaryCard";
import { MonthversaryDetail } from "./MonthversaryDetail";
import { MonthversaryForm } from "./MonthversaryForm";
import { NextAnniversaryCard } from "./NextAnniversaryCard";
import { TimeTogetherCard } from "./TimeTogetherCard";
import { NudgeCard } from "@/components/nudges/NudgeCard";

const MEMORY_CARD_COUNT = 4;

export function AnniversaryPage() {
  const router = useRouter();
  const [memories, setMemories] = useState<MonthversaryMemory[]>([]);
  const [displayedMemories, setDisplayedMemories] = useState<MonthversaryMemory[]>([]);
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [detailMemory, setDetailMemory] = useState<MonthversaryMemory | null>(null);
  const [editingMemory, setEditingMemory] = useState<MonthversaryMemory | null>(null);
  const [featuredMemoryId, setFeaturedMemoryId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("Connecting memories...");
  const [errorMessage, setErrorMessage] = useState("");
  const today = new Date();
  const startDate = parseLocalDate(coupleConfig.startDate);
  const totalDays = getTotalDaysTogether(coupleConfig.startDate, today);
  const totalMonths = getTotalMonthsTogether(coupleConfig.startDate, today);
  const nextAnniversary = getNextMonthlyAnniversary(today, coupleConfig.anniversaryDay);
  const daysUntilNextAnniversary = getDaysUntil(nextAnniversary, today);
  const isAnniversaryToday = isSameLocalDay(nextAnniversary, today);
  const canUseMemories = Boolean(currentUser);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setSyncStatus("");
      setErrorMessage("Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable real-time sync and uploads.");
      return;
    }

    let unsubscribeMonthversaries: (() => void) | undefined;
    const { auth } = getFirebaseServices();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setMemories([]);
        setDisplayedMemories([]);
        setSyncStatus("");
        setErrorMessage("Sign in with one of the two allowed accounts to see synced memories.");
        unsubscribeMonthversaries?.();
        return;
      }

      setErrorMessage("");
      setSyncStatus("Syncing memories...");
      unsubscribeMonthversaries?.();
      unsubscribeMonthversaries = subscribeToMonthversaries(
        coupleConfig.coupleId,
        (nextMemories) => {
          setMemories(nextMemories);
          setSyncStatus("Memories synced");

          if (nextMemories.length === 0) {
            seedDefaultMonthversaries(coupleConfig.coupleId, user.uid).catch((error) => {
              setErrorMessage(getFriendlyError(error));
            });
          }
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

  useEffect(() => {
    setDisplayedMemories((currentDisplayed) => {
      if (memories.length <= MEMORY_CARD_COUNT) {
        return memories;
      }

      if (featuredMemoryId) {
        return pickRandomMemories(memories, MEMORY_CARD_COUNT, featuredMemoryId);
      }

      const nextDisplayed = currentDisplayed
        .map((displayedMemory) =>
          memories.find((memory) => memory.id === displayedMemory.id)
        )
        .filter((memory): memory is MonthversaryMemory => Boolean(memory));

      if (nextDisplayed.length === MEMORY_CARD_COUNT) {
        return nextDisplayed;
      }

      return pickRandomMemories(memories, MEMORY_CARD_COUNT);
    });
  }, [featuredMemoryId, memories]);

  useEffect(() => {
    if (!detailMemory) {
      return;
    }

    const updatedMemory = memories.find((memory) => memory.id === detailMemory.id);

    if (updatedMemory) {
      setDetailMemory(updatedMemory);
    }
  }, [detailMemory, memories]);

  async function handleSaveMemory(input: MonthversaryMemoryInput, files: File[]) {
    if (!currentUser) {
      setErrorMessage("Sign in before saving a memory.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setUploadStatus(files.length > 0 ? "Preparing photo upload..." : "");

    try {
      const memoryId = editingMemory
        ? editingMemory.id
        : await addMonthversary(coupleConfig.coupleId, {
            ...input,
            createdBy: currentUser.uid
          });

      if (editingMemory) {
        await updateMonthversary(coupleConfig.coupleId, editingMemory.id, input);
      }

      if (files.length > 0) {
        await uploadMemoryPhotos(
          coupleConfig.coupleId,
          memoryId,
          files,
          currentUser.uid,
          (progress) => {
            setUploadStatus(`Uploading ${progress.fileName}: ${progress.percent}%`);
          }
        );
      }

      setFeaturedMemoryId(memoryId);
      setIsAddingMemory(false);
      setEditingMemory(null);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsSaving(false);
      setUploadStatus("");
    }
  }

  function openAddMemory() {
    setEditingMemory(null);
    setIsAddingMemory(true);
  }

  function openEditMemory(memory: MonthversaryMemory) {
    setDetailMemory(null);
    setEditingMemory(memory);
    setIsAddingMemory(true);
  }

  function openDetailMemory(memory: MonthversaryMemory) {
    setDetailMemory(memory);
  }

  function shuffleDisplayedMemories() {
    setFeaturedMemoryId(null);
    setDisplayedMemories(pickRandomMemories(memories, MEMORY_CARD_COUNT));
  }

  function closeMemoryForm() {
    setIsAddingMemory(false);
    setEditingMemory(null);
  }

  async function handleDeletePhoto(photoId: string) {
    if (!detailMemory) {
      return;
    }

    setIsDeletingPhoto(true);
    setErrorMessage("");

    try {
      await deleteMemoryPhoto(coupleConfig.coupleId, detailMemory.id, photoId);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsDeletingPhoto(false);
    }
  }

  async function handleDeleteMemory(memory: MonthversaryMemory) {
    setErrorMessage("");

    try {
      await deleteMonthversary(coupleConfig.coupleId, memory.id);
      setDetailMemory(null);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  if (!canUseMemories) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <header className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
            {coupleConfig.appName}
          </p>
          <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.98] text-rose-950">
            Our Time Together
          </h1>
          <p className="mt-4 text-base leading-7 text-stone-600">
            Sign in first to open our private memories.
          </p>
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
            {coupleConfig.appName}
          </p>
          {currentUser ? (
            <button
              type="button"
              onClick={() => signOut(getFirebaseServices().auth)}
              className="rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-100"
            >
              Sign out
            </button>
          ) : null}
        </div>
        <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.98] text-rose-950">
          Our Time Together
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          A quiet little count of the days, months, and 19th memories we keep adding to us.
        </p>
        {syncStatus ? (
          <p className="mt-3 text-sm font-medium text-rose-500">{syncStatus}</p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
            {errorMessage}
          </p>
        ) : null}
      </header>

      <div className="space-y-4">
        <TimeTogetherCard
          startDate={startDate}
          totalDays={totalDays}
          totalMonths={totalMonths}
        />
        <NextAnniversaryCard
          nextAnniversary={nextAnniversary}
          daysUntil={daysUntilNextAnniversary}
          isToday={isAnniversaryToday}
        />
      </div>

      {currentUser ? (
        <NudgeCard currentUser={currentUser} onError={setErrorMessage} />
      ) : null}

      <section className="mt-7 overflow-hidden rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] bg-rose-100 text-2xl text-rose-500">
            ♥
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
              Suggestion Box
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-3xl leading-tight text-rose-950">
              Drop a note for us
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Tiny ideas, dates, surprises, and future plans in one little box.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/suggestions")}
          className="mt-5 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20"
        >
          Open Suggestion Box
        </button>
      </section>

      <section className="mt-5 overflow-hidden rounded-[2rem] bg-rose-950 px-5 py-5 text-rose-50 shadow-[0_18px_42px_rgba(67,42,45,0.2)]">
        <div className="-mx-5 -mt-5 mb-4 grid grid-cols-8 gap-1 bg-rose-900/70 px-5 py-3">
          {Array.from({ length: 16 }).map((_, index) => (
            <span key={index} className="h-3 rounded-sm bg-rose-100/22" />
          ))}
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-200">
          Yushef Theater
        </p>
        <h2 className="mt-1 font-[var(--font-display)] text-3xl leading-tight">
          Start movie night together
        </h2>
        <p className="mt-2 text-sm leading-6 text-rose-100">
          Shared watchlist, tiny reviews, and a synced countdown for pressing play.
        </p>
        <button
          type="button"
          onClick={() => router.push("/theater")}
          className="mt-5 w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-950/20"
        >
          Open Yushef Theater
        </button>
      </section>

      <section className="mt-5 overflow-hidden rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] bg-rose-100 text-2xl font-black text-rose-500">
            #
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
              Game Center
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-3xl leading-tight text-rose-950">
              Tiny games, big competition
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Start a soft little battle with Number Guess Duel.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/game-center")}
          className="mt-5 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20"
        >
          Open Game Center
        </button>
      </section>

      <section className="mt-7">
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
          <h2 className="font-[var(--font-display)] text-3xl text-rose-950">
            Our 19th Memories
          </h2>
          <button
            type="button"
            onClick={openAddMemory}
            disabled={!canUseMemories}
            className="shrink-0 rounded-full bg-rose-950 px-4 py-2 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/15"
          >
            Add memory
          </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={shuffleDisplayedMemories}
              disabled={memories.length === 0}
              className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              🔀 Shuffle
            </button>
            <button
              type="button"
              onClick={() => router.push("/memories")}
              className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-100"
            >
              View All
            </button>
          </div>
        </div>
        {displayedMemories.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {displayedMemories.map((memory) => (
              <MonthversaryCard
                key={memory.id}
                memory={memory}
                onEdit={openEditMemory}
                onOpen={openDetailMemory}
                today={today}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white/80 px-5 py-6 text-center text-sm font-medium leading-6 text-stone-600 shadow-[0_14px_32px_rgba(176,92,112,0.12)] ring-1 ring-rose-100">
            No 19th memories yet — add the first one.
          </div>
        )}
      </section>

      <footer className="mt-auto pt-8 text-center text-sm font-medium leading-6 text-rose-500">
        Every day counts, but some days count a little more.
      </footer>

      {isAddingMemory ? (
        <MonthversaryForm
          initialMemory={editingMemory}
          isSaving={isSaving}
          uploadStatus={uploadStatus}
          onCancel={closeMemoryForm}
          onSave={handleSaveMemory}
        />
      ) : null}

      {detailMemory ? (
        <MonthversaryDetail
          memory={detailMemory}
          isDeletingPhoto={isDeletingPhoto}
          onAddPhotos={openEditMemory}
          onClose={() => setDetailMemory(null)}
          onDeleteMemory={handleDeleteMemory}
          onDeletePhoto={(photo) => handleDeletePhoto(photo.id)}
          onEdit={openEditMemory}
        />
      ) : null}
    </main>
  );
}

export function pickRandomMemories(
  memories: MonthversaryMemory[],
  count: number,
  featuredMemoryId?: string | null
): MonthversaryMemory[] {
  if (memories.length <= count) {
    return memories;
  }

  const featuredMemory = featuredMemoryId
    ? memories.find((memory) => memory.id === featuredMemoryId)
    : null;
  const pool = featuredMemory
    ? memories.filter((memory) => memory.id !== featuredMemory.id)
    : memories;
  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, featuredMemory ? count - 1 : count);

  return featuredMemory ? [featuredMemory, ...selected] : selected;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function getFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Firebase permissions blocked this change. Check Firestore and Storage rules for the two allowed users.";
  }

  if (message.includes("Firebase is not configured")) {
    return message;
  }

  if (message.includes("network")) {
    return "Network connection failed. Try again when both devices are online.";
  }

  return message || "Something went wrong while syncing this memory.";
}
