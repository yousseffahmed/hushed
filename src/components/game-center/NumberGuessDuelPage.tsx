"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { coupleConfig } from "@/lib/coupleConfig";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  createNumberGuessRound,
  isFourDigitNumber,
  joinNumberGuessRound,
  setNumberGuessSecret,
  submitNumberGuess,
  subscribeToActiveNumberGuessRound,
  subscribeToNumberGuessScores,
  subscribeToOwnSecret,
  subscribeToRoundGuesses,
  type NumberGuessGuess,
  type NumberGuessRound,
  type NumberGuessScore,
  type NumberGuessSecret
} from "@/lib/numberGuessDuel";

export function NumberGuessDuelPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [round, setRound] = useState<NumberGuessRound | null>(null);
  const [guesses, setGuesses] = useState<NumberGuessGuess[]>([]);
  const [scores, setScores] = useState<NumberGuessScore[]>([]);
  const [ownSecret, setOwnSecret] = useState<NumberGuessSecret | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [isGuessOpen, setIsGuessOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Loading the duel...");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setSyncStatus("");
      setErrorMessage("Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* environment variables to enable Game Center.");
      return;
    }

    let unsubscribeRound: (() => void) | undefined;
    let unsubscribeScores: (() => void) | undefined;
    const { auth } = getFirebaseServices();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (!user) {
        setRound(null);
        setGuesses([]);
        setScores([]);
        setOwnSecret(null);
        setSyncStatus("");
        setErrorMessage("Sign in with one of the two allowed accounts to play.");
        unsubscribeRound?.();
        unsubscribeScores?.();
        return;
      }

      setErrorMessage("");
      setSyncStatus("Syncing duel...");
      unsubscribeRound?.();
      unsubscribeScores?.();
      unsubscribeRound = subscribeToActiveNumberGuessRound(
        coupleConfig.coupleId,
        (nextRound) => {
          setRound(nextRound);
          setSyncStatus("Duel synced");
        },
        (error) => {
          setSyncStatus("");
          setErrorMessage(getFriendlyError(error));
        }
      );
      unsubscribeScores = subscribeToNumberGuessScores(
        coupleConfig.coupleId,
        setScores,
        (error) => setErrorMessage(getFriendlyError(error))
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRound?.();
      unsubscribeScores?.();
    };
  }, []);

  useEffect(() => {
    if (!round) {
      setGuesses([]);
      return;
    }

    return subscribeToRoundGuesses(
      coupleConfig.coupleId,
      round.id,
      setGuesses,
      (error) => setErrorMessage(getFriendlyError(error))
    );
  }, [round]);

  useEffect(() => {
    if (!currentUser || !round) {
      setOwnSecret(null);
      return;
    }

    return subscribeToOwnSecret(
      coupleConfig.coupleId,
      round.id,
      currentUser.uid,
      (secret) => {
        setOwnSecret(secret);
        setSecretInput(secret?.secretNumber ?? "");
      },
      (error) => setErrorMessage(getFriendlyError(error))
    );
  }, [currentUser, round]);

  const opponentUid = useMemo(
    () => (currentUser ? coupleUsers.allowedUserIds.find((uid) => uid !== currentUser.uid) ?? "" : ""),
    [currentUser]
  );
  const currentPlayer = currentUser && round ? round.players[currentUser.uid] : null;
  const opponentPlayer = round && opponentUid ? round.players[opponentUid] : null;
  const bothJoined = Boolean(currentPlayer && opponentPlayer);
  const bothReady = Boolean(currentPlayer?.ready && opponentPlayer?.ready);
  const isMyTurn = Boolean(currentUser && round?.currentTurnUid === currentUser.uid);
  const canGuess =
    Boolean(currentUser && round && ownSecret && bothReady) &&
    round?.status === "in_progress" &&
    isMyTurn;
  const roundMessage = getRoundMessage(round, currentUser?.uid ?? "", opponentUid);
  const scoreMap = useMemo(() => makeScoreMap(scores), [scores]);
  const winnerGuess = round?.winnerUid
    ? guesses.find((guess) => guess.isWinningGuess && guess.guessedByUid === round.winnerUid)
    : null;

  async function handleCreateRound() {
    if (!currentUser) {
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createNumberGuessRound(coupleConfig.coupleId, currentUser.uid);
      setSuccessMessage("New duel created.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleJoinRound() {
    if (!currentUser || !round) {
      return;
    }

    setIsBusy(true);
    setErrorMessage("");

    try {
      await joinNumberGuessRound(coupleConfig.coupleId, round, currentUser.uid);
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveSecret() {
    if (!currentUser || !round) {
      return;
    }

    if (!isFourDigitNumber(secretInput)) {
      setErrorMessage("Your secret must be exactly 4 digits. Leading zero is allowed.");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");

    try {
      await setNumberGuessSecret(coupleConfig.coupleId, round.id, currentUser.uid, secretInput);
      setSuccessMessage("Secret saved. No hints, no mercy.");
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmitGuess(guess: string) {
    if (!round || !canGuess || !isFourDigitNumber(guess)) {
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await submitNumberGuess(coupleConfig.coupleId, round.id, guess);
      setIsGuessOpen(false);
      setSuccessMessage(
        result.isWinningGuess
          ? `${formatRightCount(result.rightCount)} — cracked it!`
          : formatRightCount(result.rightCount)
      );
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (!currentUser) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/game-center")}
            className="mb-5 rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
          >
            ← Back
          </button>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
            Number Guess Duel
          </p>
          <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.98] text-rose-950">
            Sign in to play
          </h1>
          {errorMessage ? (
            <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
              {errorMessage}
            </p>
          ) : null}
        </header>
        <AuthCard variant="screen" onError={setErrorMessage} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/game-center")}
          className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
        >
          ← Back
        </button>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
          yushef games
        </p>
      </header>

      <section className="rounded-[2rem] bg-rose-950 px-5 py-6 text-rose-50 shadow-[0_22px_52px_rgba(67,42,45,0.24)]">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-rose-50/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 ring-1 ring-rose-100/20">
            2-player duel
          </span>
          <span className="rounded-full bg-rose-50/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100 ring-1 ring-rose-100/20">
            No hints
          </span>
        </div>
        <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.95]">
          Number Guess Duel
        </h1>
        <p className="mt-4 text-sm leading-6 text-rose-100">
          Crack the secret 4-digit code before your love does.
        </p>
      </section>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-medium leading-6 text-rose-700 ring-1 ring-rose-100">
          {successMessage}
        </p>
      ) : null}
      {syncStatus ? <p className="mt-3 text-sm font-medium text-rose-500">{syncStatus}</p> : null}

      <Scoreboard scores={scores} />
      <HowToPlayCard />

      <section className="mt-5 rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
              Game arena
            </p>
            <h2 className="mt-1 font-[var(--font-display)] text-3xl text-rose-950">
              {round ? roundMessage : "No duel yet"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCreateRound}
            disabled={isBusy}
            className="rounded-full bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/15 disabled:opacity-60"
          >
            Rematch
          </button>
        </div>

        {!round ? (
          <button
            type="button"
            onClick={handleCreateRound}
            disabled={isBusy}
            className="mt-5 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:opacity-60"
          >
            Create a duel
          </button>
        ) : null}

        {round && !currentPlayer ? (
          <button
            type="button"
            onClick={handleJoinRound}
            disabled={isBusy}
            className="mt-5 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:opacity-60"
          >
            Join this duel
          </button>
        ) : null}

        {round ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {coupleUsers.allowedUserIds.map((uid) => {
              const player = round.players[uid];
              const score = scoreMap[uid];
              return (
                <PlayerStatusCard
                  key={uid}
                  attempts={player?.attempts ?? 0}
                  isCurrentTurn={round.currentTurnUid === uid && round.status === "in_progress"}
                  isJoined={Boolean(player)}
                  isReady={Boolean(player?.ready)}
                  name={getUserDisplayName(uid)}
                  wins={score?.wins ?? 0}
                />
              );
            })}
          </div>
        ) : null}
      </section>

      {round?.status === "finished" ? (
        <WinnerPanel
          attempts={winnerGuess?.attemptNumber ?? round.players[round.winnerUid]?.attempts ?? 0}
          winnerName={round.winnerName || getUserDisplayName(round.winnerUid)}
          onRematch={handleCreateRound}
        />
      ) : null}

      {round && currentPlayer ? (
        <section className="mt-5 rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
            Your secret
          </p>
          {ownSecret ? (
            <div className="mt-4 rounded-2xl bg-rose-50/70 px-4 py-4 ring-1 ring-rose-100">
              <p className="text-lg font-bold text-rose-950">Secret locked 🔒</p>
              <p className="mt-1 text-sm font-medium text-stone-600">Your secret: ••••</p>
            </div>
          ) : (
            <>
              <DigitInput
                label="Secret number"
                value={secretInput}
                onChange={setSecretInput}
              />
              <button
                type="button"
                onClick={handleSaveSecret}
                disabled={isBusy || !isFourDigitNumber(secretInput) || round.status === "finished"}
                className="mt-4 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Lock My Secret
              </button>
            </>
          )}
          <p className="mt-3 text-xs font-medium leading-5 text-stone-500">
            Once the duel starts, secrets stay locked. Guesses are checked by a Cloud Function.
          </p>
        </section>
      ) : null}

      {round && currentPlayer ? (
        <section className="mt-5 rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
            Your turn
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-rose-950">
            {roundMessage}
          </h2>
          <button
            type="button"
            onClick={() => setIsGuessOpen(true)}
            disabled={isBusy || !canGuess}
            className="mt-4 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {round.status === "finished"
              ? "Round finished"
              : !bothReady
                ? `Waiting for ${getWaitingSecretName(round, currentUser.uid)}`
                : isMyTurn
                  ? `Guess ${getUserDisplayName(opponentUid)}’s Number`
                  : `Waiting for ${getUserDisplayName(round.currentTurnUid)}`}
          </button>
          {!bothReady ? (
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Both players need to lock a secret before guessing starts.
            </p>
          ) : null}
        </section>
      ) : null}

      <GuessHistory guesses={guesses} />

      {isGuessOpen && round ? (
        <GuessModal
          isBusy={isBusy}
          opponentName={getUserDisplayName(opponentUid)}
          onCancel={() => {
            if (!isBusy) {
              setIsGuessOpen(false);
            }
          }}
          onSubmit={handleSubmitGuess}
        />
      ) : null}
    </main>
  );
}

function DigitInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const digits = value.padEnd(4, " ").slice(0, 4).split("");

  return (
    <label className="mt-4 block">
      <span className="sr-only">{label}</span>
      <input
        className="sr-only"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
      />
      <div className="grid grid-cols-4 gap-2" aria-hidden="true">
        {digits.map((digit, index) => (
          <span
            key={index}
            className="flex aspect-square items-center justify-center rounded-2xl bg-rose-50 text-3xl font-black text-rose-950 ring-1 ring-rose-100"
          >
            {digit.trim() || "•"}
          </span>
        ))}
      </div>
    </label>
  );
}

