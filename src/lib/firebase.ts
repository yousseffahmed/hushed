import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import {
  getFirestore,
  initializeFirestore,
  type Firestore
} from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

let firestoreDb: Firestore | null = null;
let diagnosticsLogged = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.storageBucket &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId
  );
}

export function getFirebaseServices() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* environment variables.");
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getConfiguredFirestore(app);

  logFirebaseDiagnostics();

  return {
    app,
    auth: getAuth(app),
    db,
    functions: getFunctions(app),
    storage: getStorage(app)
  };
}

export async function getFirebaseMessaging() {
  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isSupported();

  if (!supported) {
    return null;
  }

  const { app } = getFirebaseServices();
  return getMessaging(app);
}

export function logFirebaseDiagnostics(): void {
  if (process.env.NODE_ENV !== "development" || diagnosticsLogged) {
    return;
  }

  diagnosticsLogged = true;

  const envPresence = {
    apiKey: Boolean(firebaseConfig.apiKey),
    authDomain: Boolean(firebaseConfig.authDomain),
    projectId: Boolean(firebaseConfig.projectId),
    storageBucket: Boolean(firebaseConfig.storageBucket),
    messagingSenderId: Boolean(firebaseConfig.messagingSenderId),
    appId: Boolean(firebaseConfig.appId),
    measurementId: Boolean(firebaseConfig.measurementId),
    vapidKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY)
  };

  console.info("[Firebase diagnostics]", {
    projectId: firebaseConfig.projectId || "(missing)",
    authDomain: firebaseConfig.authDomain || "(missing)",
    envPresence,
    online: typeof navigator !== "undefined" ? navigator.onLine : "server",
    hostname: typeof window !== "undefined" ? window.location.hostname : "server",
    https: typeof window !== "undefined" ? window.location.protocol === "https:" : "server",
    localhost:
      typeof window !== "undefined"
        ? ["localhost", "127.0.0.1"].includes(window.location.hostname)
        : "server"
  });
}

function getConfiguredFirestore(app: ReturnType<typeof initializeApp>): Firestore {
  if (firestoreDb) {
    return firestoreDb;
  }

  try {
    firestoreDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    });
  } catch {
    firestoreDb = getFirestore(app);
  }

  return firestoreDb;
}
