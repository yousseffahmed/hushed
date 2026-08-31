type SealedApologyLetterProps = {
  onOpen: () => void;
};

export function SealedApologyLetter({ onOpen }: SealedApologyLetterProps) {
  return (
    <section className="mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-[#fffdfb] px-6 py-8 text-center shadow-[0_22px_55px_rgba(113,50,69,0.14)] ring-1 ring-rose-100">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-3xl ring-1 ring-rose-100" aria-hidden="true">
        💌
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
        A private letter
      </p>
      <h1 className="mt-2 font-[var(--font-display)] text-4xl leading-tight text-rose-950">
        For Shosho
      </h1>
      <p className="mt-2 text-sm font-medium text-stone-500">From Yuyu</p>
      <p className="mt-5 text-base leading-7 text-stone-600">
        Open whenever you’re ready.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-7 min-h-12 w-full rounded-2xl bg-rose-950 px-5 py-3 text-base font-semibold text-rose-50 shadow-md shadow-rose-950/15 transition active:scale-[0.99]"
      >
        Open when you’re ready
      </button>
    </section>
  );
}
