import { formatLongDate } from "@/lib/dateUtils";

type NextAnniversaryCardProps = {
  nextAnniversary: Date;
  daysUntil: number;
  isToday: boolean;
};

export function NextAnniversaryCard({
  nextAnniversary,
  daysUntil,
  isToday
}: NextAnniversaryCardProps) {
  return (
    <section className="rounded-[1.75rem] bg-rose-950 px-5 py-6 text-rose-50 shadow-[0_20px_48px_rgba(67,42,45,0.22)]">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-200">
        Next monthly anniversary
      </p>
      <p className="mt-3 font-[var(--font-display)] text-3xl leading-tight">
        {formatLongDate(nextAnniversary)}
      </p>
      <div className="mt-5 rounded-2xl bg-white/10 px-4 py-4 ring-1 ring-white/10">
        {isToday ? (
          <p className="text-xl font-semibold">Happy monthly anniversary ❤️</p>
        ) : (
          <>
            <p className="text-4xl font-semibold">{daysUntil}</p>
            <p className="mt-1 text-sm text-rose-100">
              {daysUntil === 1 ? "day" : "days"} until our next little celebration
            </p>
          </>
        )}
      </div>
    </section>
  );
}