function Scoreboard({ scores }: { scores: NumberGuessScore[] }) {
  const scoreMap = makeScoreMap(scores);
  const shoshoScore = scoreMap[coupleUsers.allowedUserIds[0]];
  const yuyuScore = scoreMap[coupleUsers.allowedUserIds[1]];
  const shoshoWins = shoshoScore?.wins ?? 0;
  const yuyuWins = yuyuScore?.wins ?? 0;
  const roundsPlayed = Math.max(shoshoScore?.roundsPlayed ?? 0, yuyuScore?.roundsPlayed ?? 0);
  const champion =
    shoshoWins === yuyuWins
      ? "Tied"
      : shoshoWins > yuyuWins
        ? getUserDisplayName(coupleUsers.allowedUserIds[0])
        : getUserDisplayName(coupleUsers.allowedUserIds[1]);

  return (
    <section className="mt-5 rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
        Scoreboard
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {coupleUsers.allowedUserIds.map((uid) => {
          const score = scoreMap[uid];
          return (
            <div key={uid} className="rounded-2xl bg-rose-50/70 px-4 py-4 ring-1 ring-rose-100">
              <p className="text-sm font-semibold text-rose-950">{getUserDisplayName(uid)}</p>
              <p className="mt-2 text-3xl font-black text-rose-950">{score?.wins ?? 0}</p>
              <p className="mt-1 text-xs font-medium text-stone-500">
                wins
              </p>
              <p className="mt-2 text-xs font-medium text-stone-500">
                {score?.bestWinAttempts
                  ? `Fastest win: ${score.bestWinAttempts} guesses`
                  : "No wins yet"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-2xl bg-white/70 px-4 py-4 text-sm leading-6 text-stone-600 ring-1 ring-rose-100">
        <p>
          <span className="font-semibold text-rose-950">Rounds played:</span> {roundsPlayed}
        </p>
        <p>
          <span className="font-semibold text-rose-950">Current champion:</span> {champion}
        </p>
      </div>
    </section>
  );
}

function HowToPlayCard() {
  return (
    <details className="mt-5 rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
        How to play
      </summary>
      <div className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
        <p>Each of us secretly chooses a 4-digit number.</p>
        <p>Take turns guessing the other person’s number.</p>
        <p>You only see how many digits are correct. You will not know which digits or where they are.</p>
        <p>Positions do not matter, and repeated digits are counted fairly.</p>
        <p className="rounded-2xl bg-rose-50/70 px-4 py-3 ring-1 ring-rose-100">
          Example: Secret 3452, guess 3333, result 1 right.
        </p>
        <p className="font-semibold text-rose-700">First one to get 4 right wins.</p>
      </div>
    </details>
  );
}

function PlayerStatusCard({
  attempts,
  isCurrentTurn,
  isJoined,
  isReady,
  name,
  wins
}: {
  attempts: number;
  isCurrentTurn: boolean;
  isJoined: boolean;
  isReady: boolean;
  name: string;
  wins: number;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-4 ring-1 transition ${
        isCurrentTurn
          ? "bg-rose-950 text-rose-50 ring-rose-950 shadow-lg shadow-rose-950/20"
          : isReady
            ? "bg-rose-100/80 text-rose-950 ring-rose-100"
            : "bg-rose-50/70 text-rose-700 ring-rose-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{name}</p>
        {isCurrentTurn ? (
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-100" />
        ) : null}
      </div>
      <p className="mt-1 text-xs font-medium opacity-80">
        {!isJoined ? "not joined" : isReady ? "secret locked" : "choosing secret"}
      </p>
      <p className="mt-2 text-xs font-medium opacity-80">{attempts} guesses</p>
      <p className="mt-1 text-xs font-medium opacity-80">{wins} wins</p>
    </div>
  );
}

function WinnerPanel({
  attempts,
  winnerName,
  onRematch
}: {
  attempts: number;
  winnerName: string;
  onRematch: () => void;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-[2rem] bg-rose-950 px-5 py-6 text-center text-rose-50 shadow-[0_22px_52px_rgba(67,42,45,0.24)]">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-4xl text-rose-950 shadow-inner">
        ★
      </div>
      <h2 className="mt-4 font-[var(--font-display)] text-4xl leading-tight">
        {winnerName} cracked the code!
      </h2>
      <p className="mt-3 text-sm leading-6 text-rose-100">
        Won in {attempts || "a few"} guess{attempts === 1 ? "" : "es"}. The arena demands a rematch.
      </p>
      <button
        type="button"
        onClick={onRematch}
        className="mt-5 w-full rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-950/25"
      >
        Rematch
      </button>
    </section>
  );
}

function GuessModal({
  isBusy,
  opponentName,
  onCancel,
  onSubmit
}: {
  isBusy: boolean;
  opponentName: string;
  onCancel: () => void;
  onSubmit: (guess: string) => void;
}) {
  const [guess, setGuess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isValid = isFourDigitNumber(guess);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!isValid) {
      return;
    }

    onSubmit(guess);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100"
      >
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Make your move
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Guess {opponentName}’s secret
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Type exactly 4 digits. Leading zero is allowed.
        </p>
        <DigitInput label="Guess" value={guess} onChange={setGuess} />
        {submitted && !isValid ? (
          <p className="mt-3 text-sm font-medium text-rose-700">
            Enter exactly 4 numeric digits.
          </p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="flex-1 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isBusy || !isValid}
            className="flex-1 rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Checking..." : "Submit Guess"}
          </button>
        </div>
      </form>
    </div>
  );
}

function GuessHistory({ guesses }: { guesses: NumberGuessGuess[] }) {
  return (
    <section className="mt-5 rounded-[2rem] bg-white/82 px-5 py-5 shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
        Guess history
      </p>
      <div className="mt-4 space-y-3">
        {guesses.length > 0 ? (
          [...guesses].reverse().map((guess) => (
            <article
              key={guess.id}
              className="rounded-2xl bg-rose-50/70 px-4 py-4 ring-1 ring-rose-100"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-rose-950">
                  {guess.guessedByName} guessed {guess.guess}
                </p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
                  {formatRightCount(guess.rightCount)}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-stone-500">
                Against {guess.targetName} · attempt {guess.attemptNumber}
                {guess.isWinningGuess ? " · cracked it!" : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-2xl bg-rose-50/70 px-4 py-4 text-center text-sm font-medium leading-6 text-stone-600 ring-1 ring-rose-100">
            No guesses yet. The mind games have not started.
          </p>
        )}
      </div>
    </section>
  );
}

function makeScoreMap(scores: NumberGuessScore[]): Record<string, NumberGuessScore> {
  return Object.fromEntries(scores.map((score) => [score.uid, score]));
}

function getRoundMessage(
  round: NumberGuessRound | null,
  currentUserId: string,
  opponentUid: string
): string {
  if (!round) {
    return "No duel yet";
  }

  if (round.status === "finished") {
    return `${round.winnerName || getUserDisplayName(round.winnerUid)} won!`;
  }

  const currentPlayer = round.players[currentUserId];
  const opponentPlayer = round.players[opponentUid];

  if (!currentPlayer) {
    return "Join the duel";
  }

  if (!opponentPlayer) {
    return `Waiting for ${getUserDisplayName(opponentUid)} to join`;
  }

  if (!currentPlayer.ready) {
    return "Choose your secret";
  }

  if (!opponentPlayer.ready) {
    return `${getUserDisplayName(opponentUid)} is choosing a secret`;
  }

  if (round.status === "in_progress") {
    return round.currentTurnUid === currentUserId
      ? "Your turn"
      : `${getUserDisplayName(round.currentTurnUid)} is thinking...`;
  }

  return "Game started";
}

function getWaitingSecretName(round: NumberGuessRound, currentUserId: string): string {
  const waitingUid = coupleUsers.allowedUserIds.find((uid) => !round.players[uid]?.ready);

  if (!waitingUid) {
    return "the game";
  }

  return waitingUid === currentUserId ? "you to lock secret" : `${getUserDisplayName(waitingUid)} to lock secret`;
}

function formatRightCount(count: number): string {
  switch (count) {
    case 0:
      return "No digits matched";
    case 1:
      return "1 digit matched";
    case 4:
      return "4 digits matched — cracked it!";
    default:
      return `${count} digits matched`;
  }
}

function formatStatus(status: NumberGuessRound["status"]): string {
  switch (status) {
    case "waiting_for_players":
      return "Waiting for players";
    case "setting_secrets":
      return "Setting secrets";
    case "in_progress":
      return "In progress";
    case "finished":
      return "Finished";
  }
}

function getFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Firebase permissions blocked the game. Check Firestore rules and make sure both users are allowed.";
  }

  if (message.includes("functions")) {
    return message;
  }

  return message || "Something went wrong in Number Guess Duel.";
}
