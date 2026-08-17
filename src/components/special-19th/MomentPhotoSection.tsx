"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getUserDisplayName } from "@/lib/coupleUsers";
import { getSpecial19thUserIds, type Special19thUserId } from "@/lib/special19Config";
import type { Special19thMomentPhoto } from "@/lib/special19thService";

type MomentPhotoSectionProps = {
  currentUserId: Special19thUserId;
  isUploading: boolean;
  memoryCreated: boolean;
  photos: Partial<Record<Special19thUserId, Special19thMomentPhoto>>;
  uploadStatus: string;
  onUpload: (file: File) => Promise<boolean>;
};

export function MomentPhotoSection({
  currentUserId,
  isUploading,
  memoryCreated,
  photos,
  uploadStatus,
  onUpload
}: MomentPhotoSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const orderedUserIds = useMemo(
    () =>
      [...getSpecial19thUserIds()].sort((first, second) =>
        getUserDisplayName(first) === "Yuyu"
          ? -1
          : getUserDisplayName(second) === "Yuyu"
            ? 1
            : 0
      ),
    []
  );
  const bothSubmitted = getSpecial19thUserIds().every((uid) => Boolean(photos[uid]));
  const ownPhoto = photos[currentUserId];

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedFile]);

  async function handleUpload() {
    if (!selectedFile) {
      setLocalMessage("Choose the photo that shows your 19th right now.");
      return;
    }

    setLocalMessage("");
    const uploaded = await onUpload(selectedFile);

    if (uploaded) {
      setSelectedFile(null);
      setLocalMessage("Your side of the 19th is here 💗");
    }
  }

  return (
    <section className="rounded-[2rem] bg-white/88 p-5 shadow-[0_18px_44px_rgba(176,92,112,0.15)] ring-1 ring-rose-100/90">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            One more piece
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-rose-950">
            Show me your 19th 📸
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Take one photo of where you are right now.
          </p>
        </div>
      </div>

      {bothSubmitted ? (
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-2">
            {orderedUserIds.map((uid) => {
              const photo = photos[uid];

              return photo ? (
                <figure key={uid}>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-rose-100 ring-1 ring-rose-100">
                    <Image
                      src={photo.url}
                      alt={`${photo.name}'s 19th moment`}
                      fill
                      sizes="(max-width: 448px) 46vw, 200px"
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="mt-2 text-center text-xs font-semibold text-rose-700">
                    {photo.name}
                  </figcaption>
                </figure>
              ) : null;
            })}
          </div>
          <div className="mt-5 text-center">
            <p className="font-[var(--font-display)] text-2xl text-rose-950">
              Same 19th. Different places. 💗
            </p>
            <p className="mt-2 text-sm font-semibold text-rose-600">One 19th apart. ♡</p>
            <p className="mt-2 text-xs font-medium text-stone-500">
              Our streak: 17 together • 1 from afar
            </p>
            <p className="mt-3 text-xs font-semibold text-rose-500">
              {memoryCreated
                ? "Saved forever in Our 19th Memories."
                : "Saving this moment to Our 19th Memories..."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {ownPhoto ? (
            <div className="overflow-hidden rounded-3xl bg-rose-50 ring-1 ring-rose-100">
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={ownPhoto.url}
                  alt="Your submitted 19th moment"
                  fill
                  sizes="(max-width: 448px) 100vw, 448px"
                  className="object-cover"
                />
              </div>
              <p className="px-4 py-3 text-center text-sm font-semibold text-rose-700">
                Your photo is waiting for theirs 💗
              </p>
            </div>
          ) : null}

          {previewUrl ? (
            <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-rose-100 ring-1 ring-rose-100">
              <img
                src={previewUrl}
                alt="Selected moment preview"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-rose-50 px-4 text-center text-sm font-semibold text-rose-700 ring-1 ring-rose-200 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            {ownPhoto ? "Choose a replacement" : "Choose your moment photo"}
            <input
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setLocalMessage("");
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="min-h-12 w-full rounded-2xl bg-rose-950 px-4 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Sending your moment..." : ownPhoto ? "Replace my photo" : "Add my photo"}
          </button>

          <div className="grid grid-cols-2 gap-2">
            {orderedUserIds.map((uid) => (
              <div
                key={uid}
                className={`rounded-2xl px-3 py-3 text-center text-xs font-semibold ring-1 ${
                  photos[uid]
                    ? "bg-rose-950 text-rose-50 ring-rose-950"
                    : "bg-rose-50 text-stone-500 ring-rose-100"
                }`}
              >
                {getUserDisplayName(uid)}: {photos[uid] ? "Photo ready" : "Waiting"}
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadStatus ? (
        <p className="mt-4 text-center text-sm font-semibold text-rose-600" role="status">
          {uploadStatus}
        </p>
      ) : null}
      {localMessage ? (
        <p className="mt-4 text-center text-sm font-semibold text-rose-600" role="status">
          {localMessage}
        </p>
      ) : null}
    </section>
  );
}
