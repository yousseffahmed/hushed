import { formatMonthDayYear, getDateStatus, parseLocalDate } from "@/lib/dateUtils";
import type { MonthversaryMemory } from "@/lib/monthversaryService";

type MonthversaryCardProps = {
  memory: MonthversaryMemory;
  onEdit: (memory: MonthversaryMemory) => void;
  onOpen: (memory: MonthversaryMemory) => void;
  today: Date;
};

export function MonthversaryCard({ memory, onEdit, onOpen, today }: MonthversaryCardProps) {
  const date = parseLocalDate(memory.date);
  const status = getDateStatus(date, today);
  const coverPhoto = memory.photos[0];
  const extraPhotoCount = Math.max(0, memory.photos.length - 1);
  const statusLabel = {
    completed: "Completed",
    upcoming: "Upcoming",
    today: "Today"
  }[status];

  const statusTone = {
    completed: "bg-white/70 text-stone-600 ring-rose-100",
    upcoming: "bg-rose-50 text-rose-700 ring-rose-100",
    today: "bg-rose-200 text-rose-950 ring-rose-300"
  }[status];

  return (
    <article className="overflow-hidden rounded-3xl bg-white/82 shadow-[0_14px_32px_rgba(176,92,112,0.12)] ring-1 ring-rose-100/90">
      <button
        type="button"
        onClick={() => onOpen(memory)}
        className="block w-full text-left"
      >
        {coverPhoto ? (
          <div className="relative h-44 w-full overflow-hidden bg-rose-50">
            <img
              alt={memory.title}
              className="h-full w-full object-cover"
              src={coverPhoto.url}
            />
            {extraPhotoCount > 0 ? (
              <span className="absolute right-3 top-3 rounded-full bg-rose-950/82 px-3 py-1 text-xs font-semibold text-rose-50">
                +{extraPhotoCount} photos
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center bg-rose-50 text-4xl text-rose-300">
            ♥
          </div>
        )}
      </button>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            Month {memory.monthNumber}
          </p>
          <span className="text-xs font-medium text-rose-400">
            {memory.photos.length} photo{memory.photos.length === 1 ? "" : "s"}
          </span>
        </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug text-rose-950">
        {memory.title}
      </h3>
      <p className="mt-1 text-sm font-medium text-stone-500">
        {formatMonthDayYear(date)}
      </p>
      {memory.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">
          {memory.description}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone}`}>
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={() => onEdit(memory)}
          className="rounded-full px-3 py-1 text-xs font-semibold text-rose-500 ring-1 ring-rose-100"
        >
          Edit
        </button>
      </div>
      </div>
    </article>
  );
}
