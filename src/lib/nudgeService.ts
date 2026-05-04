import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe
} from "firebase/firestore";
import { coupleConfig } from "@/lib/coupleConfig";
import { getFirebaseServices } from "@/lib/firebase";

export type NudgeType = "preset" | "custom";

export type Nudge = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  type: NudgeType;
  createdAt: string;
  clientCreatedAtMs: number | null;
  readAt: string | null;
  delivered: boolean;
  notificationSentAt: string | null;
};

export type CreateNudgeInput = {
  fromUserId: string;
  message: string;
  type: NudgeType;
};

export function getPartnerUserId(currentUserId: string): string | null {
  return coupleConfig.allowedUserIds.find((userId) => userId !== currentUserId) ?? null;
}

export async function sendNudge(coupleId: string, input: CreateNudgeInput): Promise<string> {
  const { db } = getFirebaseServices();
  const toUserId = getPartnerUserId(input.fromUserId);

  if (!toUserId) {
    throw new Error("Could not find the other allowed user for this nudge.");
  }

  const nudgeRef = doc(collection(db, "couples", coupleId, "nudges"));
  const clientCreatedAtMs = Date.now();
  const message = input.message.trim();

  if (process.env.NODE_ENV === "development") {
    console.debug("[Nudges] creating nudge", {
      nudgeId: nudgeRef.id,
      fromUserId: input.fromUserId,
      toUserId,
      clientCreatedAtMs,
      messageType: input.type
    });
  }

  await setDoc(nudgeRef, {
    id: nudgeRef.id,
    fromUserId: input.fromUserId,
    toUserId,
    message,
    type: input.type,
    createdAt: serverTimestamp(),
    clientCreatedAtMs,
    readAt: null,
    delivered: false,
    notificationSentAt: null
  });

  if (process.env.NODE_ENV === "development") {
    console.debug("[Nudges] nudge created", {
      nudgeId: nudgeRef.id,
      fromUserId: input.fromUserId,
      toUserId
    });
  }

  return nudgeRef.id;
}

export function subscribeToRecentNudges(
  coupleId: string,
  callback: (nudges: Nudge[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const nudgesQuery = query(
    collection(db, "couples", coupleId, "nudges"),
    orderBy("createdAt", "desc"),
    limit(5)
  );

  return onSnapshot(
    nudgesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((nudgeDoc) => mapNudgeDoc(nudgeDoc.id, nudgeDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export async function markReceivedNudgesRead(
  coupleId: string,
  nudges: Nudge[],
  currentUserId: string
): Promise<void> {
  const { db } = getFirebaseServices();
  const unreadReceived = nudges.filter(
    (nudge) => nudge.toUserId === currentUserId && !nudge.readAt
  );

  await Promise.all(
    unreadReceived.map((nudge) =>
      updateDoc(doc(db, "couples", coupleId, "nudges", nudge.id), {
        readAt: serverTimestamp()
      })
    )
  );
}

function mapNudgeDoc(id: string, data: Record<string, unknown>): Nudge {
  return {
    id: typeof data.id === "string" ? data.id : id,
    fromUserId: typeof data.fromUserId === "string" ? data.fromUserId : "",
    toUserId: typeof data.toUserId === "string" ? data.toUserId : "",
    message: typeof data.message === "string" ? data.message : "",
    type: data.type === "custom" ? "custom" : "preset",
    createdAt: stringifyTimestamp(data.createdAt),
    clientCreatedAtMs: typeof data.clientCreatedAtMs === "number" ? data.clientCreatedAtMs : null,
    readAt: data.readAt ? stringifyTimestamp(data.readAt) : null,
    delivered: Boolean(data.delivered),
    notificationSentAt: data.notificationSentAt ? stringifyTimestamp(data.notificationSentAt) : null
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
