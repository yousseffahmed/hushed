"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { coupleConfig } from "@/lib/coupleConfig";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  addTheaterComment,
  addTheaterItem,
  deleteTheaterComment,
  deleteTheaterItem,
  getActivePresence,
  getMissingTheaterNames,
  leaveTheater,
  markTheaterPresent,
  resetTheaterCountdown,
  setTheaterRating,
  setTheaterReady,
  startTheaterCountdown,
  subscribeToTheaterComments,
  subscribeToTheaterItems,
  subscribeToTheaterSession,
  theaterItemTypes,
  theaterStatuses,
  updateTheaterItemStatus,
  type TheaterComment,
  type TheaterFilter,
  type TheaterItem,
  type TheaterItemInput,
  type TheaterItemType,
  type TheaterReadiness,
  type TheaterSession,
  type TheaterStatus
} from "@/lib/theater";

const PRESENCE_THRESHOLD_MS = 30000;
const PRESENCE_PING_MS = 10000;
const filters: Array<{ id: TheaterFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "want_to_watch", label: "Want" },
  { id: "watching", label: "Watching" },
  { id: "watched", label: "Watched" }
];

const emptySession: TheaterSession = {
  active: false,
  presentUsers: {},
  readyUsers: {},
  selectedItemId: "",
  countdownState: "idle",
  countdownStartedAt: "",
  countdownStartedAtMs: null,
  countdownStartedByUid: "",
  countdownStartedByName: "",
  countdownDurationSeconds: 3,
  playAt: "",
  updatedAt: ""
};

