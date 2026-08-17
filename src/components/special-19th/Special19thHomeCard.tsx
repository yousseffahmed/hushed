"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  getSpecial19thUserIds,
  hasSpecial19thDateArrived,
  isSpecial19thUserId
} from "@/lib/special19Config";
import {
  ensureSpecial19thEvent,
  getSpecial19thFriendlyError,
  subscribeToSpecial19thEvent,
  type Special19thEvent
} from "@/lib/special19thService";

type Special19thHomeCardProps = {
  currentUser: User;
};

export function Special19thHomeCard({ currentUser }: Special19thHomeCardProps) {
  const router = useRouter();
  const [event, setEvent] = useState<Special19thEvent | null>(null);
  const [now, setNow] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    ensureSpecial19thEvent()
      .then(() => {
        if (cancelled) {
          return;
        }

        unsubscribe = subscribeToSpecial19thEvent(setEvent, (error) => {
          setErrorMessage(getSpecial19thFriendlyError(error));
        });
      })
      .catch((error) => setErrorMessage(getSpecial19thFriendlyError(error)));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!isSpecial19thUserId(currentUser.uid)) {
    return null;
  }

  const ownStatus = event?.packageStatuses[currentUser.uid];
  const bothSealed = Boolean(
    event && getSpecial19thUserIds().every((uid) => event.packageStatuses[uid]?.sealed)
  );
  const revealed = Boolean(event?.revealAtMs && now >= event.revealAtMs);
  const dateArrived = hasSpecial19thDateArrived(now);
  const title = revealed
    ? "Our First 19th Apart 💗"
    : "Our First 19th Apart ✈️💗";
  const description = getDescription({
    bothSealed,
    dateArrived,
    ownSealed: Boolean(ownStatus?.sealed),
    revealed
  });
  const buttonLabel = revealed
    ? "View Our 19th"
    : dateArrived && bothSealed
      ? "Open Our 19th 💌"
      : ownStatus?.sealed
        ? "Visit Our 19th"
        : "Prepare Our 19th 💌";

  return (
    <section className="mt-5 overflow-hidden rounded-[1.75rem] bg-white/84 px-5 py-4 shadow-[0_16px_38px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-xl">
          {revealed ? "💗" : "💌"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            19 August 2026
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-2xl leading-tight text-rose-950">
            {title}
          </h2>
          <p className="mt-1.5 text-sm leading-5 text-stone-600">{description}</p>
        </div>
      </div>
      {errorMessage ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-rose-600">{errorMessage}</p>
      ) : null}
      <button
        type="button"
        onClick={() => router.push("/special-19th")}
        className="mt-4 min-h-11 w-full rounded-2xl bg-rose-950 px-4 text-sm font-semibold text-rose-50 shadow-md shadow-rose-950/15"
      >
        {buttonLabel}
      </button>
    </section>
  );
}

function getDescription({
  bothSealed,
  dateArrived,
  ownSealed,
  revealed
}: {
  bothSealed: boolean;
  dateArrived: boolean;
  ownSealed: boolean;
  revealed: boolean;
}): string {
  if (revealed) {
    return "Same 19th. Different places.";
  }

  if (dateArrived && bothSealed) {
    return "Both surprises are sealed. Come open them together.";
  }

  if (bothSealed) {
    return "Everything is ready for the 19th 💗";
  }

  if (ownSealed) {
    return "Your package is sealed 🔒";
  }

  return "We may not be in the same place this 19th, but we're still spending it together.";
}
