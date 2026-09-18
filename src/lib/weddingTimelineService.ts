import {
  collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc,
  type DocumentData, type Timestamp
} from "firebase/firestore";
import { deleteObject, getDownloadURL, listAll, ref, uploadBytesResumable } from "firebase/storage";
import { coupleConfig } from "@/lib/coupleConfig";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices } from "@/lib/firebase";
import {
  MAX_WEDDING_NOTE_LENGTH, MAX_WEDDING_PHOTOS, sortWeddingMoments,
  validateWeddingFiles, validateWeddingInput,
  type WeddingMoment, type WeddingMomentInput, type WeddingPhoto
} from "@/lib/weddingTimeline";

const path = `couples/${coupleConfig.coupleId}/weddingTimeline`;
const momentRef = (id: string) => doc(getFirebaseServices().db, path, id);

function currentUserId(): string {
  const uid = getFirebaseServices().auth.currentUser?.uid;
  if (!uid || !coupleUsers.allowedUserIds.some((allowed) => allowed === uid)) {
    throw new Error("Sign in with your yushef account to save this moment.");
  }
  return uid;
}

export function subscribeToWeddingMoments(
  onChange: (moments: WeddingMoment[]) => void,
  onError: (error: Error) => void
) {
  currentUserId();
  return onSnapshot(collection(getFirebaseServices().db, path), (snapshot) => {
    onChange(sortWeddingMoments(snapshot.docs.map((entry) => mapMoment(entry.id, entry.data()))));
  }, onError);
}

export async function createWeddingMoment(input: WeddingMomentInput, note: string): Promise<string> {
  const uid = currentUserId();
  validateNote(note);
  const value = validateWeddingInput(input);
  const reference = doc(collection(getFirebaseServices().db, path));
  await setDoc(reference, {
    ...value, id: reference.id, createdByUid: uid, createdByName: getUserDisplayName(uid),
    photos: [], notesByUid: note.trim() ? { [uid]: { text: note.trim(), updatedAt: serverTimestamp() } } : {},
    deleting: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return reference.id;
}

export async function updateWeddingMoment(id: string, input: WeddingMomentInput, note: string): Promise<void> {
  const uid = currentUserId();
  validateNote(note);
  const value = validateWeddingInput(input);
  await runTransaction(getFirebaseServices().db, async (transaction) => {
    const reference = momentRef(id);
    const snapshot = await transaction.get(reference);
    assertEditable(snapshot.exists() ? snapshot.data() : null);
    transaction.update(reference, {
      ...value, [`notesByUid.${uid}`]: { text: note.trim(), updatedAt: serverTimestamp() },
      updatedAt: serverTimestamp()
    });
  });
}

export async function saveWeddingNote(id: string, note: string): Promise<void> {
  const uid = currentUserId();
  validateNote(note);
  await runTransaction(getFirebaseServices().db, async (transaction) => {
    const reference = momentRef(id);
    const snapshot = await transaction.get(reference);
    assertEditable(snapshot.exists() ? snapshot.data() : null);
    transaction.update(reference, {
      [`notesByUid.${uid}`]: { text: note.trim(), updatedAt: serverTimestamp() }, updatedAt: serverTimestamp()
    });
  });
}

export async function uploadWeddingPhotos(
  id: string, files: File[], onProgress: (percent: number) => void
): Promise<void> {
  if (!files.length) return;
  currentUserId();
  const { storage, db } = getFirebaseServices();
  const reference = momentRef(id);
  const snapshot = await getDoc(reference);
  assertEditable(snapshot.exists() ? snapshot.data() : null);
  validateWeddingFiles(files, snapshot.data()?.photos.length ?? 0);
  const uploaded: WeddingPhoto[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const photoId = doc(collection(db, path)).id;
      const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "photo";
      const storagePath = `${path}/${id}/${photoId}-${fileName}`;
      const target = ref(storage, storagePath);
      const task = uploadBytesResumable(target, file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => task.on("state_changed", (progress) => {
        onProgress(Math.round((index + progress.bytesTransferred / progress.totalBytes) / files.length * 100));
      }, reject, () => resolve()));
      uploadedPaths.push(storagePath);
      const url = await getDownloadURL(target);
      uploaded.push({ id: photoId, storagePath, url });
    }

    await runTransaction(db, async (transaction) => {
      const latest = await transaction.get(reference);
      assertEditable(latest.exists() ? latest.data() : null);
      const photos = latest.data()?.photos as WeddingPhoto[];
      if (photos.length + uploaded.length > MAX_WEDDING_PHOTOS) {
        throw new Error("More photos were added while you were uploading. There is room for 10 in total.");
      }
      transaction.update(reference, { photos: [...photos, ...uploaded], updatedAt: serverTimestamp() });
    });
  } catch (error) {
    const cleanup = await Promise.allSettled(uploadedPaths.map((filePath) => removeStoredPhoto(filePath)));
    if (cleanup.some((result) => result.status === "rejected")) {
      throw new Error("The photos could not be saved and some uploaded files could not be cleaned up. Removing this moment will retry its photo cleanup.");
    }
    throw error;
  }
}

export async function removeWeddingPhoto(id: string, photoId: string): Promise<void> {
  currentUserId();
  const reference = momentRef(id);
  // Keep the path in the document until Storage confirms deletion, so a retry can find it.
  const snapshot = await getDoc(reference);
  assertEditable(snapshot.exists() ? snapshot.data() : null);
  const photo = (snapshot.data()?.photos as WeddingPhoto[]).find((item) => item.id === photoId);
  if (!photo) return;
  await removeStoredPhoto(photo.storagePath);
  await runTransaction(getFirebaseServices().db, async (transaction) => {
    const latest = await transaction.get(reference);
    assertEditable(latest.exists() ? latest.data() : null);
    transaction.update(reference, {
      photos: (latest.data()?.photos as WeddingPhoto[]).filter((item) => item.id !== photoId),
      updatedAt: serverTimestamp()
    });
  });
}

export async function deleteWeddingMoment(id: string): Promise<void> {
  currentUserId();
  const { db, storage } = getFirebaseServices();
  const reference = momentRef(id);
  // This tombstone blocks concurrent uploads/edits. Failed cleanup remains retryable.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return;
    transaction.update(reference, { deleting: true, updatedAt: serverTimestamp() });
  });
  try {
    const folder = await listAll(ref(storage, `${path}/${id}`));
    const outcomes = await Promise.allSettled(folder.items.map((item) => removeStoredPhoto(item.fullPath)));
    if (outcomes.some((result) => result.status === "rejected")) throw new Error("Photo cleanup incomplete");
  } catch (error) {
    console.error("[Wedding] Photo cleanup incomplete", { path: `${path}/${id}`, code: errorCode(error) });
    throw new Error("Some photos could not be removed. This moment is paused for cleanup; tap Remove again to finish.");
  }
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) transaction.delete(reference);
  });
}

