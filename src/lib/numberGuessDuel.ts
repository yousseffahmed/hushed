import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
  type Unsubscribe
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices } from "@/lib/firebase";

export type NumberGuessRoundStatus =
  | "waiting_for_players"
  | "setting_secrets"
  | "in_progress"
  | "finished";

export type NumberGuessPlayer = {
  name: string;
  joinedAt: string;
  ready: boolean;
  attempts: number;
};

export type NumberGuessRound = {
  id: string;
  status: NumberGuessRoundStatus;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
  winnerUid: string;
  winnerName: string;
  currentTurnUid: string;
  players: Record<string, NumberGuessPlayer>;
  scoreAwarded: boolean;
};

export type NumberGuessSecret = {
  uid: string;
  secretNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type NumberGuessGuess = {
  id: string;
  guessedByUid: string;
  guessedByName: string;
  targetUid: string;
  targetName: string;
  guess: string;
  rightCount: number;
  createdAt: string;
  attemptNumber: number;
  isWinningGuess: boolean;
};

export type NumberGuessScore = {
  uid: string;
  name: string;
  wins: number;
  losses: number;
  roundsPlayed: number;
  totalGuesses: number;
  bestWinAttempts: number | null;
  updatedAt: string;
};

export type SubmitGuessResult = {
  rightCount: number;
  isWinningGuess: boolean;
  nextTurnUid: string;
};

export function isFourDigitNumber(value: string): boolean {
  return /^\d{4}$/.test(value);
}

export function subscribeToActiveNumberGuessRound(
  coupleId: string,
  callback: (round: NumberGuessRound | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const roundsQuery = query(
    collection(db, "couples", coupleId, "games", "numberGuessDuel", "rounds"),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  return onSnapshot(
    roundsQuery,
    (snapshot) => {
      const roundDoc = snapshot.docs[0];
      callback(roundDoc ? mapRoundDoc(roundDoc.id, roundDoc.data()) : null);
    },
    (error) => onError?.(error)
  );
}

export function subscribeToRoundGuesses(
  coupleId: string,
  roundId: string,
  callback: (guesses: NumberGuessGuess[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const guessesQuery = query(
    collection(db, "couples", coupleId, "games", "numberGuessDuel", "rounds", roundId, "guesses"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    guessesQuery,
    (snapshot) => {
      callback(snapshot.docs.map((guessDoc) => mapGuessDoc(guessDoc.id, guessDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToOwnSecret(
  coupleId: string,
  roundId: string,
  userId: string,
  callback: (secret: NumberGuessSecret | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();
  const secretRef = doc(
    db,
    "couples",
    coupleId,
    "games",
    "numberGuessDuel",
    "rounds",
    roundId,
    "secrets",
    userId
  );

  return onSnapshot(
    secretRef,
    (snapshot) => {
      callback(snapshot.exists() ? mapSecretDoc(snapshot.id, snapshot.data()) : null);
    },
    (error) => onError?.(error)
  );
}

export function subscribeToNumberGuessScores(
  coupleId: string,
  callback: (scores: NumberGuessScore[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebaseServices();

  return onSnapshot(
    collection(db, "couples", coupleId, "games", "numberGuessDuel", "scores"),
    (snapshot) => {
      callback(snapshot.docs.map((scoreDoc) => mapScoreDoc(scoreDoc.id, scoreDoc.data())));
    },
    (error) => onError?.(error)
  );
}

export async function createNumberGuessRound(coupleId: string, userId: string): Promise<string> {
  const { db } = getFirebaseServices();
  const roundRef = doc(collection(db, "couples", coupleId, "games", "numberGuessDuel", "rounds"));

  await setDoc(roundRef, {
    id: roundRef.id,
    status: "waiting_for_players",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: userId,
    winnerUid: "",
    winnerName: "",
    currentTurnUid: "",
    players: {
      [userId]: {
        name: getUserDisplayName(userId),
        joinedAt: serverTimestamp(),
        ready: false,
        attempts: 0
      }
    },
    scoreAwarded: false
  });

  return roundRef.id;
}

export async function joinNumberGuessRound(
  coupleId: string,
  round: NumberGuessRound,
  userId: string
): Promise<void> {
  const { db } = getFirebaseServices();
  const roundRef = getRoundRef(db, coupleId, round.id);
  const nextPlayerCount = new Set([...Object.keys(round.players), userId]).size;

  await updateDoc(roundRef, {
    [`players.${userId}`]: {
      name: getUserDisplayName(userId),
      joinedAt: serverTimestamp(),
      ready: false,
      attempts: 0
    },
    status: nextPlayerCount >= 2 ? "setting_secrets" : "waiting_for_players",
    updatedAt: serverTimestamp()
  });
}

export async function setNumberGuessSecret(
  coupleId: string,
  roundId: string,
  userId: string,
  secretNumber: string
): Promise<void> {
  const { db } = getFirebaseServices();
  const roundRef = getRoundRef(db, coupleId, roundId);
  const secretRef = doc(roundRef, "secrets", userId);

  await runTransaction(db, async (transaction) => {
    const roundSnapshot = await transaction.get(roundRef);
    const round = roundSnapshot.exists()
      ? mapRoundDoc(roundSnapshot.id, roundSnapshot.data())
      : null;

    if (!round) {
      throw new Error("Round not found.");
    }

    const nextPlayers = {
      ...round.players,
      [userId]: {
        ...(round.players[userId] ?? {
          name: getUserDisplayName(userId),
          joinedAt: "",
          attempts: 0
        }),
        ready: true,
        name: getUserDisplayName(userId)
      }
    };
    const allPlayersJoined = coupleUsers.allowedUserIds.every((uid) => nextPlayers[uid]);
    const allReady = coupleUsers.allowedUserIds.every((uid) => nextPlayers[uid]?.ready);

    transaction.set(secretRef, {
      uid: userId,
      secretNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.update(roundRef, {
      [`players.${userId}.ready`]: true,
      [`players.${userId}.name`]: getUserDisplayName(userId),
      status: allPlayersJoined && allReady ? "in_progress" : "setting_secrets",
      currentTurnUid: allPlayersJoined && allReady ? round.createdByUid : round.currentTurnUid,
      updatedAt: serverTimestamp()
    });
  });
}

export async function submitNumberGuess(
  coupleId: string,
  roundId: string,
  guess: string
): Promise<SubmitGuessResult> {
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { coupleId: string; roundId: string; guess: string },
    SubmitGuessResult
  >(functions, "submitNumberGuess");
  const result = await callable({ coupleId, roundId, guess });

  return result.data;
}

function getRoundRef(db: ReturnType<typeof getFirebaseServices>["db"], coupleId: string, roundId: string) {
  return doc(db, "couples", coupleId, "games", "numberGuessDuel", "rounds", roundId);
}

function mapRoundDoc(id: string, data: Record<string, unknown>): NumberGuessRound {
  return {
    id: typeof data.id === "string" ? data.id : id,
    status: isRoundStatus(data.status) ? data.status : "waiting_for_players",
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt),
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
    winnerUid: typeof data.winnerUid === "string" ? data.winnerUid : "",
    winnerName: typeof data.winnerName === "string" ? data.winnerName : "",
    currentTurnUid: typeof data.currentTurnUid === "string" ? data.currentTurnUid : "",
    players: mapPlayers(data.players),
    scoreAwarded: Boolean(data.scoreAwarded)
  };
}

function mapSecretDoc(id: string, data: Record<string, unknown>): NumberGuessSecret {
  return {
    uid: typeof data.uid === "string" ? data.uid : id,
    secretNumber: typeof data.secretNumber === "string" ? data.secretNumber : "",
    createdAt: stringifyTimestamp(data.createdAt),
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapGuessDoc(id: string, data: Record<string, unknown>): NumberGuessGuess {
  const guessedByUid = typeof data.guessedByUid === "string" ? data.guessedByUid : "";
  const targetUid = typeof data.targetUid === "string" ? data.targetUid : "";

  return {
    id: typeof data.id === "string" ? data.id : id,
    guessedByUid,
    guessedByName:
      typeof data.guessedByName === "string" && data.guessedByName
        ? data.guessedByName
        : getUserDisplayName(guessedByUid),
    targetUid,
    targetName:
      typeof data.targetName === "string" && data.targetName
        ? data.targetName
        : getUserDisplayName(targetUid),
    guess: typeof data.guess === "string" ? data.guess : "",
    rightCount: typeof data.rightCount === "number" ? data.rightCount : 0,
    createdAt: stringifyTimestamp(data.createdAt),
    attemptNumber: typeof data.attemptNumber === "number" ? data.attemptNumber : 0,
    isWinningGuess: Boolean(data.isWinningGuess)
  };
}

function mapScoreDoc(id: string, data: Record<string, unknown>): NumberGuessScore {
  return {
    uid: typeof data.uid === "string" ? data.uid : id,
    name: typeof data.name === "string" ? data.name : getUserDisplayName(id),
    wins: typeof data.wins === "number" ? data.wins : 0,
    losses: typeof data.losses === "number" ? data.losses : 0,
    roundsPlayed: typeof data.roundsPlayed === "number" ? data.roundsPlayed : 0,
    totalGuesses: typeof data.totalGuesses === "number" ? data.totalGuesses : 0,
    bestWinAttempts: typeof data.bestWinAttempts === "number" ? data.bestWinAttempts : null,
    updatedAt: stringifyTimestamp(data.updatedAt)
  };
}

function mapPlayers(value: unknown): Record<string, NumberGuessPlayer> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Record<string, unknown>>).map(([uid, player]) => [
      uid,
      {
        name:
          typeof player.name === "string" && player.name ? player.name : getUserDisplayName(uid),
        joinedAt: stringifyTimestamp(player.joinedAt),
        ready: Boolean(player.ready),
        attempts: typeof player.attempts === "number" ? player.attempts : 0
      }
    ])
  );
}

function isRoundStatus(value: unknown): value is NumberGuessRoundStatus {
  return (
    value === "waiting_for_players" ||
    value === "setting_secrets" ||
    value === "in_progress" ||
    value === "finished"
  );
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
