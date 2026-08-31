"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ApologyLetterContent } from "@/components/apology/ApologyLetterContent";
import { ApologyLetterEditor } from "@/components/apology/ApologyLetterEditor";
import { SealedApologyLetter } from "@/components/apology/SealedApologyLetter";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  apologyLetterConfig,
  isApologyParticipant,
  isApologySender
} from "@/lib/apologyLetterConfig";
import {
  emptyApologyDraft,
  getApologyFriendlyError,
  hasOpenedApologyLocally,
  publishApologyLetter,
  rememberApologyOpenedLocally,
  saveApologyLetterDraft,
  subscribeToApologyLetter,
  subscribeToApologyPublication,
  type ApologyLetter,
  type ApologyLetterDraft,
  type ApologyLetterPublication,
  type PublishApologyLetterResult
} from "@/lib/apologyLetterService";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";

export function ApologyLetterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [letter, setLetter] = useState<ApologyLetter | null>(null);
  const [publication, setPublication] = useState<ApologyLetterPublication | null>(null);
  const [hasOpened, setHasOpened] = useState(false);
  const [isLoadingLetter, setIsLoadingLetter] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [publishNotice, setPublishNotice] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthReady(true);
      setIsLoadingLetter(false);
      setErrorMessage("Firebase is not configured on this device.");
      return;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseServices().auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setLetter(null);
    setPublication(null);
    setErrorMessage("");

    if (!currentUser || !isApologyParticipant(currentUser.uid)) {
      setIsLoadingLetter(false);
      return;
    }

    setIsLoadingLetter(true);
    setHasOpened(hasOpenedApologyLocally());

    if (isApologySender(currentUser.uid)) {
      return subscribeToApologyLetter(
        currentUser.uid,
        (nextLetter) => {
          setLetter(nextLetter);
          setIsLoadingLetter(false);
        },
        (error) => {
          setErrorMessage(
            getApologyFriendlyError(error, "Your private letter couldn’t be loaded.")
          );
          setIsLoadingLetter(false);
        }
      );
    }

    let unsubscribeLetter = () => {};
    const unsubscribePublication = subscribeToApologyPublication(
      currentUser.uid,
      (nextPublication) => {
        setPublication(nextPublication);
        unsubscribeLetter();
        unsubscribeLetter = () => {};

        if (!nextPublication) {
          setLetter(null);
          setIsLoadingLetter(false);
          return;
        }

        unsubscribeLetter = subscribeToApologyLetter(
          currentUser.uid,
          (nextLetter) => {
            setLetter(nextLetter);
            setIsLoadingLetter(false);
          },
          (error) => {
            setErrorMessage(
              getApologyFriendlyError(error, "This letter couldn’t be opened yet.")
            );
            setIsLoadingLetter(false);
          }
        );
      },
      (error) => {
        setErrorMessage(
          getApologyFriendlyError(error, "This private letter couldn’t be checked.")
        );
        setIsLoadingLetter(false);
      }
    );

    return () => {
      unsubscribePublication();
      unsubscribeLetter();
    };
  }, [currentUser]);

  async function handleSave(draft: ApologyLetterDraft): Promise<void> {
    if (!currentUser) {
      throw new Error("Sign in before saving this letter.");
    }

    await saveApologyLetterDraft(currentUser.uid, draft);
  }

  async function handlePublish(
    draft: ApologyLetterDraft
  ): Promise<PublishApologyLetterResult> {
    if (!currentUser) {
      throw new Error("Sign in before sealing this letter.");
    }

    await saveApologyLetterDraft(currentUser.uid, draft);
    const result = await publishApologyLetter(currentUser.uid);
    setPublishNotice(
      result.notificationSent
        ? "Your letter is sealed."
        : "Your letter is sealed, but the notification could not be sent."
    );
    return result;
  }

  function openLetter() {
    rememberApologyOpenedLocally();
    setHasOpened(true);
  }

  const homeButton = (
    <button
      type="button"
      onClick={() => router.push("/")}
      className="min-h-12 w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200"
    >
      Close 💗
    </button>
  );

  if (!authReady) {
    return <LetterScreenMessage message="Opening the private letter…" />;
  }

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            {apologyLetterConfig.title}
          </p>
          <h1 className="mt-2 font-[var(--font-display)] text-4xl text-rose-950">
            A private letter
          </h1>
          <p className="mt-3 text-base leading-7 text-stone-600">
            Sign in with one of the two allowed accounts to continue.
          </p>
          {errorMessage ? <PageError message={errorMessage} /> : null}
        </header>
        <AuthCard variant="screen" onError={setErrorMessage} />
      </main>
    );
  }

  if (!isApologyParticipant(currentUser.uid)) {
    return <LetterScreenMessage message="This account cannot access this private letter." />;
  }

  if (isLoadingLetter) {
    return <LetterScreenMessage message="Opening the private letter…" />;
  }

  if (errorMessage) {
    return (
      <LetterScreenMessage
        message={errorMessage}
        action={
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 min-h-11 rounded-2xl bg-rose-950 px-5 py-2 text-sm font-semibold text-rose-50"
          >
            Back home
          </button>
        }
      />
    );
  }

  if (isApologySender(currentUser.uid)) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6">
        <BackButton onClick={() => router.push("/")} />
        <div className="mt-5">
          {letter?.status === "published" ? (
            <div>
              {publishNotice ? (
                <p className="mb-4 rounded-2xl bg-white/85 px-4 py-3 text-sm font-medium leading-6 text-stone-600 ring-1 ring-rose-100">
                  {publishNotice}
                </p>
              ) : null}
              <ApologyLetterContent content={letter} action={homeButton} />
            </div>
          ) : (
            <ApologyLetterEditor
              initialDraft={letter ?? emptyApologyDraft}
              onSave={handleSave}
              onPublish={handlePublish}
            />
          )}
        </div>
      </main>
    );
  }

  if (!publication || !letter || letter.status !== "published") {
    return (
      <LetterScreenMessage
        message="There isn’t a letter available here right now."
        action={
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 min-h-11 rounded-2xl bg-rose-950 px-5 py-2 text-sm font-semibold text-rose-50"
          >
            Back home
          </button>
        }
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6">
      <BackButton onClick={() => router.push("/")} />
      <div className="my-auto py-5">
        {hasOpened ? (
          <ApologyLetterContent content={letter} action={homeButton} />
        ) : (
          <SealedApologyLetter onOpen={openLetter} />
        )}
      </div>
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 self-start rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
    >
      ← Back
    </button>
  );
}

function LetterScreenMessage({
  action,
  message
}: {
  action?: ReactNode;
  message: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] text-center">
      <div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-2xl ring-1 ring-rose-100" aria-hidden="true">
          💌
        </div>
        <p className="mt-5 text-base leading-7 text-stone-600">{message}</p>
        {action}
      </div>
    </main>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
      {message}
    </p>
  );
}
