import { formatLongDate } from "@/lib/dateUtils";

type TimeTogetherCardProps = {
  startDate: Date;
  totalDays: number;
  totalMonths: number;
};

export function TimeTogetherCard({
  startDate,
  totalDays,
  totalMonths
}: TimeTogetherCardProps) {
  const dayLabel = totalDays === 1 ? "day" : "days";
  const monthLabel = totalMonths === 1 ? "month" : "months";

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-white/82 px-6 py-7 shadow-[0_24px_60px_rgba(176,92,112,0.18)] ring-1 ring-rose-100/80 backdrop-blur">
      <div className="absolute right-5 top-5 text-2xl text-rose-300" aria-hidden="true">
        ♥
      </div>
      <p className="text-sm font-medium uppercase tracking-[0.22em] text-rose-400">
        Together for
      </p>
      <div className="mt-4 flex items-end gap-3">
        <span className="font-[var(--font-display)] text-7xl leading-none text-rose-950">
          {totalDays}
        </span>
        <span className="pb-2 text-2xl font-semibold text-rose-800">{dayLabel}</span>
      </div>
      {totalMonths > 0 ? (
        <p className="mt-4 text-base text-stone-600">
          That is {totalMonths} whole {monthLabel} of choosing each other.
        </p>
      ) : (
        <p className="mt-4 text-base text-stone-600">
          The first chapter is still becoming our favorite story.
        </p>
      )}
      <p className="mt-5 text-sm font-medium text-rose-500">
        Since {formatLongDate(startDate)}
      </p>
    </section>
  );
}
