"use client";

import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import type { Suggestion } from "@/lib/suggestions";

type SuggestionListProps = {
  currentUserId: string;
  suggestions: Suggestion[];
  onAdd: () => void;
  onDelete: (suggestion: Suggestion) => void;
  onToggleDone: (suggestion: Suggestion) => void;
  onToggleLike: (suggestion: Suggestion) => void;
};

export function SuggestionList({
  currentUserId,
  suggestions,
  onAdd,
  onDelete,
  onToggleDone,
  onToggleLike
}: SuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <section className="rounded-[2rem] bg-white/80 px-5 py-8 text-center shadow-[0_14px_32px_rgba(176,92,112,0.12)] ring-1 ring-rose-100">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-rose-50 text-4xl text-rose-300">
          ♥
        </div>
        <h2 className="mt-5 font-[var(--font-display)] text-3xl text-rose-950">
          The box is waiting
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          No notes here yet. Drop the first tiny idea for something sweet to do together.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 w-full rounded-2xl bg-rose-950 px-5 py-4 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20"
        >
          Add the first note
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          currentUserId={currentUserId}
          suggestion={suggestion}
          onDelete={onDelete}
          onToggleDone={onToggleDone}
          onToggleLike={onToggleLike}
        />
      ))}
    </section>
  );
}
