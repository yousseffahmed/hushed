import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe
} from "firebase/firestore";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices } from "@/lib/firebase";

export const theaterItemTypes = ["movie", "series", "episode", "other"] as const;
export const theaterStatuses = ["want_to_watch", "watching", "watched"] as const;

export type TheaterItemType = (typeof theaterItemTypes)[number];
export type TheaterStatus = (typeof theaterStatuses)[number];
export type TheaterFilter = "all" | TheaterStatus;

export type TheaterRating = {
  stars: number;
  updatedAt: string;
  userName: string;
};

export type TheaterItem = {
  id: string;
  title: string;
  type: TheaterItemType;
  status: TheaterStatus;
  addedByUid: string;
  addedByName: string;
  createdAt: string;
  updatedAt: string;
  posterUrl: string;
  platform: string;
  genre: string;
  notes: string;
  ratings: Record<string, TheaterRating>;
  commentsCount: number;
};

export type TheaterItemInput = {
  title: string;
  type: TheaterItemType;
  platform?: string;
  genre?: string;
  notes?: string;
};

export type TheaterComment = {
  id: string;
  uid: string;
  userName: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type TheaterPresence = {
  name: string;
  joinedAt: string;
  lastSeenAt: number;
};

export type TheaterReadiness = {
  name: string;
  ready: boolean;
  readyAt: string;
};

export type TheaterSession = {
  active: boolean;
  presentUsers: Record<string, TheaterPresence>;
  readyUsers: Record<string, TheaterReadiness>;
  selectedItemId: string;
  countdownState: "idle" | "counting" | "finished";
  countdownStartedAt: string;
  countdownStartedAtMs: number | null;
  countdownStartedByUid: string;
  countdownStartedByName: string;
  countdownDurationSeconds: number;
  playAt: string;
  updatedAt: string;
};

export function subscribeToTheaterItems(
  coupleId: string,
  callback: (items: TheaterItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const theaterQuery = query(
    collection(db, "couples", coupleId, "theaterItems"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    theaterQuery,
    (snapshot) => {
      callback(snapshot.docs.map((itemDoc) => mapTheaterItemDoc(itemDoc.id, itemDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToTheaterSession(
  coupleId: string,
  callback: (session: TheaterSession) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const sessionRef = doc(db, "couples", coupleId, "theaterSession", "current");

  return onSnapshot(
    sessionRef,
    (snapshot) => {
      callback(mapTheaterSessionDoc(snapshot.data() ?? {}));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToTheaterComments(
  coupleId: string,
  itemId: string,
  callback: (comments: TheaterComment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const commentsQuery = query(
    collection(db, "couples", coupleId, "theaterItems", itemId, "comments"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      callback(snapshot.docs.map((commentDoc) => mapCommentDoc(commentDoc.id, commentDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export async function addTheaterItem(
  coupleId: string,
  userId: string,
  input: TheaterItemInput
): Promise<string> {
  const { db } = getFirebaseServices();
  const itemRef = doc(collection(db, "couples", coupleId, "theaterItems"));

  await setDoc(itemRef, {
    id: itemRef.id,
    title: input.title.trim(),
    type: input.type,
    status: "want_to_watch",
    addedByUid: userId,
    addedByName: getUserDisplayName(userId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    posterUrl: "",
    platform: input.platform?.trim() || "",
    genre: input.genre?.trim() || "",
    notes: input.notes?.trim() || "",
    ratings: {},
    commentsCount: 0
  });

  return itemRef.id;
}

export async function updateTheaterItemStatus(
  coupleId: string,
  itemId: string,
  status: TheaterStatus
): Promise<void> {
  const { db } = getFirebaseServices();

  await updateDoc(doc(db, "couples", coupleId, "theaterItems", itemId), {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function setTheaterRating(
  coupleId: string,
  itemId: string,
  userId: string,
  stars: number
): Promise<void> {
  const { db } = getFirebaseServices();
  const normalizedStars = Math.max(1, Math.min(5, Math.round(stars)));

  await updateDoc(doc(db, "couples", coupleId, "theaterItems", itemId), {
    [`ratings.${userId}`]: {
      stars: normalizedStars,
      updatedAt: serverTimestamp(),
      userName: getUserDisplayName(userId)
    },
    updatedAt: serverTimestamp()
  });
}

export async function deleteTheaterItem(coupleId: string, itemId: string): Promise<void> {
  const { db } = getFirebaseServices();
  const itemRef = doc(db, "couples", coupleId, "theaterItems", itemId);
  const commentsSnapshot = await getDocs(collection(itemRef, "comments"));
  const batch = writeBatch(db);

  commentsSnapshot.docs.forEach((commentDoc) => batch.delete(commentDoc.ref));
  batch.delete(itemRef);
  await batch.commit();
}

export async function addTheaterComment(
  coupleId: string,
  itemId: string,
  userId: string,
  text: string
): Promise<void> {
  const { db } = getFirebaseServices();
  const itemRef = doc(db, "couples", coupleId, "theaterItems", itemId);
  const commentRef = doc(collection(itemRef, "comments"));

  await runTransaction(db, async (transaction) => {
    const itemSnapshot = await transaction.get(itemRef);
    const commentsCount =
      typeof itemSnapshot.data()?.commentsCount === "number"
        ? (itemSnapshot.data()?.commentsCount as number)
        : 0;

    transaction.set(commentRef, {
      id: commentRef.id,
      uid: userId,
      userName: getUserDisplayName(userId),
      text: text.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.update(itemRef, {
      commentsCount: commentsCount + 1,
      updatedAt: serverTimestamp()
    });
  });
}

export async function deleteTheaterComment(
  coupleId: string,
  itemId: string,
  commentId: string
): Promise<void> {
  const { db } = getFirebaseServices();
  const itemRef = doc(db, "couples", coupleId, "theaterItems", itemId);
  const commentRef = doc(itemRef, "comments", commentId);

  await runTransaction(db, async (transaction) => {
    const itemSnapshot = await transaction.get(itemRef);
    const commentsCount =
      typeof itemSnapshot.data()?.commentsCount === "number"
        ? (itemSnapshot.data()?.commentsCount as number)
        : 0;

    transaction.delete(commentRef);
    transaction.update(itemRef, {
      commentsCount: Math.max(0, commentsCount - 1),
      updatedAt: serverTimestamp()
    });
  });
}

export async function markTheaterPresent(coupleId: string, userId: string): Promise<void> {
  const { db } = getFirebaseServices();
  const sessionRef = doc(db, "couples", coupleId, "theaterSession", "current");

  await setDoc(
    sessionRef,
    {
      active: true,
      presentUsers: {
        [userId]: {
          name: getUserDisplayName(userId),
          joinedAt: serverTimestamp(),
          lastSeenAt: Date.now()
        }
      },
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function leaveTheater(coupleId: string, userId: string): Promise<void> {
  const { db } = getFirebaseServices();
  const sessionRef = doc(db, "couples", coupleId, "theaterSession", "current");

  await updateDoc(sessionRef, {
    [`presentUsers.${userId}`]: deleteField(),
    updatedAt: serverTimestamp()
  });
}

export async function setTheaterReady(
  coupleId: string,
  userId: string,
  ready: boolean
): Promise<void> {
  const { db } = getFirebaseServices();
  const sessionRef = doc(db, "couples", coupleId, "theaterSession", "current");

  await setDoc(
    sessionRef,
    {
      active: true,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  await updateDoc(sessionRef, {
    [`readyUsers.${userId}`]: {
      name: getUserDisplayName(userId),
      ready,
      readyAt: ready ? serverTimestamp() : null
    },
    updatedAt: serverTimestamp()
  });
}

export async function startTheaterCountdown(
  coupleId: string,
  userId: string,
  durationSeconds = 3
): Promise<void> {
  const { db } = getFirebaseServices();
  const sessionRef = doc(db, "couples", coupleId, "theaterSession", "current");

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(sessionRef);
    const currentState = snapshot.data()?.countdownState;

    if (currentState === "counting") {
      return;
    }

    transaction.set(
      sessionRef,
      {
        active: true,
        countdownState: "counting",
        countdownStartedAt: serverTimestamp(),
        countdownStartedAtMs: Date.now(),
        countdownStartedByUid: userId,
        countdownStartedByName: getUserDisplayName(userId),
        countdownDurationSeconds: durationSeconds,
        playAt: Timestamp.fromMillis(Date.now() + durationSeconds * 1000),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });
}

export async function resetTheaterCountdown(coupleId: string): Promise<void> {
  const { db } = getFirebaseServices();
  const sessionRef = doc(db, "couples", coupleId, "theaterSession", "current");

  await updateDoc(sessionRef, {
    countdownState: "idle",
    countdownStartedAt: null,
    countdownStartedAtMs: null,
    countdownStartedByUid: "",
    countdownStartedByName: "",
    playAt: null,
    updatedAt: serverTimestamp()
  });
}

export function getActivePresence(
  session: TheaterSession,
  thresholdMs = 30000,
  now = Date.now()
): Record<string, TheaterPresence> {
  return Object.fromEntries(
    Object.entries(session.presentUsers).filter(
      ([, presence]) => presence.lastSeenAt && now - presence.lastSeenAt <= thresholdMs
    )
  );
}

export function getMissingTheaterNames(activePresence: Record<string, TheaterPresence>): string[] {
  return coupleUsers.allowedUserIds
    .filter((uid) => !activePresence[uid])
    .map((uid) => getUserDisplayName(uid));
}

function mapTheaterItemDoc(id: string, data: Record<string, unknown>): TheaterItem {
  const addedByUid = typeof data.addedByUid === "string" ? data.addedByUid : "";

  return {
    id: typeof data.id === "string" ? data.id : id,
    title: typeof data.title === "string" ? data.title : "",
    type: isTheaterItemType(data.type) ? data.type : "movie",
    status: isTheaterStatus(data.status) ? data.status : "want_to_watch",
    addedByUid,
    addedByName:
      typeof data.addedByName === "string" && data.addedByName
        ? data.addedByName
        : getUserDisplayName(addedByUid),
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt),
    posterUrl: typeof data.posterUrl === "string" ? data.posterUrl : "",
    platform: typeof data.platform === "string" ? data.platform : "",
    genre: typeof data.genre === "string" ? data.genre : "",
    notes: typeof data.notes === "string" ? data.notes : "",
    ratings: mapRatings(data.ratings),
    commentsCount: typeof data.commentsCount === "number" ? data.commentsCount : 0
  };
}

function mapCommentDoc(id: string, data: Record<string, unknown>): TheaterComment {
  const uid = typeof data.uid === "string" ? data.uid : "";

  return {
    id: typeof data.id === "string" ? data.id : id,
    uid,
    userName:
      typeof data.userName === "string" && data.userName ? data.userName : getUserDisplayName(uid),
    text: typeof data.text === "string" ? data.text : "",
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapTheaterSessionDoc(data: Record<string, unknown>): TheaterSession {
  return {
    active: Boolean(data.active),
    presentUsers: mapPresence(data.presentUsers),
    readyUsers: mapReadiness(data.readyUsers),
    selectedItemId: typeof data.selectedItemId === "string" ? data.selectedItemId : "",
    countdownState: isCountdownState(data.countdownState) ? data.countdownState : "idle",
    countdownStartedAt: stringifyTimestamp(data.countdownStartedAt),
    countdownStartedAtMs: getMillis(data.countdownStartedAt) ?? getNumber(data.countdownStartedAtMs),
    countdownStartedByUid:
      typeof data.countdownStartedByUid === "string" ? data.countdownStartedByUid : "",
    countdownStartedByName:
      typeof data.countdownStartedByName === "string" ? data.countdownStartedByName : "",
    countdownDurationSeconds:
      typeof data.countdownDurationSeconds === "number" ? data.countdownDurationSeconds : 3,
    playAt: stringifyTimestamp(data.playAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapPresence(value: unknown): Record<string, TheaterPresence> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Record<string, unknown>>).map(([uid, presence]) => [
      uid,
      {
        name:
          typeof presence.name === "string" && presence.name
            ? presence.name
            : getUserDisplayName(uid),
        joinedAt: stringifyTimestamp(presence.joinedAt),
        lastSeenAt: getNumber(presence.lastSeenAt) ?? getMillis(presence.lastSeenAt) ?? 0
      }
    ])
  );
}

function mapReadiness(value: unknown): Record<string, TheaterReadiness> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Record<string, unknown>>).map(([uid, readiness]) => [
      uid,
      {
        name:
          typeof readiness.name === "string" && readiness.name
            ? readiness.name
            : getUserDisplayName(uid),
        ready: Boolean(readiness.ready),
        readyAt: stringifyTimestamp(readiness.readyAt)
      }
    ])
  );
}

function mapRatings(value: unknown): Record<string, TheaterRating> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Record<string, unknown>>).map(([uid, rating]) => [
      uid,
      {
        stars: typeof rating.stars === "number" ? rating.stars : 0,
        updatedAt: stringifyTimestamp(rating.updatedAt),
        userName:
          typeof rating.userName === "string" && rating.userName
            ? rating.userName
            : getUserDisplayName(uid)
      }
    ])
  );
}

function isTheaterItemType(value: unknown): value is TheaterItemType {
  return typeof value === "string" && theaterItemTypes.includes(value as TheaterItemType);
}

function isTheaterStatus(value: unknown): value is TheaterStatus {
  return typeof value === "string" && theaterStatuses.includes(value as TheaterStatus);
}

function isCountdownState(value: unknown): value is TheaterSession["countdownState"] {
  return value === "idle" || value === "counting" || value === "finished";
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getMillis(value: unknown): number | null {
  if (value && typeof (value as Timestamp).toMillis === "function") {
    return (value as Timestamp).toMillis();
  }

  return null;
}

function stringifyTimestamp(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }

  return "";
}
