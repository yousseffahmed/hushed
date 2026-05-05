import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
  type Unsubscribe
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "firebase/storage";
import { coupleConfig } from "@/lib/coupleConfig";
import { formatDateInputValue, getMonthversaryDate } from "@/lib/dateUtils";
import { getFirebaseServices } from "@/lib/firebase";

export type MonthversaryPhoto = {
  id: string;
  url: string;
  storagePath: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type MonthversaryMemory = {
  id: string;
  monthNumber: number;
  date: string;
  title: string;
  description?: string;
  photos: MonthversaryPhoto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthversaryMemoryInput = {
  monthNumber: number;
  date: string;
  title: string;
  description?: string;
};

export type MonthversaryWriteData = MonthversaryMemoryInput & {
  createdBy?: string;
};

export type UploadProgressCallback = (progress: {
  fileName: string;
  completed: number;
  total: number;
  percent: number;
}) => void;

const defaultMemoryTitles = [
  "Memory box",
  "Sushi date",
  "Movie night",
  "Coffee date",
  "Walk together"
];

export function subscribeToMonthversaries(
  coupleId: string,
  callback: (memories: MonthversaryMemory[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const monthversariesQuery = query(
    collection(db, "couples", coupleId, "monthversaries"),
    orderBy("monthNumber", "asc")
  );

  return onSnapshot(
    monthversariesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((memoryDoc) => mapMemoryDoc(memoryDoc.id, memoryDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export async function seedDefaultMonthversaries(coupleId: string, userId: string): Promise<void> {
  const defaults = getDefaultMonthversaryMemories(userId);

  await Promise.all(
    defaults.map((memory) =>
      addMonthversary(coupleId, {
        monthNumber: memory.monthNumber,
        date: memory.date,
        title: memory.title,
        description: memory.description,
        createdBy: userId
      })
    )
  );
}

export async function addMonthversary(
  coupleId: string,
  data: MonthversaryWriteData
): Promise<string> {
  const { db } = getFirebaseServices();
  const monthversaryCollection = collection(db, "couples", coupleId, "monthversaries");
  const docRef = await addDoc(monthversaryCollection, {
    monthNumber: data.monthNumber,
    date: data.date,
    title: data.title.trim(),
    description: data.description?.trim() || "",
    photos: [],
    createdBy: data.createdBy || "unknown",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function updateMonthversary(
  coupleId: string,
  memoryId: string,
  data: MonthversaryMemoryInput
): Promise<void> {
  const { db } = getFirebaseServices();

  await updateDoc(doc(db, "couples", coupleId, "monthversaries", memoryId), {
    monthNumber: data.monthNumber,
    date: data.date,
    title: data.title.trim(),
    description: data.description?.trim() || "",
    updatedAt: serverTimestamp()
  });
}

export async function deleteMonthversary(coupleId: string, memoryId: string): Promise<void> {
  const { db, storage } = getFirebaseServices();
  const memoryRef = doc(db, "couples", coupleId, "monthversaries", memoryId);
  const snapshot = await getDoc(memoryRef);
  const memory = snapshot.exists() ? mapMemoryDoc(snapshot.id, snapshot.data()) : null;

  if (memory) {
    // Older records may only have download URLs; those files cannot be deleted without a storagePath.
    const photosWithStoragePaths = memory.photos.filter((photo) => photo.storagePath);

    await Promise.allSettled(
      photosWithStoragePaths.map((photo) => deleteObject(ref(storage, photo.storagePath)))
    );
  }

  await deleteDoc(memoryRef);
}

export async function uploadMemoryPhotos(
  coupleId: string,
  memoryId: string,
  files: File[],
  userId: string,
  onProgress?: UploadProgressCallback
): Promise<MonthversaryPhoto[]> {
  const { db, storage } = getFirebaseServices();
  const memoryRef = doc(db, "couples", coupleId, "monthversaries", memoryId);
  const uploadedPhotos: MonthversaryPhoto[] = [];

  for (const file of files) {
    const photoId = createId();
    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `couples/${coupleId}/monthversaries/${memoryId}/${photoId}-${safeFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadedAt = new Date().toISOString();
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type
    });

    const url = await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          onProgress?.({
            fileName: file.name,
            completed: snapshot.bytesTransferred,
            total: snapshot.totalBytes,
            percent: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          });
        },
        reject,
        async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
      );
    });

    uploadedPhotos.push({
      id: photoId,
      url,
      storagePath,
      fileName: file.name,
      uploadedBy: userId,
      uploadedAt
    });
  }

  if (uploadedPhotos.length > 0) {
    await updateDoc(memoryRef, {
      photos: arrayUnion(...uploadedPhotos),
      updatedAt: serverTimestamp()
    });
  }

  return uploadedPhotos;
}

export async function deleteMemoryPhoto(
  coupleId: string,
  memoryId: string,
  photoId: string
): Promise<void> {
  const { db, storage } = getFirebaseServices();
  const memoryRef = doc(db, "couples", coupleId, "monthversaries", memoryId);
  const snapshot = await getDoc(memoryRef);

  if (!snapshot.exists()) {
    return;
  }

  const memory = mapMemoryDoc(snapshot.id, snapshot.data());
  const photo = memory.photos.find((item) => item.id === photoId);
  const nextPhotos = memory.photos.filter((item) => item.id !== photoId);

  if (photo) {
    await deleteObject(ref(storage, photo.storagePath));
  }

  await updateDoc(memoryRef, {
    photos: nextPhotos,
    updatedAt: serverTimestamp()
  });
}

export function getDefaultMonthversaryMemories(createdBy = "seed"): MonthversaryMemory[] {
  const createdAt = new Date().toISOString();

  return defaultMemoryTitles.map((title, index) => {
    const monthNumber = index + 1;
    const date = getMonthversaryDate(
      coupleConfig.startDate,
      monthNumber,
      coupleConfig.anniversaryDay
    );

    return {
      id: `default-monthversary-${monthNumber}`,
      monthNumber,
      date: formatDateInputValue(date),
      title,
      description: "",
      photos: [],
      createdBy,
      createdAt,
      updatedAt: createdAt
    };
  });
}

function mapMemoryDoc(id: string, data: Record<string, unknown>): MonthversaryMemory {
  return {
    id: typeof data.id === "string" ? data.id : id,
    monthNumber: typeof data.monthNumber === "number" ? data.monthNumber : 1,
    date: typeof data.date === "string" ? data.date : "",
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    photos: Array.isArray(data.photos) ? (data.photos as MonthversaryPhoto[]) : [],
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function stringifyTimestamp(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }

  return "";
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
