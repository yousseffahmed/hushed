"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { MomentPhotoSection } from "@/components/special-19th/MomentPhotoSection";
import { PackageEditor } from "@/components/special-19th/PackageEditor";
import { RevealedPackageCard } from "@/components/special-19th/RevealedPackageCard";
import {
  PackageReadinessCard,
  RevealReadyCard,
  SealedPackageCard
} from "@/components/special-19th/Special19thStatusCards";
import { getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  getSpecial19thPartnerId,
  getSpecial19thUserIds,
  hasSpecial19thDateArrived,
  isSpecial19thUserId,
  special19thConfig,
  type Special19thUserId
} from "@/lib/special19Config";
import {
  ensureSpecial19thEvent,
  getActiveSpecial19thPresence,
  getSpecial19thFriendlyError,
  getSpecial19thMediaUrl,
  leaveSpecial19th,
  markSpecial19thPresent,
  saveSpecial19thPackageDraft,
  sealSpecial19thPackage,
  startSpecial19thReveal,
  subscribeToOwnSpecial19thPackage,
  subscribeToRevealedSpecial19thPackages,
  subscribeToSpecial19thEvent,
  subscribeToSpecial19thMomentPhotos,
  subscribeToSpecial19thPresence,
  uploadSpecial19thMomentPhoto,
  type Special19thDraftMedia,
  type Special19thEvent,
  type Special19thMomentPhoto,
  type Special19thPackage,
  type Special19thPackageDraft,
  type Special19thPresence,
  type Special19thUploadProgress
} from "@/lib/special19thService";

