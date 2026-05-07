"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { coupleConfig } from "@/lib/coupleConfig";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import {
  createNumberGuessRound,
  endNumberGuessRound,
  isFourDigitNumber,
  joinNumberGuessRound,
  resetNumberGuessScores,
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
  const [isEndGameOpen, setIsEndGameOpen] = useState(false);
  const [isResetScoreOpen, setIsResetScoreOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [isResettingScore, setIsResettingScore] = useState(false);
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
          ? formatRightCount(result.rightCount)
          : formatRightCount(result.rightCount)
      );
    } catch (error) {
      setErrorMessage(getFriendlyError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResetScore() {
    setIsResettingScore(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await resetNumberGuessScores(coupleConfig.coupleId);
      setIsResetScoreOpen(false);
      setSuccessMessage("Scoreboard reset to 0-0.");
    } catch (error) {
      setErrorMessage(getScoreResetError(error));
    } finally {
      setIsResettingScore(false);
    }
  }

  async function handleEndGame() {
    if (!round || round.status !== "in_progress") {
      return;
    }

    setIsEndingGame(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await endNumberGuessRound(coupleConfig.coupleId, round.id);
      setIsEndGameOpen(false);
      setSuccessMessage("Round ended. No score was awarded.");
    } catch (error) {
      setErrorMessage(getEndGameError(error));
    } finally {
      setIsEndingGame(false);
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

      <section className="rounded-[1.75rem] bg-rose-950 px-4 py-4 text-rose-50 shadow-[0_18px_40px_rgba(67,42,45,0.22)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
          2-player duel · exact positions only
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-4xl leading-none">
          Number Guess Duel
        </h1>
        <p className="mt-2 text-sm leading-6 text-rose-100">Crack the code.</p>
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

      <Scoreboard
        isResetting={isResettingScore}
        scores={scores}
        onResetClick={() => setIsResetScoreOpen(true)}
      />

      <section className="mt-4 rounded-[1.75rem] bg-white/86 px-4 py-4 shadow-[0_16px_36px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            Game arena
          </p>
          {round ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
              {formatStatus(round.status)}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 font-[var(--font-display)] text-4xl leading-none text-rose-950">
          {round ? roundMessage : "Ready?"}
        </h2>

        {round ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
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

        {round?.status === "finished" ? (
          <WinnerPanel
            attempts={winnerGuess?.attemptNumber ?? round.players[round.winnerUid]?.attempts ?? 0}
            winnerName={round.winnerName || getUserDisplayName(round.winnerUid)}
            onRematch={handleCreateRound}
          />
        ) : null}

        {round && currentPlayer && !ownSecret ? (
          <div className="mt-4 rounded-2xl bg-rose-50/70 px-3 py-3 ring-1 ring-rose-100">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-400">
              Your secret
            </p>
            <DigitInput label="Secret number" value={secretInput} onChange={setSecretInput} />
          </div>
        ) : null}

        {round && currentPlayer && ownSecret ? (
          <p className="mt-4 rounded-2xl bg-rose-50/70 px-4 py-3 text-sm font-semibold text-rose-950 ring-1 ring-rose-100">
            Secret locked 🔒
          </p>
        ) : null}

        <GameActionButton
          bothReady={bothReady}
          canGuess={canGuess}
          currentUserId={currentUser.uid}
          isBusy={isBusy}
          isMyTurn={isMyTurn}
          opponentUid={opponentUid}
          ownSecret={ownSecret}
          round={round}
          onCreateRound={handleCreateRound}
          onJoinRound={handleJoinRound}
          onLockSecret={handleSaveSecret}
          onOpenGuess={() => setIsGuessOpen(true)}
        />
        {round?.status === "in_progress" ? (
          <button
            type="button"
            onClick={() => setIsEndGameOpen(true)}
            disabled={isEndingGame}
            className="mt-3 w-full rounded-2xl bg-white/72 px-4 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            End Game
          </button>
        ) : null}
      </section>

      <GuessHistory currentUserId={currentUser.uid} guesses={guesses} />

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

      {isResetScoreOpen ? (
        <ResetScoreModal
          isBusy={isResettingScore}
          onCancel={() => {
            if (!isResettingScore) {
              setIsResetScoreOpen(false);
            }
          }}
          onConfirm={handleResetScore}
        />
      ) : null}

      {isEndGameOpen ? (
        <EndGameModal
          isBusy={isEndingGame}
          onCancel={() => {
            if (!isEndingGame) {
              setIsEndGameOpen(false);
            }
          }}
          onConfirm={handleEndGame}
        />
      ) : null}
    </main>
  );
}

function DigitInput({
  label,
  value,
  onChange,
  autoFocus = false
}: {
  autoFocus?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(4, " ").slice(0, 4).split("");

  useEffect(() => {
    if (autoFocus) {
      window.setTimeout(() => inputRefs.current[0]?.focus(), 80);
    }
  }, [autoFocus]);

  function setDigit(index: number, nextValue: string) {
    const numeric = nextValue.replace(/\D/g, "");

    if (numeric.length > 1) {
      const pastedDigits = numeric.slice(0, 4).split("");
      onChange(pastedDigits.join(""));
      inputRefs.current[Math.min(3, pastedDigits.length - 1)]?.focus();
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = numeric || " ";
    onChange(nextDigits.join("").replace(/\s/g, ""));

    if (numeric && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  return (
    <fieldset className="mt-3">
      <legend className="sr-only">{label}</legend>
      <div className="grid grid-cols-4 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            aria-label={`${label} digit ${index + 1}`}
            className="aspect-square w-full rounded-2xl bg-rose-50 text-center text-3xl font-black text-rose-950 outline-none ring-1 ring-rose-100 transition focus:ring-2 focus:ring-rose-300"
            inputMode="numeric"
            maxLength={1}
            pattern="[0-9]*"
            type="text"
            value={digit.trim()}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index].trim() && index > 0) {
                inputRefs.current[index - 1]?.focus();
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              setDigit(index, event.clipboardData.getData("text"));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Scoreboard({ isResetting, scores, onResetClick }: {
  isResetting: boolean;
  scores: NumberGuessScore[];
  onResetClick: () => void;
}) {
  const scoreMap = makeScoreMap(scores);
  const shoshoUid = coupleUsers.allowedUserIds[0];
  const yuyuUid = coupleUsers.allowedUserIds[1];
  const shoshoScore = scoreMap[shoshoUid];
  const yuyuScore = scoreMap[yuyuUid];
  const shoshoWins = shoshoScore?.wins ?? 0;
  const yuyuWins = yuyuScore?.wins ?? 0;
  const roundsPlayed = Math.max(shoshoScore?.roundsPlayed ?? 0, yuyuScore?.roundsPlayed ?? 0);
  const champion =
    shoshoWins === 0 && yuyuWins === 0
      ? "No champion yet"
      : shoshoWins === yuyuWins
        ? "Tied"
        : shoshoWins > yuyuWins
          ? getUserDisplayName(shoshoUid)
          : getUserDisplayName(yuyuUid);
  const fastestWin = [shoshoScore, yuyuScore]
    .filter((score): score is NumberGuessScore => Boolean(score?.bestWinAttempts))
    .sort((a, b) => (a.bestWinAttempts ?? Infinity) - (b.bestWinAttempts ?? Infinity))[0];

  return (
    <section className="mt-4 overflow-hidden rounded-[1.5rem] bg-white/88 px-4 py-3 shadow-[0_12px_28px_rgba(176,92,112,0.12)] ring-1 ring-rose-100/90">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            Scoreboard
          </p>
        </div>
        <button
          type="button"
          onClick={onResetClick}
          disabled={isResetting}
          className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-rose-600 ring-1 ring-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset Score
        </button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-rose-50/75 px-3 py-3 ring-1 ring-rose-100">
        <PlayerScore name="Yuyu" score={yuyuWins} align="left" />
        <span className="rounded-full bg-rose-950 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-rose-50 shadow-sm shadow-rose-950/20">
          VS
        </span>
        <PlayerScore name="Shosho" score={shoshoWins} align="right" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ScoreChip label="Champion" value={champion} />
        <ScoreChip label="Rounds" value={String(roundsPlayed)} />
        <ScoreChip
          label="Fastest"
          value={
            fastestWin?.bestWinAttempts
              ? `${fastestWin.name || getUserDisplayName(fastestWin.uid)} in ${fastestWin.bestWinAttempts}`
              : "None"
          }
        />
      </div>
    </section>
  );
}

function PlayerScore({
  align,
  name,
  score
}: {
  align: "left" | "right";
  name: string;
  score: number;
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-500">{name}</p>
      <p className="mt-0.5 text-4xl font-black leading-none text-rose-950">{score}</p>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-white/78 px-3 py-1.5 text-xs font-semibold text-stone-600 ring-1 ring-rose-100">
      <span className="text-rose-700">{label}:</span> {value}
    </span>
  );
}

function ResetScoreModal({
  isBusy,
  onCancel,
  onConfirm
}: {
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-rose-950/30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center">
      <section className="w-full max-w-md rounded-[2rem] bg-white px-5 py-5 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Score reset
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Reset scoreboard?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          This will reset Yuyu and Shosho’s wins back to 0–0. Current rounds and game history may stay, but the scoreboard will start fresh.
        </p>
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
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="flex-1 rounded-2xl bg-rose-700 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Resetting..." : "Reset Score"}
          </button>
        </div>
      </section>
    </div>
  );
}

function EndGameModal({
  isBusy,
  onCancel,
  onConfirm
}: {
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-rose-950/30 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center">
      <section className="w-full max-w-md rounded-[2rem] bg-white px-5 py-5 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          End round
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          End game?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          This will end the current round without a winner. Scores will not change.
        </p>
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
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="flex-1 rounded-2xl bg-rose-700 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? "Ending..." : "End Game"}
          </button>
        </div>
      </section>
    </div>
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
      className={`rounded-2xl px-3 py-3 ring-1 transition ${
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
        {!isJoined ? "waiting" : isReady ? "locked" : "choosing"}
      </p>
      <p className="mt-2 text-xs font-medium opacity-80">
        {attempts} guesses · {wins} wins
      </p>
    </div>
  );
}

function GameActionButton({
  bothReady,
  canGuess,
  currentUserId,
  isBusy,
  isMyTurn,
  opponentUid,
  ownSecret,
  round,
  onCreateRound,
  onJoinRound,
  onLockSecret,
  onOpenGuess
}: {
  bothReady: boolean;
  canGuess: boolean;
  currentUserId: string;
  isBusy: boolean;
  isMyTurn: boolean;
  opponentUid: string;
  ownSecret: NumberGuessSecret | null;
  round: NumberGuessRound | null;
  onCreateRound: () => void;
  onJoinRound: () => void;
  onLockSecret: () => void;
  onOpenGuess: () => void;
}) {
  let label = "Create Duel";
  let onClick = onCreateRound;
  let disabled = isBusy;

  if (round && !round.players[currentUserId]) {
    label = "Join Duel";
    onClick = onJoinRound;
  } else if (round?.status === "finished" || round?.status === "ended") {
    label = "Rematch";
    onClick = onCreateRound;
  } else if (round && !ownSecret) {
    label = "Lock Secret";
    onClick = onLockSecret;
    disabled = isBusy;
  } else if (round && !bothReady) {
    label = `Waiting for ${getWaitingSecretName(round, currentUserId)}`;
    disabled = true;
  } else if (round?.status === "in_progress" && isMyTurn) {
    label = "Make Guess";
    onClick = onOpenGuess;
    disabled = isBusy || !canGuess;
  } else if (round?.status === "in_progress") {
    label = `${getUserDisplayName(opponentUid)}’s turn`;
    disabled = true;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-4 w-full rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {label}
    </button>
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
    <section className="mt-4 overflow-hidden rounded-[1.5rem] bg-rose-950 px-4 py-4 text-center text-rose-50 shadow-[0_18px_38px_rgba(67,42,45,0.22)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-3xl text-rose-950 shadow-inner">
        ★
      </div>
      <h2 className="mt-3 font-[var(--font-display)] text-3xl leading-tight">
        {winnerName} cracked the code!
      </h2>
      <p className="mt-2 text-sm leading-6 text-rose-100">
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
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="mt-6 max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white px-5 py-5 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100 sm:mt-0"
      >
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
          Make your move
        </p>
        <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
          Guess {opponentName}’s secret
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Only exact positions count.
        </p>
        <DigitInput autoFocus label="Guess" value={guess} onChange={setGuess} />
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

function GuessHistory({
  currentUserId,
  guesses
}: {
  currentUserId: string;
  guesses: NumberGuessGuess[];
}) {
  const ownGuesses = guesses.filter((guess) => guess.guessedByUid === currentUserId);
  const visibleGuesses = [...ownGuesses].reverse().slice(0, 5);

  return (
    <section className="mt-4 rounded-[1.5rem] bg-white/82 px-4 py-4 shadow-[0_12px_28px_rgba(176,92,112,0.12)] ring-1 ring-rose-100/90">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-rose-950">Your guesses</p>
        {ownGuesses.length > 5 ? (
          <span className="text-xs font-medium text-rose-400">latest 5</span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {ownGuesses.length > 0 ? (
          visibleGuesses.map((guess) => (
            <article
              key={guess.id}
              className="rounded-2xl bg-rose-50/70 px-3 py-3 ring-1 ring-rose-100"
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
            No guesses yet. Make your first move.
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

  if (round.status === "ended") {
    return "Game ended without a winner.";
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
  return count === 4 ? "4 correct — code cracked" : `${count} correct`;
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
    case "ended":
      return "Ended";
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

function getScoreResetError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error("Number Guess Duel score reset failed.", error);

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "Score reset failed because Firestore permissions blocked it.";
  }

  return getFriendlyError(error);
}

function getEndGameError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error("Number Guess Duel end game failed.", error);

  if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
    return "End game failed because Firestore permissions blocked it.";
  }

  return getFriendlyError(error);
}
