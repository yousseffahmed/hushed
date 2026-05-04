import { doc, getDoc, serverTimestamp, setDoc, waitForPendingWrites } from "firebase/firestore";
import { getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseMessaging, getFirebaseServices } from "@/lib/firebase";
import { coupleConfig } from "@/lib/coupleConfig";

export type NotificationTokenPlatform = "ios-pwa" | "web";
export type NotificationBrowser = "chrome" | "safari" | "firefox" | "edge" | "unknown";
export type NotificationEnvironment = {
  browser: NotificationBrowser;
  isIos: boolean;
  isStandalone: boolean;
  isIosSafariTab: boolean;
  isIosStandalonePwa: boolean;
  isMacSafari: boolean;
};
export type NotificationEnableStep =
  | "idle"
  | "unsupported"
  | "permission-denied"
  | "registering-service-worker"
  | "waiting-for-service-worker"
  | "getting-token"
  | "saving-token"
  | "enabled"
  | "error";

export type NotificationEnableProgress = {
  step: NotificationEnableStep;
  message: string;
};

type NotificationSupportResult =
  | { supported: true }
  | { supported: false; reason: string };

export async function requestNotificationPermission(
  userId: string,
  onProgress?: (progress: NotificationEnableProgress) => void
): Promise<string> {
  const support = getNotificationSupport();

  if (!support.supported) {
    onProgress?.({ step: "unsupported", message: support.reason });
    throw new Error(support.reason);
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    const message = getDeniedNotificationMessage();

    onProgress?.({
      step: "permission-denied",
      message
    });
    throw new Error(message);
  }

  return getMessagingToken(userId, onProgress);
}

export async function getMessagingToken(
  userId: string,
  onProgress?: (progress: NotificationEnableProgress) => void
): Promise<string> {
  const support = getNotificationSupport();

  if (!support.supported) {
    onProgress?.({ step: "unsupported", message: support.reason });
    throw new Error(support.reason);
  }

  if (getNotificationPermissionState() !== "granted") {
    const message = getDeniedNotificationMessage();

    onProgress?.({ step: "permission-denied", message });
    throw new Error(message);
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    onProgress?.({
      step: "unsupported",
      message: "Push notifications may only work after adding yushef to your iPhone Home Screen."
    });
    throw new Error("Push notifications may only work after adding yushef to your iPhone Home Screen.");
  }

  onProgress?.({
    step: "registering-service-worker",
    message: "Preparing notifications..."
  });
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/"
  });
  onProgress?.({
    step: "waiting-for-service-worker",
    message: "Waiting for notification support..."
  });
  const activeRegistration = await waitForActiveServiceWorker(registration);

  onProgress?.({
    step: "getting-token",
    message: "Creating this device’s nudge key..."
  });
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: activeRegistration
  });

  if (!token) {
    throw new Error("No notification token was created. Try enabling notifications again.");
  }

  onProgress?.({
    step: "saving-token",
    message: "Saving this device for nudges..."
  });
  await saveNotificationToken(userId, token);
  onProgress?.({
    step: "enabled",
    message: "Nudges are enabled"
  });
  return token;
}

export async function saveNotificationToken(userId: string, token: string): Promise<void> {
  const { db } = getFirebaseServices();
  const tokenId = createTokenId(token);
  const tokenRef = doc(
    db,
    "couples",
    coupleConfig.coupleId,
    "notificationTokens",
    userId,
    "tokens",
    tokenId
  );
  const existingToken = await getDoc(tokenRef);
  const metadata = getDeviceMetadata();

  await setDoc(
    tokenRef,
    {
      token,
      ...metadata,
      createdAt: existingToken.exists() ? existingToken.data().createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp()
    },
    { merge: true }
  );
  await withTimeout(
    waitForPendingWrites(db),
    10000,
    "The notification token was created, but Firestore did not confirm the save. Check your connection and try again."
  );
}