function validateNote(note: string) {
  if (note.length > MAX_WEDDING_NOTE_LENGTH) throw new Error("Keep your note under 4,000 characters.");
}

function assertEditable(data: DocumentData | null) {
  if (!data) throw new Error("This moment has been removed. Close it to return to your story.");
  if (data.deleting) throw new Error("This moment is being removed. Finish its photo cleanup first.");
}

async function removeStoredPhoto(storagePath: string) {
  try { await deleteObject(ref(getFirebaseServices().storage, storagePath)); }
  catch (error) { if (errorCode(error) !== "storage/object-not-found") throw error; }
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
}

export function weddingError(error: unknown): string {
  const code = errorCode(error);
  console.error("[Wedding] Operation failed", { code });
  if (code.includes("permission") || code.includes("unauthorized")) {
    return "Your wedding story permissions blocked this change. Please check the wedding Firestore and Storage rules.";
  }
  if (code.includes("unavailable") || code.includes("network") || code.includes("retry-limit")) {
    return "The connection slipped away. Your words are still here; please try again when you are online.";
  }
  return code === "unknown" && error instanceof Error ? error.message : "This moment could not be saved just yet. Please try again.";
}

function time(value: Timestamp | null | undefined): string {
  return value?.toDate?.().toISOString() ?? "";
}

function mapMoment(id: string, data: DocumentData): WeddingMoment {
  return { ...data, id, createdAt: time(data.createdAt), updatedAt: time(data.updatedAt),
    notesByUid: Object.fromEntries(Object.entries(data.notesByUid ?? {}).map(([uid, note]) => {
      const entry = note as { text: string; updatedAt: Timestamp | null };
      return [uid, { text: entry.text, updatedAt: time(entry.updatedAt) }];
    })) } as WeddingMoment;
}
