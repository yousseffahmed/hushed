import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe
} from "firebase/firestore";
import { getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices } from "@/lib/firebase";

export const suggestionCategories = [
  "Date",
  "Food",
  "Travel",
  "Gift",
  "Activity",
  "Cozy Day",
  "Future Plan",
  "Surprise",
  "Other"
] as const;

export type SuggestionCategory = (typeof suggestionCategories)[number];
export type SuggestionFilter = "all" | "open" | "done" | "mine";

export type Suggestion = {
  id: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  title: string;
  message: string;
  category: SuggestionCategory | "";
  mood: string;
  note: string;
  likedBy: string[];
  done: boolean;
  doneAt: string | null;
  archived: boolean;
};

export type SuggestionInput = {
  title?: string;
  message: string;
  category?: SuggestionCategory | "";
  mood?: string;
  note?: string;
};

export function subscribeToSuggestions(
  coupleId: string,
  callback: (suggestions: Suggestion[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const suggestionsQuery = query(
    collection(db, "couples", coupleId, "suggestions"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    suggestionsQuery,
    (snapshot) => {
      callback(snapshot.docs.map((suggestionDoc) => mapSuggestionDoc(suggestionDoc.id, suggestionDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export async function addSuggestion(
  coupleId: string,
  userId: string,
  input: SuggestionInput
): Promise<string> {
  const { db } = getFirebaseServices();
  const suggestionRef = doc(collection(db, "couples", coupleId, "suggestions"));

  await setDoc(suggestionRef, {
    id: suggestionRef.id,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: getUserDisplayName(userId),
    title: input.title?.trim() || "",
    message: input.message.trim(),
    category: input.category || "",
    mood: input.mood?.trim() || "",
    note: input.note?.trim() || "",
    likedBy: [],
    done: false,
    doneAt: null,
    archived: false
  });
  return suggestionRef.id;
}

export async function toggleSuggestionLike(
  coupleId: string,
  suggestion: Suggestion,
  userId: string
): Promise<void> {
  const { db } = getFirebaseServices();
  const suggestionRef = doc(db, "couples", coupleId, "suggestions", suggestion.id);
  const liked = suggestion.likedBy.includes(userId);

  await updateDoc(suggestionRef, {
    likedBy: liked ? arrayRemove(userId) : arrayUnion(userId)
  });
}

export async function setSuggestionDone(
  coupleId: string,
  suggestionId: string,
  done: boolean
): Promise<void> {
  const { db } = getFirebaseServices();

  await updateDoc(doc(db, "couples", coupleId, "suggestions", suggestionId), {
    done,
    doneAt: done ? serverTimestamp() : null
  });
}

export async function deleteSuggestion(coupleId: string, suggestionId: string): Promise<void> {
  const { db } = getFirebaseServices();

  await deleteDoc(doc(db, "couples", coupleId, "suggestions", suggestionId));
}

function mapSuggestionDoc(id: string, data: Record<string, unknown>): Suggestion {
  return {
    id: typeof data.id === "string" ? data.id : id,
    createdAt: stringifyTimestamp(data.createdAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdByName:
      typeof data.createdByName === "string" && data.createdByName
        ? data.createdByName
        : getUserDisplayName(typeof data.createdBy === "string" ? data.createdBy : ""),
    title: typeof data.title === "string" ? data.title : "",
    message: typeof data.message === "string" ? data.message : "",
    category: isSuggestionCategory(data.category) ? data.category : "",
    mood: typeof data.mood === "string" ? data.mood : "",
    note: typeof data.note === "string" ? data.note : "",
    likedBy: Array.isArray(data.likedBy)
      ? data.likedBy.filter((item): item is string => typeof item === "string")
      : [],
    done: Boolean(data.done),
    doneAt: data.doneAt ? stringifyTimestamp(data.doneAt) : null,
    archived: Boolean(data.archived)
  };
}

function isSuggestionCategory(value: unknown): value is SuggestionCategory {
  return typeof value === "string" && suggestionCategories.includes(value as SuggestionCategory);
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