export async function ensureNotificationTokenSaved(
  userId: string,
  onProgress?: (progress: NotificationEnableProgress) => void
): Promise<string> {
  const permission = getNotificationPermissionState();

  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? getDeniedNotificationMessage()
        : "Notifications are not enabled on this device yet."
    );
  }

  return getMessagingToken(userId, onProgress);
}

export async function listenForForegroundMessages(
  callback: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, callback);
}

export function getNotificationPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export function getNotificationSupport(): NotificationSupportResult {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Notifications are only available in the browser." };
  }

  const environment = getNotificationEnvironment();

  if (environment.isIosSafariTab) {
    return {
      supported: false,
      reason: "To receive nudges on iPhone, add yushef to your Home Screen first, then open it from there."
    };
  }

  if (!("Notification" in window)) {
    return { supported: false, reason: "This browser can send nudges but cannot receive push notifications." };
  }

  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "This browser can send nudges but cannot receive push notifications." };
  }

  if (!("PushManager" in window)) {
    return {
      supported: false,
      reason: "This browser can send nudges but cannot receive push notifications."
    };
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    return {
      supported: false,
      reason: "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY. Add your Firebase Web Push certificate key."
    };
  }

  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (window.location.protocol !== "https:" && !isLocalhost) {
    return {
      supported: false,
      reason: "Notifications need HTTPS. Open the deployed app or localhost."
    };
  }

  return { supported: true };
}

export function getNotificationEnvironment(): NotificationEnvironment {
  if (typeof window === "undefined") {
    return {
      browser: "unknown",
      isIos: false,
      isStandalone: false,
      isIosSafariTab: false,
      isIosStandalonePwa: false,
      isMacSafari: false
    };
  }

  const userAgent = navigator.userAgent;
  const browser = detectBrowser();
  const isIpadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const isIos = /iPad|iPhone|iPod/i.test(userAgent) || isIpadDesktopMode;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const isStandalone =
    Boolean(navigatorWithStandalone.standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
  const isSafari = browser === "safari";

  return {
    browser,
    isIos,
    isStandalone,
    isIosSafariTab: isIos && isSafari && !isStandalone,
    isIosStandalonePwa: isIos && isStandalone,
    isMacSafari: !isIos && isSafari
  };
}

export function getDeniedNotificationMessage(): string {
  const environment = getNotificationEnvironment();

  if (environment.isIosStandalonePwa) {
    return "Notifications are blocked for yushef. Enable them from iPhone Settings > Notifications > yushef.";
  }

  if (environment.isMacSafari) {
    return "Notifications are blocked in Safari settings for this site. You can still send nudges.";
  }

  return "Notifications are blocked in this browser. You can still send nudges.";
}

async function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration
): Promise<ServiceWorkerRegistration> {
  if (registration.active) {
    return registration;
  }

  if (registration.installing || registration.waiting) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      const timeout = window.setTimeout(() => {
        reject(new Error("The notification service worker did not become active in time."));
      }, 10000);

      if (!worker) {
        window.clearTimeout(timeout);
        resolve();
        return;
      }

      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  return readyRegistration.active ? readyRegistration : registration;
}

function isIosStandalonePwa(): boolean {
  return getNotificationEnvironment().isIosStandalonePwa;
}

function getDeviceMetadata(): {
  platform: NotificationTokenPlatform;
  browser: NotificationBrowser;
  userAgent: string;
} {
  return {
    platform: isIosStandalonePwa() ? "ios-pwa" : "web",
    browser: detectBrowser(),
    userAgent: navigator.userAgent
  };
}

function detectBrowser(): NotificationBrowser {
  const userAgent = navigator.userAgent;

  if (/CriOS|Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) {
    return "chrome";
  }

  if (/Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|Edg/i.test(userAgent)) {
    return "safari";
  }

  if (/Firefox|FxiOS/i.test(userAgent)) {
    return "firefox";
  }

  if (/Edg/i.test(userAgent)) {
    return "edge";
  }

  return "unknown";
}

function createTokenId(token: string): string {
  return btoa(token).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}
