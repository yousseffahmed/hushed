import { getUserDisplayName } from "@/lib/coupleUsers";
import {
  getSpecial19thUserIds,
  type Special19thUserId
} from "@/lib/special19Config";
import type {
  Special19thEvent,
  Special19thPresence
} from "@/lib/special19thService";

export function PackageReadinessCard({
  currentUserId,
  event
}: {
  currentUserId: Special19thUserId;
  event: Special19thEvent | null;
}) {
  return (
    <section className="rounded-[1.75rem] bg-white/82 p-4 shadow-[0_14px_34px_rgba(176,92,112,0.12)] ring-1 ring-rose-100/90">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[var(--font-display)] text-2xl text-rose-950">Our packages</h2>
        <span className="text-xs font-semibold text-rose-500">Private until reveal</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {getSpecial19thUserIds().map((uid) => {
          const sealed = Boolean(event?.packageStatuses[uid]?.sealed);

          return (
            <div
              key={uid}
              className={`rounded-2xl px-3 py-3 text-center ring-1 ${
                sealed
                  ? "bg-rose-950 text-rose-50 ring-rose-950"
                  : "bg-rose-50 text-stone-600 ring-rose-100"
              }`}
            >
              <p className="text-sm font-semibold">
                {uid === currentUserId ? "You" : getUserDisplayName(uid)}
              </p>
              <p className={`mt-1 text-xs ${sealed ? "text-rose-200" : "text-stone-500"}`}>
                {sealed ? "Sealed 🔒" : "Preparing..."}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SealedPackageCard({ partnerName }: { partnerName: string }) {
  return (
    <section className="rounded-[2rem] bg-white/86 px-5 py-7 text-center shadow-[0_18px_44px_rgba(176,92,112,0.15)] ring-1 ring-rose-100/90">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-100 text-4xl shadow-inner">
        💌
      </div>
      <h2 className="mt-4 font-[var(--font-display)] text-3xl text-rose-950">
        Your 19th package is sealed 💌🔒
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        It will stay locked and private from {partnerName} until you open it together.
      </p>
    </section>
  );
}

export function RevealReadyCard({
  activePresence,
  bothSealed,
  canStartReveal,
  dateArrived,
  event,
  isStarting,
  onStart
}: {
  activePresence: Record<string, Special19thPresence>;
  bothSealed: boolean;
  canStartReveal: boolean;
  dateArrived: boolean;
  event: Special19thEvent | null;
  isStarting: boolean;
  onStart: () => void;
}) {
  const missingNames = getSpecial19thUserIds()
    .filter((uid) => !activePresence[uid])
    .map((uid) => getUserDisplayName(uid));
  const status = getRevealStatus({ bothSealed, dateArrived, missingNames });

  return (
    <section className="rounded-[2rem] bg-rose-50/88 p-5 ring-1 ring-rose-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Open together
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-rose-950">
            {status.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{status.description}</p>
        </div>
        <span className="text-2xl" aria-hidden="true">
          {canStartReveal ? "💗" : "🔒"}
        </span>
      </div>

      {dateArrived && bothSealed ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {getSpecial19thUserIds().map((uid) => (
            <div
              key={uid}
              className={`rounded-2xl px-3 py-2 text-center text-xs font-semibold ring-1 ${
                activePresence[uid]
                  ? "bg-white text-rose-700 ring-rose-200"
                  : "bg-white/60 text-stone-500 ring-rose-100"
              }`}
            >
              {getUserDisplayName(uid)} {activePresence[uid] ? "is here" : "is away"}
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onStart}
        disabled={!canStartReveal || isStarting || Boolean(event?.revealAtMs)}
        className="mt-4 min-h-12 w-full rounded-2xl bg-rose-950 px-4 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/18 disabled:cursor-not-allowed disabled:bg-rose-200 disabled:text-rose-500 disabled:shadow-none"
      >
        {isStarting
          ? "Starting together..."
          : getRevealButtonLabel({ bothSealed, dateArrived, missingNames })}
      </button>
    </section>
  );
}

function getRevealStatus({
  bothSealed,
  dateArrived,
  missingNames
}: {
  bothSealed: boolean;
  dateArrived: boolean;
  missingNames: string[];
}): { title: string; description: string } {
  if (!bothSealed) {
    return {
      title: "One surprise at a time",
      description: "The shared reveal unlocks after both packages are sealed."
    };
  }

  if (!dateArrived) {
    return {
      title: "Both packages are ready 💗",
      description: "They stay safely sealed until 19 August in Cairo."
    };
  }

  if (missingNames.length > 0) {
    return {
      title: `Waiting for ${missingNames.join(" and ")}... 💗`,
      description: "Keep this page open on both phones so the reveal can begin together."
    };
  }

  return {
    title: "This is our moment",
    description: "Both of you are here. One tap starts the same three-second countdown."
  };
}

function getRevealButtonLabel({
  bothSealed,
  dateArrived,
  missingNames
}: {
  bothSealed: boolean;
  dateArrived: boolean;
  missingNames: string[];
}): string {
  if (!bothSealed) return "Waiting for both packages";
  if (!dateArrived) return "Opens on 19 August";
  if (missingNames.length > 0) return `Waiting for ${missingNames.join(" & ")}`;
  return "Open Our 19th Together 💌";
}