export function Special19thPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [event, setEvent] = useState<Special19thEvent | null>(null);
  const [ownPackage, setOwnPackage] = useState<Special19thPackage | null>(null);
  const [ownPackageLoaded, setOwnPackageLoaded] = useState(false);
  const [presence, setPresence] = useState<Record<string, Special19thPresence>>({});
  const [revealedPackages, setRevealedPackages] = useState<
    Partial<Record<Special19thUserId, Special19thPackage>>
  >({});
  const [momentPhotos, setMomentPhotos] = useState<
    Partial<Record<Special19thUserId, Special19thMomentPhoto>>
  >({});
  const [ownPhotoUrl, setOwnPhotoUrl] = useState("");
  const [ownVoiceUrl, setOwnVoiceUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const [revealRetry, setRevealRetry] = useState(0);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [isStartingReveal, setIsStartingReveal] = useState(false);
  const [isUploadingMoment, setIsUploadingMoment] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [momentUploadStatus, setMomentUploadStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const allowedCurrentUserId =
    currentUser && isSpecial19thUserId(currentUser.uid) ? currentUser.uid : null;
  const revealReached = Boolean(event?.revealAtMs && now >= event.revealAtMs);
  const countdownVisible = Boolean(
    event?.revealAtMs && now < event.revealAtMs + 700
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setErrorMessage(
        "Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* values first."
      );
      setAuthReady(true);
      return;
    }

    const { auth } = getFirebaseServices();
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!allowedCurrentUserId) {
      setEvent(null);
      setOwnPackage(null);
      setOwnPackageLoaded(false);
      setPresence({});
      return;
    }

    let cancelled = false;
    let unsubscribeEvent = () => {};
    let unsubscribePackage = () => {};
    let unsubscribePresence = () => {};

    setErrorMessage("");
    ensureSpecial19thEvent()
      .then(() => {
        if (cancelled) {
          return;
        }

        unsubscribeEvent = subscribeToSpecial19thEvent(setEvent, handleSyncError);
        unsubscribePackage = subscribeToOwnSpecial19thPackage(
          allowedCurrentUserId,
          (nextPackage) => {
            setOwnPackage(nextPackage);
            setOwnPackageLoaded(true);
          },
          handleSyncError
        );
        unsubscribePresence = subscribeToSpecial19thPresence(setPresence, handleSyncError);
      })
      .catch((error) => setErrorMessage(getSpecial19thFriendlyError(error)));

    return () => {
      cancelled = true;
      unsubscribeEvent();
      unsubscribePackage();
      unsubscribePresence();
    };
  }, [allowedCurrentUserId]);

  useEffect(() => {
    if (!allowedCurrentUserId || !event?.id) {
      return;
    }

    let mounted = true;
    const markPresent = () => {
      markSpecial19thPresent(allowedCurrentUserId).catch((error) => {
        if (mounted) {
          setErrorMessage(getSpecial19thFriendlyError(error));
        }
      });
    };
    const markAway = () => {
      leaveSpecial19th(allowedCurrentUserId).catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        markPresent();
      } else {
        markAway();
      }
    };

    markPresent();
    const heartbeat = window.setInterval(
      markPresent,
      special19thConfig.presenceHeartbeatMs
    );
    window.addEventListener("pagehide", markAway);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", markAway);
      document.removeEventListener("visibilitychange", handleVisibility);
      markAway();
    };
  }, [allowedCurrentUserId, event?.id]);

  useEffect(() => {
    const countdownActive = Boolean(
      event?.revealAtMs && Date.now() < event.revealAtMs + 700
    );
    const interval = window.setInterval(
      () => setNow(Date.now()),
      countdownActive ? 100 : 5_000
    );
    return () => window.clearInterval(interval);
  }, [countdownVisible, event?.revealAtMs]);

  useEffect(() => {
    if (!revealReached) {
      setRevealedPackages({});
      setMomentPhotos({});
      return;
    }

    let retryTimer: number | null = null;
    let retryScheduled = false;
    const handleRevealReadError = (error: Error) => {
      if (!retryScheduled) {
        retryScheduled = true;
        retryTimer = window.setTimeout(() => setRevealRetry((attempt) => attempt + 1), 1000);
      }

      console.info("[Special 19th] Waiting for reveal read permissions", error.message);
    };
    const unsubscribePackages = subscribeToRevealedSpecial19thPackages(
      setRevealedPackages,
      handleRevealReadError
    );
    const unsubscribeMoments = subscribeToSpecial19thMomentPhotos(
      setMomentPhotos,
      handleRevealReadError
    );

    return () => {
      unsubscribePackages();
      unsubscribeMoments();

      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [revealReached, revealRetry]);

  useEffect(() => {
    let cancelled = false;
    const loadMedia = async () => {
      try {
        const [photoUrl, voiceUrl] = await Promise.all([
          ownPackage?.photoStoragePath
            ? getSpecial19thMediaUrl(ownPackage.photoStoragePath)
            : Promise.resolve(""),
          ownPackage?.voiceNoteStoragePath
            ? getSpecial19thMediaUrl(ownPackage.voiceNoteStoragePath)
            : Promise.resolve("")
        ]);

        if (!cancelled) {
          setOwnPhotoUrl(photoUrl);
          setOwnVoiceUrl(voiceUrl);
        }
      } catch (error) {
        console.error("[Special 19th] Draft media preview could not load", error);

        if (!cancelled) {
          setOwnPhotoUrl("");
          setOwnVoiceUrl("");
        }
      }
    };

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [ownPackage?.photoStoragePath, ownPackage?.voiceNoteStoragePath]);

  function handleSyncError(error: Error) {
    setErrorMessage(getSpecial19thFriendlyError(error));
  }

  function handleUploadProgress(progress: Special19thUploadProgress) {
    const label =
      progress.kind === "package-photo"
        ? "photo"
        : progress.kind === "voice-note"
          ? "voice note"
          : "moment photo";
    const message = `Uploading ${label}: ${progress.percent}%`;

    if (progress.kind === "moment-photo") {
      setMomentUploadStatus(message);
    } else {
      setUploadStatus(message);
    }
  }

  async function handleSavePackage(
    draft: Special19thPackageDraft,
    media: Special19thDraftMedia
  ): Promise<boolean> {
    if (!allowedCurrentUserId) {
      return false;
    }

    setIsSavingPackage(true);
    setErrorMessage("");
    setSuccessMessage("");
    setUploadStatus("");

    try {
      await saveSpecial19thPackageDraft(
        allowedCurrentUserId,
        draft,
        media,
        handleUploadProgress
      );
      setSuccessMessage("Your private draft is saved 💗");
      return true;
    } catch (error) {
      setErrorMessage(
        getSpecial19thFriendlyError(error) || "Your package couldn't be saved. Try again 💗"
      );
      return false;
    } finally {
      setIsSavingPackage(false);
      setUploadStatus("");
    }
  }

  async function handleSealPackage(
    draft: Special19thPackageDraft,
    media: Special19thDraftMedia
  ): Promise<boolean> {
    if (!allowedCurrentUserId) {
      return false;
    }

    setIsSavingPackage(true);
    setErrorMessage("");
    setSuccessMessage("");
    setUploadStatus("");

    try {
      await saveSpecial19thPackageDraft(
        allowedCurrentUserId,
        draft,
        media,
        handleUploadProgress
      );
      await sealSpecial19thPackage(allowedCurrentUserId);
      setSuccessMessage("Your 19th package is sealed 💌🔒");
      return true;
    } catch (error) {
      setErrorMessage(
        getSpecial19thFriendlyError(error) || "Your package couldn't be sealed yet."
      );
      return false;
    } finally {
      setIsSavingPackage(false);
      setUploadStatus("");
    }
  }

  async function handleStartReveal() {
    setIsStartingReveal(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await startSpecial19thReveal();
    } catch (error) {
      setErrorMessage(getSpecial19thFriendlyError(error));
    } finally {
      setIsStartingReveal(false);
    }
  }

  async function handleMomentUpload(file: File): Promise<boolean> {
    if (!allowedCurrentUserId) {
      return false;
    }

    setIsUploadingMoment(true);
    setErrorMessage("");
    setMomentUploadStatus("");

    try {
      await uploadSpecial19thMomentPhoto(
        allowedCurrentUserId,
        file,
        handleUploadProgress
      );
      return true;
    } catch (error) {
      setErrorMessage(getSpecial19thFriendlyError(error));
      return false;
    } finally {
      setIsUploadingMoment(false);
      setMomentUploadStatus("");
    }
  }

  const activePresence = useMemo(
    () => getActiveSpecial19thPresence(presence, now),
    [now, presence]
  );

  if (!authReady) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 text-sm font-semibold text-rose-600">
        Opening our 19th...
      </main>
    );
  }

  if (!currentUser || !allowedCurrentUserId) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-5 min-h-11 self-start rounded-full bg-white/80 px-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
        >
          ← Back
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
          Private for two
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-4xl leading-tight text-rose-950">
          Our First 19th Apart 💗
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Sign in to prepare the package waiting for our 19th.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
            {errorMessage}
          </p>
        ) : null}
        <AuthCard variant="screen" onError={setErrorMessage} />
      </main>
    );
  }

  const partnerId = getSpecial19thPartnerId(allowedCurrentUserId);
  const bothSealed = Boolean(
    event && getSpecial19thUserIds().every((uid) => event.packageStatuses[uid]?.sealed)
  );
  const dateArrived = hasSpecial19thDateArrived(now);
  const bothPresent = getSpecial19thUserIds().every((uid) => Boolean(activePresence[uid]));
  const canStartReveal =
    Boolean(event) && dateArrived && bothSealed && bothPresent && !event?.revealAtMs;
  const countdownValue = getCountdownValue(event?.revealAtMs ?? null, now);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="min-h-11 rounded-full bg-white/80 px-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
        >
          ← Home
        </button>
        <span className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700">
          19 Aug 2026
        </span>
      </header>

      <section className="mt-4 overflow-hidden rounded-[2rem] bg-rose-950 px-5 py-5 text-rose-50 shadow-[0_20px_48px_rgba(67,42,45,0.24)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
          A one-time yushef event
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-4xl leading-[1.02]">
          Our First 19th Apart 💗
        </h1>
        <p className="mt-3 text-sm leading-6 text-rose-100">
          {revealReached
            ? "17 months, and our first 19th apart. 💗"
            : "Same 19th. Different places. One package from each of us."}
        </p>
        {revealReached ? (
          <p className="mt-2 text-sm font-semibold text-white">
            Distance gets this one. We get all the others.
          </p>
        ) : null}
      </section>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl bg-white/88 px-4 py-3 text-sm font-semibold leading-6 text-rose-700 shadow-sm ring-1 ring-rose-100">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-4 rounded-2xl bg-rose-100/80 px-4 py-3 text-sm font-semibold leading-6 text-rose-800 ring-1 ring-rose-200">
          {successMessage}
        </p>
      ) : null}

      {!revealReached ? (
        <div className="mt-4 space-y-4">
          <PackageReadinessCard
            event={event}
            currentUserId={allowedCurrentUserId}
          />

          {ownPackageLoaded ? (
            ownPackage?.sealed ? (
              <SealedPackageCard partnerName={partnerId ? getUserDisplayName(partnerId) : "them"} />
            ) : (
              <PackageEditor
                key={allowedCurrentUserId}
                packageData={ownPackage}
                existingPhotoUrl={ownPhotoUrl}
                existingVoiceUrl={ownVoiceUrl}
                isSaving={isSavingPackage}
                uploadStatus={uploadStatus}
                onSave={handleSavePackage}
                onSeal={handleSealPackage}
              />
            )
          ) : (
            <div className="rounded-[2rem] bg-white/80 px-5 py-6 text-center text-sm font-semibold text-rose-600 ring-1 ring-rose-100">
              Opening your private draft...
            </div>
          )}

          <RevealReadyCard
            activePresence={activePresence}
            bothSealed={bothSealed}
            canStartReveal={canStartReveal}
            dateArrived={dateArrived}
            event={event}
            isStarting={isStartingReveal}
            onStart={handleStartReveal}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {getSpecial19thUserIds().every((uid) => revealedPackages[uid]) ? (
            getSpecial19thUserIds().map((uid) => (
              <RevealedPackageCard key={uid} packageData={revealedPackages[uid]!} />
            ))
          ) : (
            <div className="rounded-[2rem] bg-white/84 px-5 py-8 text-center text-sm font-semibold text-rose-600 ring-1 ring-rose-100">
              Opening both packages together... 💗
            </div>
          )}

          <MomentPhotoSection
            currentUserId={allowedCurrentUserId}
            isUploading={isUploadingMoment}
            memoryCreated={Boolean(event?.memoryCreated)}
            photos={momentPhotos}
            uploadStatus={momentUploadStatus}
            onUpload={handleMomentUpload}
          />

          {getSpecial19thUserIds().every((uid) => momentPhotos[uid]) ? (
            <p className="text-center text-xs font-semibold leading-5 text-rose-500">
              This page is now part of our story and will stay here for us.
            </p>
          ) : null}
        </div>
      )}

      {event?.revealAtMs && countdownVisible ? (
        <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-rose-950 px-5 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-rose-50">
          <div className="text-center" aria-live="assertive">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">
              Opening together
            </p>
            <p className="mt-5 font-[var(--font-display)] text-8xl leading-none">
              {countdownValue}
            </p>
            <p className="mt-5 text-sm font-semibold text-rose-100">
              Same second. Same little heartbeat.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function getCountdownValue(revealAtMs: number | null, now: number): string {
  if (!revealAtMs) {
    return "3";
  }

  const seconds = Math.ceil((revealAtMs - now) / 1000);
  return seconds > 0 ? String(Math.min(3, seconds)) : "💗";
}
