"use client";

type SuggestionBoxHeroProps = {
  openCount: number;
  doneCount: number;
  onAdd: () => void;
};

export function SuggestionBoxHero({ openCount, doneCount, onAdd }: SuggestionBoxHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#fffdf8] px-5 pb-6 pt-5 shadow-[0_22px_54px_rgba(176,92,112,0.18)] ring-1 ring-rose-100/90">
      <div className="absolute right-5 top-5 h-12 w-12 rounded-full bg-rose-100/80" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-pink-100/70" />

      <div className="relative">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-rose-400">
          Little notes
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-5xl leading-[0.98] text-rose-950">
          Our Suggestion Box
        </h1>
        <p className="mt-4 text-sm leading-6 text-stone-600">
          Little ideas for us, one note at a time.
        </p>
      </div>

      <div className="relative mt-6">
        <div className="mx-auto w-full max-w-[19rem]">
          <div className="relative h-40">
            <div className="absolute left-8 top-2 h-20 w-28 rotate-[-8deg] rounded-xl bg-rose-50 p-3 shadow-md ring-1 ring-rose-100">
              <div className="h-2 w-14 rounded-full bg-rose-200" />
              <div className="mt-3 h-2 w-20 rounded-full bg-stone-200" />
              <div className="mt-2 h-2 w-12 rounded-full bg-stone-200" />
            </div>
            <div className="absolute right-7 top-6 h-20 w-28 rotate-[7deg] rounded-xl bg-[#fff7d6] p-3 shadow-md ring-1 ring-amber-100">
              <div className="h-2 w-16 rounded-full bg-amber-200" />
              <div className="mt-3 h-2 w-20 rounded-full bg-stone-200" />
              <div className="mt-2 h-2 w-10 rounded-full bg-stone-200" />
            </div>
            <div className="absolute inset-x-0 bottom-0 mx-auto h-28 w-64 rounded-b-[2rem] rounded-t-lg bg-rose-200 shadow-[inset_0_-12px_0_rgba(190,86,112,0.22),0_18px_40px_rgba(176,92,112,0.18)]">
              <div className="absolute -top-4 left-5 right-5 h-8 rounded-full bg-rose-950 shadow-md" />
              <div className="absolute left-8 right-8 top-8 h-3 rounded-full bg-rose-100/80" />
              <div className="absolute bottom-5 left-0 right-0 text-center text-3xl text-rose-50">
                ♥
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="mt-5 w-full rounded-2xl bg-rose-950 px-5 py-4 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 active:translate-y-0.5"
        >
          Drop a note
        </button>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/80 px-4 py-3 text-center ring-1 ring-rose-100">
          <p className="text-2xl font-semibold text-rose-950">{openCount}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">
            Open ideas
          </p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-3 text-center ring-1 ring-rose-100">
          <p className="text-2xl font-semibold text-rose-950">{doneCount}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-400">
            Tried
          </p>
        </div>
      </div>
    </section>
  );
}
