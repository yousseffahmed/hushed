import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
  updateDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "firebase/storage";
import { coupleConfig } from "@/lib/coupleConfig";
import { getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices } from "@/lib/firebase";
import {
  getSpecial19thUserIds,
  isSpecial19thUserId,
  special19thConfig,
  type Special19thUserId
} from "@/lib/special19Config";

export type Special19thPackageStatus = {
  ownerName: string;
  sealed: boolean;
  sealedAt: string;
};

export type Special19thEvent = {
  id: string;
  eventDate: string;
  title: string;
  packageStatuses: Record<Special19thUserId, Special19thPackageStatus>;
  revealStartedAt: string;
  revealAt: string;
  revealAtMs: number | null;
  revealStartedByUid: string;
  memoryCreated: boolean;
  memoryId: string;
  createdAt: string;
  updatedAt: string;
};

export type Special19thPackage = {
  ownerUid: Special19thUserId;
  ownerName: string;
  letter: string;
  wish: string;
  loveThisMonth: string;
  photoStoragePath: string;
  photoFileName: string;
  voiceNoteStoragePath: string;
  voiceNoteFileName: string;
  voiceNoteContentType: string;
  sealed: boolean;
  sealedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Special19thPackageDraft = Pick<
  Special19thPackage,
  "letter" | "wish" | "loveThisMonth"
>;

export type Special19thPresence = {
  uid: Special19thUserId;
  name: string;
  online: boolean;
  lastSeenAt: string;
  lastSeenAtMs: number;
};

export type Special19thMomentPhoto = {
  uid: Special19thUserId;
  name: string;
  storagePath: string;
  url: string;
  fileName: string;
  submittedAt: string;
  updatedAt: string;
};

export type Special19thUploadProgress = {
  kind: "package-photo" | "voice-note" | "moment-photo";
  fileName: string;
  percent: number;
};

export type Special19thDraftMedia = {
  photoFile?: File | null;
  voiceFile?: File | null;
};

type SealSpecial19thResult = {
  sealed: boolean;
  bothSealed: boolean;
};

type StartSpecial19thRevealResult = {
  revealAtMs: number;
  alreadyStarted: boolean;
};

export async function ensureSpecial19thEvent(): Promise<void> {
  const { db } = getFirebaseServices();
  const eventRef = getSpecial19thEventRef(db);
  const snapshot = await getDoc(eventRef);

  if (snapshot.exists()) {
    return;
  }

  const packageStatuses = Object.fromEntries(
    getSpecial19thUserIds().map((uid) => [
      uid,
      {
        ownerName: getUserDisplayName(uid),
        sealed: false,
        sealedAt: null
      }
    ])
  );

  try {
    await setDoc(eventRef, {
      id: special19thConfig.eventId,
      eventDate: special19thConfig.eventDate,
      title: special19thConfig.title,
      packageStatuses,
      revealStartedAt: null,
      revealAt: null,
      revealStartedByUid: null,
      memoryCreated: false,
      memoryId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // A simultaneous first visit may create the fixed event between our read and write.
    const currentSnapshot = await getDoc(eventRef);

    if (!currentSnapshot.exists()) {
      throw error;
    }
  }
}

export function subscribeToSpecial19thEvent(
  callback: (event: Special19thEvent | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();

  return onSnapshot(
    getSpecial19thEventRef(db),
    (snapshot) => callback(snapshot.exists() ? mapEvent(snapshot.data()) : null),
    (error) => onError?.(error)
  );
}

export function subscribeToOwnSpecial19thPackage(
  userId: string,
  callback: (packageData: Special19thPackage | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  assertAllowedUserId(userId);
  const { db } = getFirebaseServices();
  const packageRef = doc(getSpecial19thEventRef(db), "packages", userId);

  return onSnapshot(
    packageRef,
    (snapshot) => callback(snapshot.exists() ? mapPackage(snapshot.data(), userId) : null),
    (error) => onError?.(error)
  );
}

export function subscribeToSpecial19thPresence(
  callback: (presence: Record<string, Special19thPresence>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const presenceRef = collection(getSpecial19thEventRef(db), "presence");

  return onSnapshot(
    presenceRef,
    (snapshot) => {
      callback(
        Object.fromEntries(
          snapshot.docs
            .filter((presenceDoc) => isSpecial19thUserId(presenceDoc.id))
            .map((presenceDoc) => [
              presenceDoc.id,
              mapPresence(presenceDoc.data(), presenceDoc.id)
            ])
        )
      );
    },
    (error) => onError?.(error)
  );
}

export function subscribeToRevealedSpecial19thPackages(
  callback: (packages: Partial<Record<Special19thUserId, Special19thPackage>>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const packageValues: Partial<Record<Special19thUserId, Special19thPackage>> = {};
  const unsubscribes = getSpecial19thUserIds().map((uid) =>
    onSnapshot(
      doc(getSpecial19thEventRef(db), "packages", uid),
      (snapshot) => {
        if (snapshot.exists()) {
          packageValues[uid] = mapPackage(snapshot.data(), uid);
        } else {
          delete packageValues[uid];
        }

        callback({ ...packageValues });
      },
      (error) => onError?.(error)
    )
  );

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

export function subscribeToSpecial19thMomentPhotos(
  callback: (photos: Partial<Record<Special19thUserId, Special19thMomentPhoto>>) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const photoValues: Partial<Record<Special19thUserId, Special19thMomentPhoto>> = {};
  const unsubscribes = getSpecial19thUserIds().map((uid) =>
    onSnapshot(
      doc(getSpecial19thEventRef(db), "momentPhotos", uid),
      (snapshot) => {
        if (snapshot.exists()) {
          photoValues[uid] = mapMomentPhoto(snapshot.data(), uid);
        } else {
          delete photoValues[uid];
        }

        callback({ ...photoValues });
      },
      (error) => onError?.(error)
    )
  );

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}

export async function saveSpecial19thPackageDraft(
  userId: string,
  draft: Special19thPackageDraft,
  media: Special19thDraftMedia = {},
  onProgress?: (progress: Special19thUploadProgress) => void
): Promise<void> {
  assertAllowedUserId(userId);
  validateDraftText(draft);

  const { db, storage } = getFirebaseServices();
  const packageRef = doc(getSpecial19thEventRef(db), "packages", userId);
  const currentSnapshot = await getDoc(packageRef);
  const currentPackage = currentSnapshot.exists()
    ? mapPackage(currentSnapshot.data(), userId)
    : null;

  if (currentPackage?.sealed) {
    throw new Error("This 19th package is already sealed.");
  }

  await setDoc(packageRef, {
    ownerUid: userId,
    ownerName: getUserDisplayName(userId),
    letter: draft.letter.trim(),
    wish: draft.wish.trim(),
    loveThisMonth: draft.loveThisMonth.trim(),
    photoStoragePath: currentPackage?.photoStoragePath || null,
    photoFileName: currentPackage?.photoFileName || null,
    voiceNoteStoragePath: currentPackage?.voiceNoteStoragePath || null,
    voiceNoteFileName: currentPackage?.voiceNoteFileName || null,
    voiceNoteContentType: currentPackage?.voiceNoteContentType || null,
    sealed: false,
    sealedAt: null,
    createdAt: currentSnapshot.exists()
      ? currentSnapshot.data().createdAt ?? serverTimestamp()
      : serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (media.photoFile) {
    validatePhoto(media.photoFile, special19thConfig.packagePhotoMaxBytes);
    const nextPath = buildPackageMediaPath(userId, "photo", media.photoFile.name);

    await uploadProtectedFile(
      nextPath,
      media.photoFile,
      "package-photo",
      onProgress
    );

    try {
      await updateDoc(packageRef, {
        photoStoragePath: nextPath,
        photoFileName: media.photoFile.name,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      await deleteObject(ref(storage, nextPath)).catch(() => undefined);
      throw error;
    }

    if (currentPackage?.photoStoragePath && currentPackage.photoStoragePath !== nextPath) {
      await deleteObject(ref(storage, currentPackage.photoStoragePath)).catch(() => undefined);
    }
  }

  if (media.voiceFile) {
    validateVoiceNote(media.voiceFile);
    const nextPath = buildPackageMediaPath(userId, "voice", media.voiceFile.name);

    await uploadProtectedFile(nextPath, media.voiceFile, "voice-note", onProgress);

    try {
      await updateDoc(packageRef, {
        voiceNoteStoragePath: nextPath,
        voiceNoteFileName: media.voiceFile.name,
        voiceNoteContentType: media.voiceFile.type,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      await deleteObject(ref(storage, nextPath)).catch(() => undefined);
      throw error;
    }

    if (
      currentPackage?.voiceNoteStoragePath &&
      currentPackage.voiceNoteStoragePath !== nextPath
    ) {
      await deleteObject(ref(storage, currentPackage.voiceNoteStoragePath)).catch(
        () => undefined
      );
    }
  }
}

export async function sealSpecial19thPackage(
  userId: string
): Promise<SealSpecial19thResult> {
  assertAllowedUserId(userId);
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { coupleId: string; eventId: string },
    SealSpecial19thResult
  >(functions, "sealSpecial19thPackage");
  const result = await callable({
    coupleId: coupleConfig.coupleId,
    eventId: special19thConfig.eventId
  });

  return result.data;
}

export async function startSpecial19thReveal(): Promise<StartSpecial19thRevealResult> {
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { coupleId: string; eventId: string },
    StartSpecial19thRevealResult
  >(functions, "startSpecial19thReveal");
  const result = await callable({
    coupleId: coupleConfig.coupleId,
    eventId: special19thConfig.eventId
  });

  return result.data;
}

export async function markSpecial19thPresent(userId: string): Promise<void> {
  assertAllowedUserId(userId);
  const { db } = getFirebaseServices();

  await setDoc(doc(getSpecial19thEventRef(db), "presence", userId), {
    uid: userId,
    name: getUserDisplayName(userId),
    online: true,
    lastSeenAt: serverTimestamp()
  });
}

export async function leaveSpecial19th(userId: string): Promise<void> {
  assertAllowedUserId(userId);
  const { db } = getFirebaseServices();

  await setDoc(doc(getSpecial19thEventRef(db), "presence", userId), {
    uid: userId,
    name: getUserDisplayName(userId),
    online: false,
    lastSeenAt: serverTimestamp()
  });
}

export function getActiveSpecial19thPresence(
  presence: Record<string, Special19thPresence>,
  now = Date.now()
): Record<string, Special19thPresence> {
  return Object.fromEntries(
    Object.entries(presence).filter(
      ([, value]) =>
        value.online &&
        value.lastSeenAtMs > 0 &&
        now - value.lastSeenAtMs <= special19thConfig.presenceThresholdMs
    )
  );
}

export async function getSpecial19thMediaUrl(storagePath: string): Promise<string> {
  if (!storagePath) {
    return "";
  }

  const { storage } = getFirebaseServices();
  return getDownloadURL(ref(storage, storagePath));
}

export async function uploadSpecial19thMomentPhoto(
  userId: string,
  file: File,
  onProgress?: (progress: Special19thUploadProgress) => void
): Promise<void> {
  assertAllowedUserId(userId);
  validatePhoto(file, special19thConfig.momentPhotoMaxBytes);

  const { db, storage } = getFirebaseServices();
  const momentRef = doc(getSpecial19thEventRef(db), "momentPhotos", userId);
  const currentSnapshot = await getDoc(momentRef);
  const currentPhoto = currentSnapshot.exists()
    ? mapMomentPhoto(currentSnapshot.data(), userId)
    : null;
  const storagePath = `couples/${coupleConfig.coupleId}/special19ths/${special19thConfig.eventId}/momentPhotos/${userId}/${createId()}-${sanitizeFileName(file.name)}`;

  await uploadProtectedFile(storagePath, file, "moment-photo", onProgress);
  const url = await getDownloadURL(ref(storage, storagePath));

  try {
    await setDoc(momentRef, {
      uid: userId,
      name: getUserDisplayName(userId),
      storagePath,
      url,
      fileName: file.name,
      submittedAt: currentSnapshot.exists()
        ? currentSnapshot.data().submittedAt ?? serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    await deleteObject(ref(storage, storagePath)).catch(() => undefined);
    throw error;
  }

  if (currentPhoto?.storagePath && currentPhoto.storagePath !== storagePath) {
    await deleteObject(ref(storage, currentPhoto.storagePath)).catch(() => undefined);
  }
}

export function getSpecial19thFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const normalized = message.toLowerCase();

  console.error("[Special 19th] Firebase operation failed", error);

  if (normalized.includes("stepped away") || normalized.includes("both people must be present")) {
    return "Looks like they stepped away. We'll wait for them 💗";
  }

  if (normalized.includes("event date") || normalized.includes("august 19")) {
    return "Our packages stay sealed until 19 August 💗";
  }

  if (normalized.includes("permission") || normalized.includes("permission-denied")) {
    return "This action was blocked by the private event permissions.";
  }

  if (normalized.includes("upload") || normalized.includes("storage")) {
    return "That upload didn't work. Try again.";
  }

  if (
    normalized.includes("choose an image") ||
    normalized.includes("choose an audio") ||
    normalized.includes("larger than") ||
    normalized.includes("under 10,000") ||
    normalized.includes("under 2,000")
  ) {
    return message;
  }

  if (normalized.includes("network") || normalized.includes("offline")) {
    return "The connection slipped away. Try again when you're online 💗";
  }

  return "That didn't work yet. Please try again 💗";
}

function getSpecial19thEventRef(db: ReturnType<typeof getFirebaseServices>["db"]) {
  return doc(
    db,
    "couples",
    coupleConfig.coupleId,
    "special19ths",
    special19thConfig.eventId
  );
}

function mapEvent(data: Record<string, unknown>): Special19thEvent {
  const packageStatusesValue =
    data.packageStatuses && typeof data.packageStatuses === "object"
      ? (data.packageStatuses as Record<string, Record<string, unknown>>)
      : {};
  const packageStatuses = Object.fromEntries(
    getSpecial19thUserIds().map((uid) => {
      const status = packageStatusesValue[uid] ?? {};

      return [
        uid,
        {
          ownerName:
            typeof status.ownerName === "string"
              ? status.ownerName
              : getUserDisplayName(uid),
          sealed: Boolean(status.sealed),
          sealedAt: stringifyTimestamp(status.sealedAt)
        }
      ];
    })
  ) as Record<Special19thUserId, Special19thPackageStatus>;
  const revealAtMs = getTimestampMillis(data.revealAt);

  return {
    id: typeof data.id === "string" ? data.id : special19thConfig.eventId,
    eventDate:
      typeof data.eventDate === "string" ? data.eventDate : special19thConfig.eventDate,
    title: typeof data.title === "string" ? data.title : special19thConfig.title,
    packageStatuses,
    revealStartedAt: stringifyTimestamp(data.revealStartedAt),
    revealAt: stringifyTimestamp(data.revealAt),
    revealAtMs,
    revealStartedByUid:
      typeof data.revealStartedByUid === "string" ? data.revealStartedByUid : "",
    memoryCreated: Boolean(data.memoryCreated),
    memoryId: typeof data.memoryId === "string" ? data.memoryId : "",
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapPackage(
  data: Record<string, unknown>,
  fallbackUid: string
): Special19thPackage {
  const ownerUid = isSpecial19thUserId(data.ownerUid as string)
    ? (data.ownerUid as Special19thUserId)
    : (fallbackUid as Special19thUserId);

  return {
    ownerUid,
    ownerName:
      typeof data.ownerName === "string" ? data.ownerName : getUserDisplayName(ownerUid),
    letter: typeof data.letter === "string" ? data.letter : "",
    wish: typeof data.wish === "string" ? data.wish : "",
    loveThisMonth: typeof data.loveThisMonth === "string" ? data.loveThisMonth : "",
    photoStoragePath:
      typeof data.photoStoragePath === "string" ? data.photoStoragePath : "",
    photoFileName: typeof data.photoFileName === "string" ? data.photoFileName : "",
    voiceNoteStoragePath:
      typeof data.voiceNoteStoragePath === "string" ? data.voiceNoteStoragePath : "",
    voiceNoteFileName:
      typeof data.voiceNoteFileName === "string" ? data.voiceNoteFileName : "",
    voiceNoteContentType:
      typeof data.voiceNoteContentType === "string" ? data.voiceNoteContentType : "",
    sealed: Boolean(data.sealed),
    sealedAt: stringifyTimestamp(data.sealedAt),
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapPresence(
  data: Record<string, unknown>,
  fallbackUid: string
): Special19thPresence {
  const uid = isSpecial19thUserId(data.uid as string)
    ? (data.uid as Special19thUserId)
    : (fallbackUid as Special19thUserId);

  return {
    uid,
    name: typeof data.name === "string" ? data.name : getUserDisplayName(uid),
    online: Boolean(data.online),
    lastSeenAt: stringifyTimestamp(data.lastSeenAt),
    lastSeenAtMs: getTimestampMillis(data.lastSeenAt) ?? 0
  };
}

function mapMomentPhoto(
  data: Record<string, unknown>,
  fallbackUid: string
): Special19thMomentPhoto {
  const uid = isSpecial19thUserId(data.uid as string)
    ? (data.uid as Special19thUserId)
    : (fallbackUid as Special19thUserId);

  return {
    uid,
    name: typeof data.name === "string" ? data.name : getUserDisplayName(uid),
    storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
    url: typeof data.url === "string" ? data.url : "",
    fileName: typeof data.fileName === "string" ? data.fileName : "",
    submittedAt: stringifyTimestamp(data.submittedAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

async function uploadProtectedFile(
  storagePath: string,
  file: File,
  kind: Special19thUploadProgress["kind"],
  onProgress?: (progress: Special19thUploadProgress) => void
): Promise<void> {
  const { storage } = getFirebaseServices();
  const task = uploadBytesResumable(ref(storage, storagePath), file, {
    contentType: file.type
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress?.({
          kind,
          fileName: file.name,
          percent:
            snapshot.totalBytes > 0
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0
        });
      },
      reject,
      () => resolve()
    );
  });
}

function buildPackageMediaPath(
  userId: string,
  kind: "photo" | "voice",
  fileName: string
): string {
  return `couples/${coupleConfig.coupleId}/special19ths/${special19thConfig.eventId}/packages/${userId}/${kind}/${createId()}-${sanitizeFileName(fileName)}`;
}

function validateDraftText(draft: Special19thPackageDraft): void {
  if (draft.letter.length > 10_000) {
    throw new Error("Keep the letter under 10,000 characters.");
  }

  if (draft.wish.length > 2_000 || draft.loveThisMonth.length > 2_000) {
    throw new Error("Keep each little answer under 2,000 characters.");
  }
}

function validatePhoto(file: File, maxBytes: number): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image for this photo.");
  }

  if (file.size > maxBytes) {
    throw new Error(`That photo is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
}

function validateVoiceNote(file: File): void {
  if (!file.type.startsWith("audio/")) {
    throw new Error("Choose an audio file for the voice note.");
  }

  if (file.size > special19thConfig.voiceNoteMaxBytes) {
    throw new Error("That voice note is larger than 25 MB.");
  }
}

function assertAllowedUserId(userId: string): asserts userId is Special19thUserId {
  if (!isSpecial19thUserId(userId)) {
    throw new Error("This account is not allowed to use the special 19th.");
  }
}

function stringifyTimestamp(value: unknown): string {
  const milliseconds = getTimestampMillis(value);
  return milliseconds === null ? "" : new Date(milliseconds).toISOString();
}

function getTimestampMillis(value: unknown): number | null {
  if (value && typeof (value as Timestamp).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }

  if (typeof value === "string") {
    const milliseconds = new Date(value).getTime();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }

  return null;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "media";
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
