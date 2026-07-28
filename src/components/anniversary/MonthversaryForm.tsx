"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { coupleConfig } from "@/lib/coupleConfig";
import {
  formatDateInputValue,
  getMonthNumberForDate,
  getMonthversaryDate,
  parseLocalDate
} from "@/lib/dateUtils";
import type { MonthversaryMemoryInput } from "@/lib/monthversaryService";
import type { MonthversaryMemory } from "@/lib/monthversaryService";

type MonthversaryFormProps = {
  initialMemory?: MonthversaryMemory | null;
  isSaving?: boolean;
  uploadStatus?: string;
  onCancel: () => void;
  onSave: (input: MonthversaryMemoryInput, files: File[]) => void;
};

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export function MonthversaryForm({
  initialMemory,
  isSaving = false,
  uploadStatus = "",
  onCancel,
  onSave
}: MonthversaryFormProps) {
  const initialDate = initialMemory?.date ?? getDefaultDate(0);
  const [monthNumber, setMonthNumber] = useState(() =>
    getMonthNumberForDate(initialDate, coupleConfig.startDate)
  );
  const [date, setDate] = useState(initialDate);
  const [title, setTitle] = useState(initialMemory?.title ?? "");
  const [description, setDescription] = useState(initialMemory?.description ?? "");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const existingPhotoCount = initialMemory?.photos.length ?? 0;
  const selectedPreviews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file)
      })),
    [selectedFiles]
  );

  const parsedDate = useMemo(() => {
    try {
      return parseLocalDate(date);
    } catch {
      return null;
    }
  }, [date]);

  const titleError = submitted && !title.trim() ? "Title is required." : "";
  const monthError =
    submitted && monthNumber < 0 ? "Month number must be Month 0 or later." : "";
  const dateError = submitted && !parsedDate ? "Choose a valid date." : "";
  const dateWarning =
    parsedDate && parsedDate.getDate() !== coupleConfig.anniversaryDay
      ? "Our monthversaries are usually on the 19th."
      : "";

  useEffect(() => {
    return () => {
      selectedPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedPreviews]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!title.trim() || monthNumber < 0 || !parsedDate) {
      return;
    }

    onSave(
      {
        monthNumber,
        date,
        title,
        description
      },
      selectedFiles
    );
  }

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const nextFiles = [...selectedFiles];
    setFileError("");

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setFileError("Only image files can be added.");
        continue;
      }

      if (file.size > MAX_PHOTO_SIZE) {
        setFileError("Each photo must be 5MB or smaller.");
        continue;
      }

      if (existingPhotoCount + nextFiles.length >= MAX_PHOTOS) {
        setFileError("Each memory can hold up to 10 photos for now.");
        break;
      }

      nextFiles.push(file);
    }

    setSelectedFiles(nextFiles);
    event.target.value = "";
  }

  function removeSelectedPhoto(indexToRemove: number) {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove)
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100"
      >
        <div className="mb-5">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
            Add 19th memory
          </p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl text-rose-950">
            {initialMemory ? "Edit our story" : "Add to our story"}
          </h2>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Month number</span>
            <input
              className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              min="0"
              type="number"
              value={monthNumber}
              onChange={(event) => {
                const nextMonthNumber = Number(event.target.value);
                setMonthNumber(nextMonthNumber);

                if (Number.isInteger(nextMonthNumber) && nextMonthNumber >= 0) {
                  setDate(getDefaultDate(nextMonthNumber));
                }
              }}
            />
            {monthError ? <span className="mt-1 block text-xs font-medium text-rose-700">{monthError}</span> : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Date</span>
            <input
              className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              type="date"
              value={date}
              onChange={(event) => {
                const nextDate = event.target.value;
                setDate(nextDate);

                try {
                  setMonthNumber(
                    getMonthNumberForDate(nextDate, coupleConfig.startDate)
                  );
                } catch {
                  // Keep the current month number while the date input is incomplete.
                }
              }}
            />
            {dateError ? <span className="mt-1 block text-xs font-medium text-rose-700">{dateError}</span> : null}
            {dateWarning ? <span className="mt-1 block text-xs font-medium text-rose-500">{dateWarning}</span> : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Title</span>
            <input
              className="mt-2 w-full rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="Sushi date"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {titleError ? <span className="mt-1 block text-xs font-medium text-rose-700">{titleError}</span> : null}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-rose-950">Description</span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-rose-950 outline-none ring-rose-200 transition focus:ring-2"
              placeholder="We went for sushi and walked after dinner."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/70 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rose-950">Photos from this day</p>
                <p className="mt-1 text-xs font-medium text-rose-500">
                  Up to {MAX_PHOTOS} photos, 5MB each.
                </p>
              </div>
              <label className="shrink-0 rounded-full bg-white px-4 py-3 text-xs font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100">
                Add photos
                <input
                  accept="image/*"
                  className="sr-only"
                  multiple
                  type="file"
                  onChange={handlePhotoSelection}
                />
              </label>
            </div>
            {fileError ? (
              <p className="mt-3 text-xs font-medium text-rose-700">{fileError}</p>
            ) : null}
            {selectedFiles.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {selectedPreviews.map((preview, index) => (
                  <div key={`${preview.file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl bg-white">
                    <img
                      alt={preview.file.name}
                      className="h-full w-full object-cover"
                      src={preview.url}
                    />
                    <button
                      type="button"
                      onClick={() => removeSelectedPhoto(index)}
                      className="absolute right-1 top-1 rounded-full bg-rose-950/80 px-2 py-2 text-[10px] font-bold text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {uploadStatus ? (
              <p className="mt-3 text-xs font-semibold text-rose-700">{uploadStatus}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save this memory"}
          </button>
        </div>
      </form>
    </div>
  );
}

function getDefaultDate(monthNumber: number): string {
  return formatDateInputValue(
    getMonthversaryDate(coupleConfig.startDate, Math.max(0, monthNumber), coupleConfig.anniversaryDay)
  );
}
