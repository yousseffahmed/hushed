"use client";

import { useState } from "react";
import { formatMonthDayYear, parseLocalDate } from "@/lib/dateUtils";
import type { MonthversaryMemory, MonthversaryPhoto } from "@/lib/monthversaryService";

type MonthversaryDetailProps = {
  memory: MonthversaryMemory;
  isDeletingPhoto?: boolean;
  onAddPhotos: (memory: MonthversaryMemory) => void;
  onClose: () => void;
  onDeleteMemory: (memory: MonthversaryMemory) => void;
  onDeletePhoto: (photo: MonthversaryPhoto) => void;
  onEdit: (memory: MonthversaryMemory) => void;
};

export function MonthversaryDetail({
  memory,
  isDeletingPhoto = false,
  onAddPhotos,
  onClose,
  onDeleteMemory,
  onDeletePhoto,
  onEdit
}: MonthversaryDetailProps) {
  const [previewPhoto, setPreviewPhoto] = useState<MonthversaryPhoto | null>(null);
  const date = parseLocalDate(memory.date);

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-rose-950/28 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white px-5 py-6 shadow-[0_28px_80px_rgba(67,42,45,0.28)] ring-1 ring-rose-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-400">
              Month {memory.monthNumber}
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-4xl leading-tight text-rose-950">
              {memory.title}
            </h2>
            <p className="mt-2 text-sm font-medium text-stone-500">
              {formatMonthDayYear(date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
          >
            Close
          </button>
        </div>

        {memory.description ? (
          <p className="mt-5 rounded-3xl bg-rose-50/80 px-4 py-4 text-sm leading-6 text-stone-600">
            {memory.description}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => onEdit(memory)}
            className="flex-1 rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50"
          >
            Edit memory
          </button>
          <button
            type="button"
            onClick={() => onAddPhotos(memory)}
            className="flex-1 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
          >
            Add photos
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDeleteMemory(memory)}
          className="mt-3 w-full rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600"
        >
          Delete memory
        </button>

        <div className="mt-6">
          <h3 className="font-[var(--font-display)] text-2xl text-rose-950">
            Photo gallery
          </h3>
          {memory.photos.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {memory.photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-3xl bg-rose-50">
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="h-full w-full"
                  >
                    <img
                      alt={photo.fileName}
                      className="h-full w-full object-cover"
                      src={photo.url}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingPhoto}
                    onClick={() => onDeletePhoto(photo)}
                    className="absolute bottom-2 right-2 rounded-full bg-rose-950/82 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-3xl bg-rose-50/80 px-4 py-5 text-sm font-medium text-stone-600">
              No photos yet — add a few from this day.
            </p>
          )}
        </div>
      </section>

      {previewPhoto ? (
        <button
          type="button"
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-30 flex items-center justify-center bg-rose-950/80 p-[calc(env(safe-area-inset-top)+1rem)]"
        >
          <img
            alt={previewPhoto.fileName}
            className="max-h-full max-w-full rounded-3xl object-contain"
            src={previewPhoto.url}
          />
        </button>
      ) : null}
    </div>
  );
}
