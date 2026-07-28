"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { coupleConfig } from "@/lib/coupleConfig";
import { getUserDisplayName } from "@/lib/coupleUsers";
import {
  getDeniedNotificationMessage,
  getNotificationEnvironment,
  getNotificationSupport,
  getNotificationPermissionState,
  ensureNotificationTokenSaved,
  listenForForegroundMessages,
  requestNotificationPermission,
  type NotificationEnableStep
} from "@/lib/notificationService";
import {
  markReceivedNudgesRead,
  sendNudge,
  subscribeToRecentNudges,
  type Nudge,
  type NudgeType
} from "@/lib/nudgeService";

const presetNudges = [
  "Thinking of you ❤️",
  "I miss you",
  "Hug needed",
  "Call me when free",
  "Look at our app"
];

type NudgeCardProps = {
  currentUser: User;
  onError: (message: string) => void;
};

export function NudgeCard({ currentUser, onError }: NudgeCardProps) {
  const [selectedPreset, setSelectedPreset] = useState(presetNudges[0]);
  const [customMessage, setCustomMessage] = useState("");
  const [recentNudges, setRecentNudges] = useState<Nudge[]>([]);
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("unsupported");
  const [notificationStep, setNotificationStep] = useState<NotificationEnableStep>("idle");
  const [notificationEnvironment, setNotificationEnvironment] = useState(() => getNotificationEnvironment());
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [foregroundNudge, setForegroundNudge] = useState("");
  const sendLockRef = useRef(false);

  useEffect(() => {
    const support = getNotificationSupport();
    const environment = getNotificationEnvironment();
    const permission = getNotificationPermissionState();

    setNotificationEnvironment(environment);
    setPermissionState(permission);

    if (!support.supported) {
      setNotificationStep("unsupported");
      setStatusMessage(support.reason);
    }

    if (permission === "denied") {
      setNotificationStep("permission-denied");
      setStatusMessage(getDeniedNotificationMessage());
      setHasSavedToken(false);
      return;
    }

    if (support.supported && permission === "granted") {
      let cancelled = false;

      setNotificationStep("getting-token");
      setStatusMessage("Checking this device’s nudge key...");

      ensureNotificationTokenSaved(currentUser.uid, (progress) => {
        if (!cancelled) {
          setNotificationStep(progress.step);
          setStatusMessage(progress.message);
        }
      })
        .then(() => {
          if (!cancelled) {
            setHasSavedToken(true);
            setNotificationStep("enabled");
            setStatusMessage("");
          }
        })
        .catch((error) => {
          if (!cancelled) {
            if (isExpectedNotificationStateError(error)) {
              console.info("[Nudges] Notification setup needs attention", error);
            } else {
              console.error("[Nudges] Existing notification setup check failed", error);
            }
            setHasSavedToken(false);
            setNotificationStep("error");
            setStatusMessage(getFriendlyNudgeError(error));
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [currentUser.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToRecentNudges(
      coupleConfig.coupleId,
      (nudges) => {
        const uniqueNudges = dedupeNudgesById(nudges);

        setRecentNudges(uniqueNudges);
        markReceivedNudgesRead(coupleConfig.coupleId, uniqueNudges, currentUser.uid).catch(() => {
          // Read state is nice-to-have; do not interrupt the nudge UI.
        });
      },
      (error) => onError(getFriendlyNudgeError(error))
    );

    return unsubscribe;
  }, [currentUser.uid, onError]);

  useEffect(() => {
    let unsubscribe = () => {};

    listenForForegroundMessages((payload) => {
      const message = payload.notification?.body || payload.data?.message || "A little nudge arrived.";
      const isTheaterReady = payload.data?.type === "theater_ready";
      const senderName =
        (isTheaterReady ? payload.data?.readyName : payload.data?.fromName) ||
        getUserDisplayName(payload.data?.fromUid || payload.data?.fromUserId);

      setForegroundNudge(
        isTheaterReady
          ? `${senderName} is ready 🍿 — ${message}`
          : `from ${senderName}: ${message}`
      );
      window.setTimeout(() => setForegroundNudge(""), 5000);
    })
      .then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
      })
      .catch(() => {
        unsubscribe = () => {};
      });

    return () => unsubscribe();
  }, []);

  async function handleEnableNotifications() {
    setIsEnablingNotifications(true);
    setStatusMessage("");
    setNotificationStep("idle");
    setHasSavedToken(false);
    onError("");

    try {
      await requestNotificationPermission(currentUser.uid, (progress) => {
        setNotificationStep(progress.step);
        setStatusMessage(progress.message);
      });
      setPermissionState(getNotificationPermissionState());
      setHasSavedToken(true);
      setNotificationStep("enabled");
      setStatusMessage("Nudges are enabled");
    } catch (error) {
      if (isExpectedNotificationStateError(error)) {
        console.info("[Nudges] Notification permission was not enabled", error);
      } else {
        console.error("[Nudges] Could not enable notifications", error);
      }
      const message = getFriendlyNudgeError(error);
      setPermissionState(getNotificationPermissionState());
      setNotificationStep(
        getNotificationPermissionState() === "denied" ? "permission-denied" : "error"
      );
      setHasSavedToken(false);
      setStatusMessage(message);
    } finally {
      setIsEnablingNotifications(false);
    }
  }

  async function handleSendNudge() {
    if (sendLockRef.current) {
      return;
    }

    const trimmedCustom = customMessage.trim();
    const message = trimmedCustom || selectedPreset;
    const type: NudgeType = trimmedCustom ? "custom" : "preset";

    if (!message) {
      onError("Write or choose a nudge first.");
      return;
    }

    sendLockRef.current = true;
    setIsSending(true);
    setStatusMessage("");
    onError("");

    try {
      await sendNudge(coupleConfig.coupleId, {
        fromUserId: currentUser.uid,
        message,
        type
      });
      setCustomMessage("");
      setStatusMessage("Sent ❤️");
    } catch (error) {
      console.error("[Nudges] Could not send nudge", error);
      onError(getFriendlyNudgeError(error));
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  }

  const isNotificationEnabled =
    notificationStep === "enabled" && hasSavedToken && permissionState === "granted";
  const notificationSetup = getNotificationSetupContent({
    environment: notificationEnvironment,
    permissionState,
    notificationStep,
    statusMessage
  });

  return (
    <section className="mt-7 space-y-4">
      {foregroundNudge ? (
        <div className="rounded-3xl bg-rose-950 px-5 py-4 text-sm font-semibold text-rose-50 shadow-[0_18px_44px_rgba(67,42,45,0.22)]">
          New notification: {foregroundNudge}
        </div>
      ) : null}

      {isNotificationEnabled ? (
        <p className="rounded-3xl bg-white/72 px-4 py-3 text-center text-sm font-semibold text-rose-700 shadow-[0_12px_28px_rgba(176,92,112,0.1)] ring-1 ring-rose-100/90">
          Nudges enabled ❤️
        </p>
      ) : (
        <div className="rounded-[2rem] bg-white/84 px-5 py-6 shadow-[0_20px_48px_rgba(176,92,112,0.16)] ring-1 ring-rose-100/90">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
                Receive nudges
              </p>
              <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
                {notificationSetup.title}
              </h2>
            </div>
            <span className="text-2xl text-rose-300" aria-hidden="true">
              ♥
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {notificationSetup.description}
          </p>
          {notificationSetup.showButton ? (
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isEnablingNotifications}
              className="mt-4 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEnablingNotifications ? getEnableButtonLabel(notificationStep) : "Enable nudges on this device"}
            </button>
          ) : (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {notificationSetup.message}
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-stone-500">
            You can always send nudges. Receiving push nudges needs permission on this device.
          </p>
          {statusMessage && statusMessage !== notificationSetup.message ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{statusMessage}</p>
          ) : null}
        </div>
      )}

      <div className="rounded-[2rem] bg-white/84 px-5 py-6 shadow-[0_20px_48px_rgba(176,92,112,0.16)] ring-1 ring-rose-100/90">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Send a nudge
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Let them know
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Let them know you’re thinking of them.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-2">
          {presetNudges.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSelectedPreset(preset)}
              disabled={isSending}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold ring-1 transition ${
                selectedPreset === preset && !customMessage.trim()
                  ? "bg-rose-950 text-rose-50 ring-rose-950"
                  : "bg-rose-50/80 text-rose-800 ring-rose-100"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {preset}
            </button>
          ))}
        </div>

        <textarea
          className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
          placeholder="Write your own little nudge…"
          value={customMessage}
          onChange={(event) => setCustomMessage(event.target.value)}
          disabled={isSending}
        />

        <button
          type="button"
          onClick={handleSendNudge}
          disabled={isSending}
          className="mt-4 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send nudge"}
        </button>
      </div>

      <div className="rounded-[2rem] bg-white/76 px-5 py-5 shadow-[0_14px_32px_rgba(176,92,112,0.12)] ring-1 ring-rose-100/90">
        <h3 className="font-[var(--font-display)] text-2xl text-rose-950">
          Recent nudges
        </h3>
        {recentNudges.length > 0 ? (
          <div className="mt-4 space-y-3">
            {recentNudges.map((nudge) => (
              <div key={nudge.id} className="rounded-2xl bg-rose-50/70 px-4 py-3">
                <p className="text-sm font-semibold text-rose-950">
                  {nudge.fromUserId === currentUser.uid
                    ? "You sent"
                    : `${getUserDisplayName(nudge.fromUserId)} sent`}: {nudge.message}
                </p>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  {formatTimeAgo(nudge.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-stone-600">
            No nudges yet.
          </p>
        )}
      </div>
    </section>
  );
}

function formatTimeAgo(dateValue: string): string {
  if (!dateValue) {
    return "just now";
  }

  const diffMs = Date.now() - new Date(dateValue).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function dedupeNudgesById(nudges: Nudge[]): Nudge[] {
  const seen = new Set<string>();

  return nudges.filter((nudge) => {
    if (seen.has(nudge.id)) {
      return false;
    }

    seen.add(nudge.id);
    return true;
  });
}

function getFriendlyNudgeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (message.includes("iPhone Settings") || message.includes("Safari settings")) {
    return message;
  }

  if (process.env.NODE_ENV === "development") {
    return message;
  }

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Firebase permissions blocked this nudge. Check the rules for the two allowed users.";
  }

  if (message.includes("VAPID")) {
    return "Add your Firebase Web Push key before enabling nudges.";
  }

  if (message.includes("blocked")) {
    return getDeniedNotificationMessage();
  }

  return "Notifications could not be enabled yet. Please try again after reopening the app.";
}

function isExpectedNotificationStateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("Notifications are blocked") ||
    message.includes("not enabled on this device") ||
    message.includes("Home Screen")
  );
}

function getNotificationSetupContent({
  environment,
  permissionState,
  notificationStep,
  statusMessage
}: {
  environment: ReturnType<typeof getNotificationEnvironment>;
  permissionState: NotificationPermission | "unsupported";
  notificationStep: NotificationEnableStep;
  statusMessage: string;
}): {
  title: string;
  description: string;
  message: string;
  showButton: boolean;
} {
  if (environment.isIosSafariTab) {
    return {
      title: "Open from Home Screen",
      description: "To receive push nudges on iPhone, yushef needs to be opened as a Home Screen app.",
      message: "To receive nudges on iPhone, add yushef to your Home Screen first, then open it from there.",
      showButton: false
    };
  }

  if (permissionState === "denied" || notificationStep === "permission-denied") {
    return {
      title: "Notifications are blocked",
      description: "This only affects receiving push nudges on this device.",
      message: getDeniedNotificationMessage(),
      showButton: false
    };
  }

  if (notificationStep === "unsupported" || permissionState === "unsupported") {
    return {
      title: "Push is unavailable here",
      description: "This browser can still send nudges, but it cannot receive push notifications.",
      message: statusMessage || "This browser can send nudges but cannot receive push notifications.",
      showButton: false
    };
  }

  if (environment.isIosStandalonePwa) {
    return {
      title: "Enable push nudges",
      description: "Allow this Home Screen app to receive sweet little nudges when it is closed.",
      message: "",
      showButton: true
    };
  }

  return {
    title: "Enable push nudges",
    description: "Allow this device to receive sweet little nudges when the app is closed.",
    message: "",
    showButton: true
  };
}

function getEnableButtonLabel(step: NotificationEnableStep): string {
  switch (step) {
    case "registering-service-worker":
      return "Preparing...";
    case "waiting-for-service-worker":
      return "Almost ready...";
    case "getting-token":
      return "Creating key...";
    case "saving-token":
      return "Saving...";
    default:
      return "Enabling...";
  }
}
