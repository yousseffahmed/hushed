"use client";

import { getUserDisplayName } from "@/lib/coupleUsers";
import type { Suggestion } from "@/lib/suggestions";

type SuggestionCardProps = {
  currentUserId: string;
  suggestion: Suggestion;
  onDelete: (suggestion: Suggestion) => void;
  onToggleDone: (suggestion: Suggestion) => void;
  onToggleLike: (suggestion: Suggestion) => void;
};

export function SuggestionCard({
  currentUserId,
  suggestion,
  onDelete,
  onToggleDone,
  onToggleLike
}: SuggestionCardProps) {
  const isOwner = suggestion.createdBy === currentUserId;
  const isLiked = suggestion.likedBy.includes(currentUserId);
  const createdByName = suggestion.createdByName || getUserDisplayName(suggestion.createdBy);
  const title = suggestion.title || suggestion.message;

  return (
    <article
      className={`relative overflow-hidden rounded-[1.75rem] bg-[#fffdf8] px-4 pb-4 pt-5 shadow-[0_14px_34px_rgba(176,92,112,0.13)] ring-1 ring-rose-100/90 transition active:scale-[0.99] ${
        suggestion.done ? "opacity-82" : ""
      }`}
    >
      <div className="absolute right-0 top-0 h-16 w-20 rounded-bl-[2rem] bg-rose-50" />
      <div className="absolute right-4 top-4 text-lg text-rose-300" aria-hidden="true">
        ♥
      </div>

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          {suggestion.category ? (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              {suggestion.category}
            </span>
          ) : null}
          {suggestion.mood ? (
            <span className="rounded-full bg-[#fff0bd] px-3 py-1 text-xs font-semibold text-amber-800">
              {suggestion.mood}
            </span>
          ) : null}
          {suggestion.done ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Tried
            </span>
          ) : null}
        </div>

        <h2 className="mt-3 text-xl font-semibold leading-snug text-rose-950">
          {title}
        </h2>
        {suggestion.title ? (
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {suggestion.message}
          </p>
        ) : null}
        {suggestion.note ? (
          <p className="mt-3 rounded-2xl bg-rose-50/70 px-4 py-3 text-sm leading-6 text-stone-600">
            {suggestion.note}
          </p>
        ) : null}

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-rose-400">
          From {createdByName} · {formatSuggestionDate(suggestion.createdAt)}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onToggleLike(suggestion)}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold ring-1 transition ${
              isLiked
                ? "bg-rose-950 text-rose-50 ring-rose-950"
                : "bg-white/80 text-rose-700 ring-rose-100"
            }`}
            aria-pressed={isLiked}
          >
            ♥ {suggestion.likedBy.length}
          </button>
          <button
            type="button"
            onClick={() => onToggleDone(suggestion)}
            className="rounded-2xl bg-white/80 px-3 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
            aria-pressed={suggestion.done}
          >
            {suggestion.done ? "Undo" : "Tried"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(suggestion)}
            disabled={!isOwner}
            className="rounded-2xl bg-white/80 px-3 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function formatSuggestionDate(value: string): string {
  if (!value) {
    return "just now";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
