"use client";

import { useRouter } from "next/navigation";
import { coupleConfig } from "@/lib/coupleConfig";

const comingSoonCards = [
  { title: "Love Letter Blitz", copy: "New game loading..." },
  { title: "Date Dare Deck", copy: "Future chaos awaits" },
  { title: "Memory Match", copy: "Coming soon" }
];

export function GameCenterPage() {
  const router = useRouter();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
        >
          ← Back
        </button>
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-rose-500">
          {coupleConfig.appName}
        </p>
      </header>

      <section className="overflow-hidden rounded-[2rem] bg-rose-950 px-5 py-6 text-rose-50 shadow-[0_22px_52px_rgba(67,42,45,0.24)]">
        <div className="-mx-5 -mt-6 mb-5 grid grid-cols-6 gap-2 bg-rose-900/70 px-5 py-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} className="h-4 rounded-md bg-rose-100/20" />
          ))}
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-200">
          Tiny games
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.95]">
          Yushef Game Center
        </h1>
        <p className="mt-4 text-sm leading-6 text-rose-100">
          Tiny games. Big competition.
        </p>
      </section>

      <section className="mt-6 grid gap-4">
        <button
          type="button"
          onClick={() => router.push("/game-center/number-guess")}
          className="overflow-hidden rounded-[1.75rem] bg-white/84 text-left shadow-[0_18px_42px_rgba(176,92,112,0.14)] ring-1 ring-rose-100/90 transition active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-4 bg-rose-50/70 px-5 py-4">
            <span className="rounded-full bg-rose-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-50">
              Play now
            </span>
            <span className="text-2xl" aria-hidden="true">#</span>
          </div>
          <div className="px-5 py-5">
            <h2 className="font-[var(--font-display)] text-3xl text-rose-950">
              Number Guess Duel
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Pick a secret 4-digit number, then try to read each other’s minds.
            </p>
          </div>
        </button>

        {comingSoonCards.map((card) => (
          <article
            key={card.title}
            className="rounded-[1.75rem] bg-white/60 px-5 py-5 opacity-75 shadow-[0_14px_34px_rgba(176,92,112,0.1)] ring-1 ring-rose-100/80"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-300">
                  Locked
                </p>
                <h2 className="mt-2 font-[var(--font-display)] text-2xl text-rose-900">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">{card.copy}</p>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-2 text-lg text-rose-400" aria-hidden="true">
                ♡
              </span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
