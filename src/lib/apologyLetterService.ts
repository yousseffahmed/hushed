import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { apologyLetterConfig, isApologyParticipant, isApologySender } from "@/lib/apologyLetterConfig";
import { getFirebaseServices } from "@/lib/firebase";

export type ApologyLetterStatus = "draft" | "published";

export type ApologyLetterDraft = {
  apology: string;
  shouldHaveDone: string;
  whatImChanging: string;
  commitments: string[];
};

export type ApologyLetter = ApologyLetterDraft & {
  id: string;
  type: "apology";
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  title: string;
  status: ApologyLetterStatus;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ApologyLetterPublication = {
  id: string;
  letterId: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  title: string;
  publishedAt: string;
};

export type PublishApologyLetterResult = {
  published: boolean;
  notificationSent: boolean;
  notificationStatus: "sent" | "partial" | "failed" | "no_tokens";
};

export const emptyApologyDraft: ApologyLetterDraft = {
  apology: "",
  shouldHaveDone: "",
  whatImChanging: "",
  commitments: [""]
};

export function subscribeToApologyLetter(
  userId: string,
  callback: (letter: ApologyLetter | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  assertParticipant(userId);
  const { db } = getFirebaseServices();

  return onSnapshot(
    getLetterRef(db),
    (snapshot) => callback(snapshot.exists() ? mapLetter(snapshot.data()) : null),
    (error) => onError?.(error)
  );
}

export function subscribeToApologyPublication(
  userId: string,
  callback: (publication: ApologyLetterPublication | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (userId !== apologyLetterConfig.toUid) {
    throw new Error("Only the recipient can subscribe to this letter invitation.");
  }

  const { db } = getFirebaseServices();
  const publicationRef = doc(
    db,
    "couples",
    apologyLetterConfig.coupleId,
    "letterPublications",
    apologyLetterConfig.publicationId
  );

  return onSnapshot(
    publicationRef,
    (snapshot) =>
      callback(snapshot.exists() ? mapPublication(snapshot.data()) : null),
    (error) => onError?.(error)
  );
}

export async function saveApologyLetterDraft(
  userId: string,
  draft: ApologyLetterDraft
): Promise<void> {
  if (!isApologySender(userId)) {
    throw new Error("Only Yuyu can write this letter.");
  }

  const normalized = normalizeApologyDraft(draft);
  validateDraftShape(normalized);
  const { db } = getFirebaseServices();
  const letterRef = getLetterRef(db);
  const snapshot = await getDoc(letterRef);

  if (snapshot.exists() && snapshot.data().status === "published") {
    throw new Error("This letter is already sealed and cannot be edited.");
  }

  await setDoc(letterRef, {
    id: apologyLetterConfig.letterId,
    type: apologyLetterConfig.type,
    fromUid: apologyLetterConfig.fromUid,
    fromName: apologyLetterConfig.fromName,
    toUid: apologyLetterConfig.toUid,
    toName: apologyLetterConfig.toName,
    title: apologyLetterConfig.title,
    ...normalized,
    status: "draft",
    publishedAt: null,
    createdAt: snapshot.exists()
      ? snapshot.data().createdAt ?? serverTimestamp()
      : serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function publishApologyLetter(
  userId: string
): Promise<PublishApologyLetterResult> {
  if (!isApologySender(userId)) {
    throw new Error("Only Yuyu can seal this letter.");
  }

  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { coupleId: string; letterId: string },
    PublishApologyLetterResult
  >(functions, "publishApologyLetter");
  const result = await callable({
    coupleId: apologyLetterConfig.coupleId,
    letterId: apologyLetterConfig.letterId
  });

  return result.data;
}

export function normalizeApologyDraft(
  draft: ApologyLetterDraft
): ApologyLetterDraft {
  const commitments = draft.commitments
    .slice(0, apologyLetterConfig.maxCommitments)
    .map((commitment) => commitment.trim());

  return {
    apology: draft.apology.trim(),
    shouldHaveDone: draft.shouldHaveDone.trim(),
    whatImChanging: draft.whatImChanging.trim(),
    commitments: commitments.length > 0 ? commitments : [""]
  };
}

export function getPublishValidationMessage(
  draft: ApologyLetterDraft
): string {
  const normalized = normalizeApologyDraft(draft);

  if (normalized.apology.length < 3) {
    return "Write clearly what you’re sorry for before sealing the letter.";
  }

  if (normalized.shouldHaveDone.length < 3) {
    return "Write what you believe you should have done differently.";
  }

  if (normalized.whatImChanging.length < 3) {
    return "Write what you intend to change through your actions.";
  }

  if (
    normalized.commitments.length < 1 ||
    normalized.commitments.some((commitment) => commitment.length < 3)
  ) {
    return "Add at least one clear commitment, and remove any empty commitment lines.";
  }

  return "";
}

export function hasOpenedApologyLocally(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(apologyLetterConfig.openedStorageKey) === "yes";
  } catch {
    return false;
  }
}

export function rememberApologyOpenedLocally(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(apologyLetterConfig.openedStorageKey, "yes");
  } catch {
    // Opening the letter must still work when local storage is unavailable.
  }
}

export function getApologyFriendlyError(
  error: unknown,
  fallback: string
): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  console.error("[Apology letter] Operation failed", error);

  if (normalized.includes("already sealed") || normalized.includes("already-exists")) {
    return "This letter is already sealed.";
  }

  if (normalized.includes("permission") || normalized.includes("permission-denied")) {
    return "The private letter permissions blocked this action.";
  }

  if (normalized.includes("network") || normalized.includes("offline")) {
    return "The connection slipped away. Try again when you’re online.";
  }

  return fallback;
}

function validateDraftShape(draft: ApologyLetterDraft): void {
  if (
    draft.apology.length > apologyLetterConfig.maxApologyLength ||
    draft.shouldHaveDone.length > apologyLetterConfig.maxReflectionLength ||
    draft.whatImChanging.length > apologyLetterConfig.maxReflectionLength
  ) {
    throw new Error("One of the letter sections is too long.");
  }

  if (
    draft.commitments.length < 1 ||
    draft.commitments.length > apologyLetterConfig.maxCommitments ||
    draft.commitments.some(
      (commitment) => commitment.length > apologyLetterConfig.maxCommitmentLength
    )
  ) {
    throw new Error("Keep between one and six short commitments.");
  }
}

function getLetterRef(db: ReturnType<typeof getFirebaseServices>["db"]) {
  return doc(
    db,
    "couples",
    apologyLetterConfig.coupleId,
    "letters",
    apologyLetterConfig.letterId
  );
}

function mapLetter(data: Record<string, unknown>): ApologyLetter {
  return {
    id: typeof data.id === "string" ? data.id : apologyLetterConfig.letterId,
    type: "apology",
    fromUid: typeof data.fromUid === "string" ? data.fromUid : "",
    fromName: typeof data.fromName === "string" ? data.fromName : "",
    toUid: typeof data.toUid === "string" ? data.toUid : "",
    toName: typeof data.toName === "string" ? data.toName : "",
    title: typeof data.title === "string" ? data.title : apologyLetterConfig.title,
    apology: typeof data.apology === "string" ? data.apology : "",
    shouldHaveDone:
      typeof data.shouldHaveDone === "string" ? data.shouldHaveDone : "",
    whatImChanging:
      typeof data.whatImChanging === "string" ? data.whatImChanging : "",
    commitments: Array.isArray(data.commitments)
      ? data.commitments.filter((value): value is string => typeof value === "string")
      : [],
    status: data.status === "published" ? "published" : "draft",
    publishedAt: stringifyTimestamp(data.publishedAt),
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapPublication(data: Record<string, unknown>): ApologyLetterPublication {
  return {
    id: typeof data.id === "string" ? data.id : apologyLetterConfig.publicationId,
    letterId:
      typeof data.letterId === "string" ? data.letterId : apologyLetterConfig.letterId,
    fromUid: typeof data.fromUid === "string" ? data.fromUid : "",
    fromName: typeof data.fromName === "string" ? data.fromName : "Yuyu",
    toUid: typeof data.toUid === "string" ? data.toUid : "",
    toName: typeof data.toName === "string" ? data.toName : "Shosho",
    title: typeof data.title === "string" ? data.title : apologyLetterConfig.title,
    publishedAt: stringifyTimestamp(data.publishedAt)
  };
}

function stringifyTimestamp(value: unknown): string {
  if (value && typeof (value as Timestamp).toMillis === "function") {
    return new Date((value as Timestamp).toMillis()).toISOString();
  }

  return "";
}

function assertParticipant(userId: string): void {
  if (!isApologyParticipant(userId)) {
    throw new Error("This account cannot access the private letter.");
  }
}