export function YushefTheaterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems] = useState<TheaterItem[]>([]);
  const [session, setSession] = useState<TheaterSession>(emptySession);
  const [activeFilter, setActiveFilter] = useState<TheaterFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Opening the theater...");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [commentsItem, setCommentsItem] = useState<TheaterItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TheaterItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingReady, setIsSavingReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setSyncStatus("");
      setErrorMessage("Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable Yushef Theater.");
      return;
    }

    let unsubscribeItems: (() => void) | undefined;
    let unsubscribeSession: (() => void) | undefined;
    const { auth } = getFirebaseServices();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setItems([]);
        setSession(emptySession);
        setSyncStatus("");
        setErrorMessage("Sign in with one of the two allowed accounts to open Yushef Theater.");
        unsubscribeItems?.();
        unsubscribeSession?.();
        return;
      }

      setErrorMessage("");
      setSyncStatus("Syncing theater...");
      unsubscribeItems?.();
      unsubscribeSession?.();
      unsubscribeItems = subscribeToTheaterItems(
        coupleConfig.coupleId,
        (nextItems) => {
          setItems(nextItems);
          setSyncStatus("Theater synced");
        },
        (error) => {
          setSyncStatus("");
          setErrorMessage(getFriendlyError(error));
        }
      );
      unsubscribeSession = subscribeToTheaterSession(
        coupleConfig.coupleId,
        setSession,
        (error) => {
          setErrorMessage(getFriendlyError(error));
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeItems?.();
      unsubscribeSession?.();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let mounted = true;

    markTheaterPresent(coupleConfig.coupleId, currentUser.uid).catch((error) => {
      if (mounted) {
        setErrorMessage(getFriendlyError(error));
      }
    });

    const interval = window.setInterval(() => {
      markTheaterPresent(coupleConfig.coupleId, currentUser.uid).catch(() => {
        setErrorMessage("Presence could not update. The countdown may wait until both devices reconnect.");
      });
    }, PRESENCE_PING_MS);

    const handlePageHide = () => {
      leaveTheater(coupleConfig.coupleId, currentUser.uid).catch(() => undefined);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
      leaveTheater(coupleConfig.coupleId, currentUser.uid).catch(() => undefined);
    };
  }, [currentUser]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  const activePresence = useMemo(
    () => getActivePresence(session, PRESENCE_THRESHOLD_MS, now),
    [now, session]
  );
  const missingNames = useMemo(() => getMissingTheaterNames(activePresence), [activePresence]);
  const bothPresent = missingNames.length === 0;
  const filteredItems = useMemo(
    () =>
      activeFilter === "all"
        ? items
        : items.filter((item) => item.status === activeFilter),
    [activeFilter, items]
  );
  const countdown = getCountdownDisplay(session, now);

  async function handleAddItem(input: TheaterItemInput) {
    if (!currentUser) {
      setErrorMessage("Sign in before adding to the theater.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await addTheaterItem(coupleConfig.coupleId, currentUser.uid, input);
      setIsFormOpen(false);
      setActiveFilter("all");
      setSuccessMessage("Added to Yushef Theater.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRate(item: TheaterItem, stars: number) {
    if (!currentUser) {
      return;
    }

    setErrorMessage("");

    try {
      await setTheaterRating(coupleConfig.coupleId, item.id, currentUser.uid, stars);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  async function handleStatusChange(item: TheaterItem, status: TheaterStatus) {
    setErrorMessage("");

    try {
      await updateTheaterItemStatus(coupleConfig.coupleId, item.id, status);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  async function handleStartCountdown() {
    if (!currentUser || !bothPresent || session.countdownState === "counting") {
      return;
    }

    setErrorMessage("");

    try {
      await startTheaterCountdown(coupleConfig.coupleId, currentUser.uid, 3);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  async function handleToggleReady() {
    if (!currentUser) {
      return;
    }

    const nextReady = !session.readyUsers[currentUser.uid]?.ready;
    setIsSavingReady(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setTheaterReady(coupleConfig.coupleId, currentUser.uid, nextReady);
      setSuccessMessage(
        nextReady
          ? "You’re ready 🍿 Your movie date will get a little nudge."
          : "You’re no longer marked ready."
      );
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsSavingReady(false);
    }
  }

  async function handleResetCountdown() {
    setErrorMessage("");

    try {
      await resetTheaterCountdown(coupleConfig.coupleId);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    }
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteTheaterItem(coupleConfig.coupleId, itemToDelete.id);
      setItemToDelete(null);
      setSuccessMessage("Removed from Yushef Theater.");
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
            Yushef Theater
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
      {successMessage ? (
        <p className="mb-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
          {successMessage}
        </p>
      ) : null}

      <TheaterHero onAdd={() => setIsFormOpen(true)} />

      <section className="mt-5 grid gap-4">
        <PresenceCard
          activePresence={activePresence}
          currentUserId={currentUser.uid}
          isSavingReady={isSavingReady}
          missingNames={missingNames}
          readyUsers={session.readyUsers}
          onToggleReady={handleToggleReady}
        />
        <CountdownCard
          bothPresent={bothPresent}
          countdown={countdown}
          missingNames={missingNames}
          session={session}
          onReset={handleResetCountdown}
          onStart={handleStartCountdown}
        />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-[var(--font-display)] text-3xl text-rose-950">
            Watchlist
          </h2>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="rounded-full bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/15"
          >
            Add title
          </button>
        </div>
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

      <section className="mt-4 space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <TheaterItemCard
              key={item.id}
              currentUserId={currentUser.uid}
              item={item}
              onComment={setCommentsItem}
              onDelete={setItemToDelete}
              onRate={handleRate}
              onStatusChange={handleStatusChange}
            />
          ))
        ) : (
          <div className="rounded-[2rem] bg-white/82 px-5 py-7 text-center shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-rose-100 text-3xl text-rose-500">
              🎟
            </div>
            <h2 className="mt-4 font-[var(--font-display)] text-3xl text-rose-950">
              The seats are waiting
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Add the first movie, series, or little episode for the next night in.
            </p>
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="mt-5 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20"
            >
              Add our first title
            </button>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <AddTheaterItemForm
          isSaving={isSaving}
          onCancel={() => setIsFormOpen(false)}
          onSave={handleAddItem}
        />
      ) : null}

      {commentsItem ? (
        <TheaterCommentsSheet
          currentUserId={currentUser.uid}
          item={commentsItem}
          onClose={() => setCommentsItem(null)}
          onError={setErrorMessage}
        />
      ) : null}

      {itemToDelete ? (
        <DeleteTheaterItemDialog
          isDeleting={isDeleting}
          item={itemToDelete}
          onCancel={() => {
            if (!isDeleting) {
              setItemToDelete(null);
            }
          }}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </main>
  );
}

function TheaterHero({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-rose-950 px-5 py-6 text-rose-50 shadow-[0_22px_52px_rgba(67,42,45,0.24)]">
      <div className="-mx-5 -mt-6 mb-5 grid grid-cols-8 gap-1 bg-rose-900/70 px-5 py-3">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} className="h-3 rounded-sm bg-rose-100/22" />
        ))}
      </div>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-200">
        Now showing
      </p>
      <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.95]">
        Yushef Theater
      </h1>
      <p className="mt-4 text-sm leading-6 text-rose-100">
        Our little cinema for long-distance movie nights.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-950/25"
      >
        Add to the watchlist
      </button>
    </section>
  );
}

function PresenceCard({
  activePresence,
  currentUserId,
  isSavingReady,
  missingNames,
  readyUsers,
  onToggleReady
}: {
  activePresence: Record<string, { name: string }>;
  currentUserId: string;
  isSavingReady: boolean;
  missingNames: string[];
  readyUsers: Record<string, TheaterReadiness>;
  onToggleReady: () => void;
}) {
  const currentUserReady = Boolean(readyUsers[currentUserId]?.ready);

  return (
    <section className="rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
        Theater seats
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {coupleUsers.allowedUserIds.map((uid) => {
          const present = Boolean(activePresence[uid]);
          const ready = Boolean(readyUsers[uid]?.ready);
          const name = getUserDisplayName(uid);

          return (
            <div
              key={uid}
              className={`rounded-2xl px-4 py-4 ring-1 ${
                present
                  ? "bg-rose-950 text-rose-50 ring-rose-950"
                  : "bg-rose-50/70 text-rose-700 ring-rose-100"
              }`}
            >
              <p className="text-sm font-semibold">{name}</p>
              <p className="mt-1 text-xs font-medium opacity-80">
                {present ? "is here" : "not here yet"}
              </p>
              <p className="mt-2 text-xs font-semibold opacity-90">
                {ready ? "ready with popcorn 🍿" : "not ready yet"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-stone-600">
        {missingNames.length === 0
          ? "Both seats are warm. You can start together."
          : `Waiting for ${missingNames.join(" and ")} to join.`}
      </p>
      <button
        type="button"
        onClick={onToggleReady}
        disabled={isSavingReady}
        className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg disabled:cursor-not-allowed disabled:opacity-60 ${
          currentUserReady
            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
            : "bg-rose-950 text-rose-50 shadow-rose-950/20"
        }`}
      >
        {isSavingReady
          ? "Saving..."
          : currentUserReady
            ? "I’m not ready yet"
            : "I’m Ready 🍿"}
      </button>
    </section>
  );
}

function CountdownCard({
  bothPresent,
  countdown,
  missingNames,
  session,
  onReset,
  onStart
}: {
  bothPresent: boolean;
  countdown: string;
  missingNames: string[];
  session: TheaterSession;
  onReset: () => void;
  onStart: () => void;
}) {
  const isCounting = session.countdownState === "counting";

  return (
    <section className="rounded-[2rem] bg-white/82 px-5 py-5 text-center shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
        Press play together
      </p>
      <div className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-rose-100 text-4xl font-black text-rose-950 shadow-inner">
        {countdown}
      </div>
      {session.countdownStartedByName ? (
        <p className="mt-3 text-sm font-medium text-rose-500">
          {session.countdownStartedByName} started the countdown
        </p>
      ) : null}
      <button
        type="button"
        onClick={onStart}
        disabled={!bothPresent || isCounting}
        className="mt-5 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCounting ? "Counting..." : "Start Countdown"}
      </button>
      {!bothPresent ? (
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Waiting for {missingNames.join(" and ")} before the countdown can start.
        </p>
      ) : null}
      {session.countdownState !== "idle" ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
        >
          Reset
        </button>
      ) : null}
    </section>
  );
}

function AddTheaterItemForm({
  isSaving,
  onCancel,
  onSave
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: TheaterItemInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TheaterItemType>("movie");
  const [platform, setPlatform] = useState("");
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const titleError = submitted && !title.trim() ? "Title is required." : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!title.trim()) {
      return;
    }

    onSave({ title, type, platform, genre, notes });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100"
      >
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Ticket booth
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Add something to watch
        </h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Title</span>
            <input
              className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="Ghibli movie night"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {titleError ? <span className="mt-1 block text-xs font-medium text-rose-700">{titleError}</span> : null}
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Type</span>
            <select
              className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              value={type}
              onChange={(event) => setType(event.target.value as TheaterItemType)}
            >
              {theaterItemTypes.map((itemType) => (
                <option key={itemType} value={itemType}>
                  {formatType(itemType)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-rose-950">Platform</span>
              <input
                className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
                placeholder="Netflix"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-rose-950">Genre</span>
              <input
                className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
                placeholder="Cozy"
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Little note</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="Why this belongs in our theater..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TheaterItemCard({
  currentUserId,
  item,
  onComment,
  onDelete,
  onRate,
  onStatusChange
}: {
  currentUserId: string;
  item: TheaterItem;
  onComment: (item: TheaterItem) => void;
  onDelete: (item: TheaterItem) => void;
  onRate: (item: TheaterItem, stars: number) => void;
  onStatusChange: (item: TheaterItem, status: TheaterStatus) => void;
}) {
  const averageRating = getAverageRating(item);

  return (
    <article className="relative overflow-hidden rounded-[1.75rem] bg-[#fffdf8] px-4 pb-4 pt-5 shadow-[0_14px_34px_rgba(176,92,112,0.13)] ring-1 ring-rose-100/90">
      <div className="absolute right-0 top-0 h-16 w-24 rounded-bl-[2rem] bg-rose-50" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
            {formatType(item.type)}
          </span>
          <span className="rounded-full bg-[#fff0bd] px-3 py-1 text-xs font-semibold text-amber-800">
            {formatStatus(item.status)}
          </span>
          {averageRating ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
              Avg {averageRating.toFixed(1)}
            </span>
          ) : null}
        </div>
        <h2 className="mt-3 text-xl font-semibold leading-snug text-rose-950">
          {item.title}
        </h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-400">
          Added by {item.addedByName || getUserDisplayName(item.addedByUid)}
        </p>
        {item.platform || item.genre ? (
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {[item.platform, item.genre].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {item.notes ? (
          <p className="mt-3 rounded-2xl bg-rose-50/70 px-4 py-3 text-sm leading-6 text-stone-600">
            {item.notes}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 rounded-2xl bg-white/70 px-4 py-4 ring-1 ring-rose-100">
          {coupleUsers.allowedUserIds.map((uid) => (
            <div key={uid} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-rose-950">
                {getUserDisplayName(uid)}
              </span>
              <StarRating
                disabled={uid !== currentUserId}
                value={item.ratings[uid]?.stars ?? 0}
                onChange={(stars) => onRate(item, stars)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <select
            aria-label={`Change status for ${item.title}`}
            className="rounded-2xl border border-rose-100 bg-white/80 px-3 py-3 text-sm font-semibold text-rose-700 outline-none ring-rose-200 focus:ring-2"
            value={item.status}
            onChange={(event) => onStatusChange(item, event.target.value as TheaterStatus)}
          >
            {theaterStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onComment(item)}
            className="rounded-2xl bg-white/80 px-3 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
          >
            Comments {item.commentsCount ? `(${item.commentsCount})` : ""}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="col-span-2 rounded-2xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function StarRating({
  disabled,
  value,
  onChange
}: {
  disabled?: boolean;
  value: number;
  onChange: (stars: number) => void;
}) {
  return (
    <div className="flex gap-1" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          className={`min-h-9 min-w-8 rounded-full text-xl transition ${
            star <= value ? "text-amber-500" : "text-rose-200"
          } disabled:cursor-default`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function TheaterCommentsSheet({
  currentUserId,
  item,
  onClose,
  onError
}: {
  currentUserId: string;
  item: TheaterItem;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [comments, setComments] = useState<TheaterComment[]>([]);
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToTheaterComments(
      coupleConfig.coupleId,
      item.id,
      setComments,
      (error) => onError(getFriendlyError(error))
    );

    return () => unsubscribe();
  }, [item.id, onError]);

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!text.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await addTheaterComment(coupleConfig.coupleId, item.id, currentUserId, text);
      setText("");
    } catch (error) {
      onError(getFriendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteComment(comment: TheaterComment) {
    try {
      await deleteTheaterComment(coupleConfig.coupleId, item.id, comment.id);
    } catch (error) {
      onError(getFriendlyError(error));
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
              Comments
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
          >
            Close
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-2xl bg-rose-50/70 px-4 py-3 ring-1 ring-rose-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-rose-950">
                    {comment.userName}
                  </p>
                  {comment.uid === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment)}
                      className="text-xs font-semibold text-rose-500"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-stone-700">{comment.text}</p>
                <p className="mt-2 text-xs font-medium text-rose-400">
                  {formatDateTime(comment.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-rose-50/70 px-4 py-4 text-center text-sm font-medium leading-6 text-stone-600 ring-1 ring-rose-100">
              No comments yet. Leave the first little review.
            </p>
          )}
        </div>
        <form onSubmit={handleAddComment} className="mt-5 space-y-3">
          <textarea
            className="min-h-24 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
            placeholder="Write what you thought..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="submit"
            disabled={isSaving || !text.trim()}
            className="w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Sending..." : "Add comment"}
          </button>
        </form>
      </section>
    </div>
  );
}

function DeleteTheaterItemDialog({
  isDeleting,
  item,
  onCancel,
  onConfirm
}: {
  isDeleting: boolean;
  item: TheaterItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="w-full max-w-md rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Remove title
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Remove this from Yushef Theater?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          This will delete “{item.title}” and its comments. This cannot be undone.
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
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

function getCountdownDisplay(session: TheaterSession, now: number): string {
  if (session.countdownState !== "counting" || !session.countdownStartedAtMs) {
    return session.countdownState === "finished" ? "PLAY!" : "3";
  }

  const elapsedSeconds = (now - session.countdownStartedAtMs) / 1000;
  const remaining = Math.ceil(session.countdownDurationSeconds - elapsedSeconds);

  if (remaining <= 0) {
    return "PLAY!";
  }

  return String(Math.max(1, remaining));
}

function getAverageRating(item: TheaterItem): number | null {
  const ratings = Object.values(item.ratings)
    .map((rating) => rating.stars)
    .filter((stars) => stars > 0);

  if (ratings.length === 0) {
    return null;
  }

  return ratings.reduce((total, stars) => total + stars, 0) / ratings.length;
}

function formatType(type: TheaterItemType): string {
  return type
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function formatStatus(status: TheaterStatus): string {
  switch (status) {
    case "want_to_watch":
      return "Want to Watch";
    case "watching":
      return "Watching";
    case "watched":
      return "Watched";
  }
}

function formatDateTime(value: string): string {
  if (!value) {
    return "just now";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Firebase permissions blocked Yushef Theater. Check Firestore rules for the two allowed users.";
  }

  if (message.includes("network")) {
    return "Network connection failed. Try again when both devices are online.";
  }

  return message || "Something went wrong inside Yushef Theater.";
}
