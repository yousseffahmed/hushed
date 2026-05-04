"use client";

import { useState } from "react";
import {
  suggestionCategories,
  type SuggestionCategory,
  type SuggestionInput
} from "@/lib/suggestions";

type SuggestionFormProps = {
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: SuggestionInput) => Promise<void>;
};

const moodOptions = ["Sweet", "Cozy", "Silly", "Romantic", "Adventure", "Quiet"];

export function SuggestionForm({ isSaving, onCancel, onSave }: SuggestionFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<SuggestionCategory | "">("Date");
  const [mood, setMood] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Write the little idea first.");
      return;
    }

    setError("");
    await onSave({
      title,
      message: trimmedMessage,
      category,
      mood,
      note
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-rose-950/24 px-3 pb-3 pt-8 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-[2rem] bg-[#fffdf8] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 shadow-2xl ring-1 ring-rose-100">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-rose-200" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
              New note
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
              Drop an idea in the box
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Tiny title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="Sushi date, sunset walk..."
              maxLength={80}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-rose-950">The idea</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="What should we do together?"
              maxLength={260}
              required
            />
          </label>

          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-rose-950">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as SuggestionCategory | "")}
                className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              >
                <option value="">No category</option>
                {suggestionCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-rose-950">Mood</span>
              <select
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              >
                <option value="">Pick a feeling</option>
                {moodOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Why I want this</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="A little note, only if you want."
              maxLength={260}
            />
          </label>

          {error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-2xl bg-rose-950 px-5 py-4 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Dropping note..." : "Add to our box"}
          </button>
        </form>
      </div>
    </div>
  );
}
