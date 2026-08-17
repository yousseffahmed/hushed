"use client";

import { useEffect, useState } from "react";
import { VoiceNoteInput } from "@/components/special-19th/VoiceNoteInput";
import type {
  Special19thDraftMedia,
  Special19thPackage,
  Special19thPackageDraft
} from "@/lib/special19thService";

type PackageEditorProps = {
  packageData: Special19thPackage | null;
  existingPhotoUrl: string;
  existingVoiceUrl: string;
  isSaving: boolean;
  uploadStatus: string;
  onSave: (draft: Special19thPackageDraft, media: Special19thDraftMedia) => Promise<boolean>;
  onSeal: (draft: Special19thPackageDraft, media: Special19thDraftMedia) => Promise<boolean>;
};

export function PackageEditor({
  packageData,
  existingPhotoUrl,
  existingVoiceUrl,
  isSaving,
  uploadStatus,
  onSave,
  onSeal
}: PackageEditorProps) {
  const [letter, setLetter] = useState(packageData?.letter ?? "");
  const [wish, setWish] = useState(packageData?.wish ?? "");
  const [loveThisMonth, setLoveThisMonth] = useState(packageData?.loveThisMonth ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [showSealConfirmation, setShowSealConfirmation] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [photoFile]);

  function getDraft(): Special19thPackageDraft {
    return { letter, wish, loveThisMonth };
  }

  function getMedia(): Special19thDraftMedia {
    return { photoFile, voiceFile };
  }

  async function handleSave() {
    setValidationMessage("");
    setSavedMessage("");
    const saved = await onSave(getDraft(), getMedia());

    if (saved) {
      setPhotoFile(null);
      setVoiceFile(null);
      setSavedMessage("Draft saved 💗");
    }
  }

  function requestSeal() {
    const missing = getMissingPackagePieces({
      draft: getDraft(),
      hasPhoto: Boolean(photoFile || packageData?.photoStoragePath),
      hasVoice: Boolean(voiceFile || packageData?.voiceNoteStoragePath)
    });

    if (missing.length > 0) {
      setValidationMessage(`Add ${formatMissingPieces(missing)} before sealing.`);
      return;
    }

    setValidationMessage("");
    setShowSealConfirmation(true);
  }

  async function confirmSeal() {
    const sealed = await onSeal(getDraft(), getMedia());

    if (sealed) {
      setShowSealConfirmation(false);
    }
  }

  const visiblePhotoUrl = photoPreviewUrl || existingPhotoUrl;

  return (
    <section className="rounded-[2rem] bg-white/86 p-5 shadow-[0_18px_44px_rgba(176,92,112,0.15)] ring-1 ring-rose-100/90">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
            Your private package
          </p>
          <h2 className="mt-1 font-[var(--font-display)] text-3xl text-rose-950">
            Put a little us inside
          </h2>
        </div>
        <span className="text-2xl" aria-hidden="true">
          💌
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Only you can see this draft. Once sealed, it waits for the shared reveal.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-rose-950">A letter for you 💌</span>
          <textarea
            value={letter}
            onChange={(event) => setLetter(event.target.value)}
            disabled={isSaving}
            maxLength={10_000}
            placeholder="Write the words you want waiting for them..."
            className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-base leading-6 text-rose-950 outline-none ring-rose-200 transition placeholder:text-stone-400 focus:ring-2 disabled:opacity-60"
          />
        </label>

        <div>
          <p className="text-sm font-semibold text-rose-950">One photo for the package</p>
          <div className="mt-2 overflow-hidden rounded-3xl bg-rose-50/75 ring-1 ring-rose-100">
            {visiblePhotoUrl ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-rose-100">
                {/* Blob previews and authenticated Firebase URLs are intentionally rendered directly. */}
                <img
                  src={visiblePhotoUrl}
                  alt="Package photo preview"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[4/2] items-center justify-center px-6 text-center text-sm font-medium text-stone-500">
                A small piece of this month, waiting here.
              </div>
            )}
            <label className="flex min-h-12 cursor-pointer items-center justify-center bg-white px-4 text-sm font-semibold text-rose-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              {visiblePhotoUrl ? "Replace photo" : "Choose a photo"}
              <input
                type="file"
                accept="image/*"
                disabled={isSaving}
                onChange={(event) => {
                  setPhotoFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        <VoiceNoteInput
          value={voiceFile}
          existingUrl={existingVoiceUrl}
          existingFileName={packageData?.voiceNoteFileName}
          disabled={isSaving}
          onChange={setVoiceFile}
        />

        <label className="block">
          <span className="text-sm font-semibold leading-5 text-rose-950">
            One thing I wish we were doing together right now...
          </span>
          <textarea
            value={wish}
            onChange={(event) => setWish(event.target.value)}
            disabled={isSaving}
            maxLength={2_000}
            placeholder="I wish we were..."
            className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-base leading-6 text-rose-950 outline-none ring-rose-200 transition placeholder:text-stone-400 focus:ring-2 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold leading-5 text-rose-950">
            One thing I love about you this month...
          </span>
          <textarea
            value={loveThisMonth}
            onChange={(event) => setLoveThisMonth(event.target.value)}
            disabled={isSaving}
            maxLength={2_000}
            placeholder="This month, I love..."
            className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-base leading-6 text-rose-950 outline-none ring-rose-200 transition placeholder:text-stone-400 focus:ring-2 disabled:opacity-60"
          />
        </label>
      </div>

      {validationMessage ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-5 text-rose-700">
          {validationMessage}
        </p>
      ) : null}
      {uploadStatus ? (
        <p className="mt-4 text-sm font-semibold text-rose-600" role="status">
          {uploadStatus}
        </p>
      ) : null}
      {savedMessage ? (
        <p className="mt-4 text-sm font-semibold text-rose-600" role="status">
          {savedMessage}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-12 rounded-2xl bg-rose-50 px-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isSaving ? "Saving..." : "Save draft"}
        </button>
        <button
          type="button"
          onClick={requestSeal}
          disabled={isSaving}
          className="min-h-12 rounded-2xl bg-rose-950 px-4 text-sm font-semibold text-rose-50 shadow-lg shadow-rose-950/18 disabled:cursor-not-allowed disabled:opacity-55"
        >
          Seal My 19th Package 💌
        </button>
      </div>

      {showSealConfirmation ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-rose-950/45 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isSaving) {
              setShowSealConfirmation(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seal-package-title"
            className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-rose-100"
          >
            <p className="text-2xl" aria-hidden="true">
              💌🔒
            </p>
            <h3
              id="seal-package-title"
              className="mt-2 font-[var(--font-display)] text-3xl text-rose-950"
            >
              Seal your package?
            </h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Once sealed, your 19th package will be waiting for the big reveal. 💗
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowSealConfirmation(false)}
                disabled={isSaving}
                autoFocus
                className="min-h-12 rounded-2xl bg-stone-100 px-4 text-sm font-semibold text-stone-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSeal}
                disabled={isSaving}
                className="min-h-12 rounded-2xl bg-rose-950 px-4 text-sm font-semibold text-rose-50 disabled:opacity-50"
              >
                {isSaving ? "Sealing..." : "Seal Package"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function getMissingPackagePieces({
  draft,
  hasPhoto,
  hasVoice
}: {
  draft: Special19thPackageDraft;
  hasPhoto: boolean;
  hasVoice: boolean;
}): string[] {
  const missing: string[] = [];

  if (!draft.letter.trim()) missing.push("your letter");
  if (!hasPhoto) missing.push("a photo");
  if (!hasVoice) missing.push("a voice note");
  if (!draft.wish.trim()) missing.push("your wish");
  if (!draft.loveThisMonth.trim()) missing.push("what you love this month");

  return missing;
}

function formatMissingPieces(pieces: string[]): string {
  if (pieces.length === 1) {
    return pieces[0];
  }

  return `${pieces.slice(0, -1).join(", ")}, and ${pieces.at(-1)}`;
}
