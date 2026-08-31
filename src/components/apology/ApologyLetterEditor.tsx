"use client";

import { useState } from "react";
import { ApologyLetterContent } from "@/components/apology/ApologyLetterContent";
import { apologyLetterConfig } from "@/lib/apologyLetterConfig";
import {
  emptyApologyDraft,
  getApologyFriendlyError,
  getPublishValidationMessage,
  type ApologyLetterDraft,
  type PublishApologyLetterResult
} from "@/lib/apologyLetterService";

type ApologyLetterEditorProps = {
  initialDraft?: ApologyLetterDraft;
  onPublish: (draft: ApologyLetterDraft) => Promise<PublishApologyLetterResult>;
  onSave: (draft: ApologyLetterDraft) => Promise<void>;
};

export function ApologyLetterEditor({
  initialDraft = emptyApologyDraft,
  onPublish,
  onSave
}: ApologyLetterEditorProps) {
  const [draft, setDraft] = useState<ApologyLetterDraft>(() => ({
    ...initialDraft,
    commitments:
      initialDraft.commitments.length > 0 ? [...initialDraft.commitments] : [""]
  }));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showSealConfirmation, setShowSealConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isBusy = isSaving || isPublishing;

  function updateField(
    field: "apology" | "shouldHaveDone" | "whatImChanging",
    value: string
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("");
    setErrorMessage("");
  }

  function updateCommitment(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      commitments: current.commitments.map((commitment, commitmentIndex) =>
        commitmentIndex === index ? value : commitment
      )
    }));
    setMessage("");
    setErrorMessage("");
  }

  function addCommitment() {
    setDraft((current) => ({
      ...current,
      commitments:
        current.commitments.length < apologyLetterConfig.maxCommitments
          ? [...current.commitments, ""]
          : current.commitments
    }));
  }

  function removeCommitment(index: number) {
    setDraft((current) => ({
      ...current,
      commitments:
        current.commitments.length === 1
          ? current.commitments
          : current.commitments.filter((_, commitmentIndex) => commitmentIndex !== index)
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await onSave(draft);
      setMessage("Your private draft is saved.");
    } catch (error) {
      setErrorMessage(
        getApologyFriendlyError(error, "Your letter couldn’t be saved. Try again.")
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openPreview() {
    const validationMessage = getPublishValidationMessage(draft);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setErrorMessage("");
    setMessage("");
    setMode("preview");
  }

  function requestSeal() {
    const validationMessage = getPublishValidationMessage(draft);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      setMode("edit");
      return;
    }

    setErrorMessage("");
    setShowSealConfirmation(true);
  }

  async function confirmSeal() {
    setIsPublishing(true);
    setMessage("");
    setErrorMessage("");

    try {
      const result = await onPublish(draft);
      setShowSealConfirmation(false);
      setMessage(
        result.notificationSent
          ? "Your letter is sealed."
          : "Your letter is sealed, but the notification could not be sent."
      );
    } catch (error) {
      setShowSealConfirmation(false);
      setErrorMessage(
        getApologyFriendlyError(error, "Your letter couldn’t be sealed yet.")
      );
    } finally {
      setIsPublishing(false);
    }
  }

  if (mode === "preview") {
    return (
      <div>
        <ApologyLetterContent
          content={draft}
          preview
          action={
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="min-h-12 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200"
              >
                Back to Editing
              </button>
              <button
                type="button"
                onClick={requestSeal}
                className="min-h-12 rounded-2xl bg-rose-950 px-5 py-3 text-sm font-semibold text-rose-50 shadow-md shadow-rose-950/15"
              >
                Seal My Letter 💌
              </button>
            </div>
          }
        />
        {errorMessage ? <FeedbackMessage message={errorMessage} error /> : null}
        {showSealConfirmation ? (
          <SealConfirmation
            isPublishing={isPublishing}
            onCancel={() => setShowSealConfirmation(false)}
            onConfirm={confirmSeal}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
          Private draft
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-4xl leading-tight text-rose-950">
          For Shosho — I’m Sorry
        </h1>
        <p className="mt-3 max-w-prose text-base leading-7 text-stone-600">
          Write this in your own words. Save whenever you need, and only seal it when it says what you truly mean.
        </p>
      </header>

      <div className="space-y-4">
        <LetterField
          label="I’m sorry."
          helper="Say what happened clearly, without excuses."
          maxLength={apologyLetterConfig.maxApologyLength}
          value={draft.apology}
          onChange={(value) => updateField("apology", value)}
        />
        <LetterField
          label="What I should have done."
          helper="Write what you believe you should have done differently."
          maxLength={apologyLetterConfig.maxReflectionLength}
          value={draft.shouldHaveDone}
          onChange={(value) => updateField("shouldHaveDone", value)}
        />
        <LetterField
          label="What I’m changing."
          helper="Focus on actions and boundaries, not promises you cannot prove with words alone."
          maxLength={apologyLetterConfig.maxReflectionLength}
          value={draft.whatImChanging}
          onChange={(value) => updateField("whatImChanging", value)}
        />

        <section className="rounded-[1.5rem] bg-white/86 p-5 shadow-[0_14px_36px_rgba(113,50,69,0.09)] ring-1 ring-rose-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-display)] text-2xl text-rose-950">
                What I want to do better.
              </h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                Add one to six concrete commitments. These are words to live by, not tasks for Shosho to monitor.
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-rose-400">
              {draft.commitments.length}/{apologyLetterConfig.maxCommitments}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {draft.commitments.map((commitment, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-sm font-semibold text-rose-700">
                  {index + 1}
                </span>
                <textarea
                  aria-label={`Commitment ${index + 1}`}
                  value={commitment}
                  maxLength={apologyLetterConfig.maxCommitmentLength}
                  onChange={(event) => updateCommitment(index, event.target.value)}
                  rows={3}
                  placeholder={getCommitmentPlaceholder(index)}
                  className="min-h-24 min-w-0 flex-1 resize-y rounded-2xl bg-rose-50/45 px-4 py-3 text-base leading-6 text-stone-800 outline-none ring-1 ring-rose-100 placeholder:text-stone-400 focus:ring-2 focus:ring-rose-300"
                />
                {draft.commitments.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeCommitment(index)}
                    aria-label={`Remove commitment ${index + 1}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-rose-500 ring-1 ring-rose-100"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {draft.commitments.length < apologyLetterConfig.maxCommitments ? (
            <button
              type="button"
              onClick={addCommitment}
              className="mt-4 min-h-11 rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-100"
            >
              Add commitment
            </button>
          ) : null}
        </section>
      </div>

      {message ? <FeedbackMessage message={message} /> : null}
      {errorMessage ? <FeedbackMessage message={errorMessage} error /> : null}

      <div className="grid gap-3 pb-1 sm:grid-cols-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy}
          className="min-h-12 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 disabled:opacity-55"
        >
          {isSaving ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={openPreview}
          disabled={isBusy}
          className="min-h-12 rounded-2xl bg-rose-100 px-5 py-3 text-sm font-semibold text-rose-900 disabled:opacity-55"
        >
          Preview Letter
        </button>
        <button
          type="button"
          onClick={requestSeal}
          disabled={isBusy}
          className="min-h-12 rounded-2xl bg-rose-950 px-5 py-3 text-sm font-semibold text-rose-50 shadow-md shadow-rose-950/15 disabled:opacity-55"
        >
          Seal My Letter 💌
        </button>
      </div>

      {showSealConfirmation ? (
        <SealConfirmation
          isPublishing={isPublishing}
          onCancel={() => setShowSealConfirmation(false)}
          onConfirm={confirmSeal}
        />
      ) : null}
    </div>
  );
}

function LetterField({
  helper,
  label,
  maxLength,
  onChange,
  value
}: {
  helper: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block rounded-[1.5rem] bg-white/86 p-5 shadow-[0_14px_36px_rgba(113,50,69,0.09)] ring-1 ring-rose-100">
      <span className="block font-[var(--font-display)] text-2xl text-rose-950">
        {label}
      </span>
      <span className="mt-1 block text-sm leading-6 text-stone-500">{helper}</span>
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        rows={7}
        className="mt-4 min-h-44 w-full resize-y rounded-2xl bg-rose-50/45 px-4 py-3 text-base leading-7 text-stone-800 outline-none ring-1 ring-rose-100 placeholder:text-stone-400 focus:ring-2 focus:ring-rose-300"
      />
    </label>
  );
}

function SealConfirmation({
  isPublishing,
  onCancel,
  onConfirm
}: {
  isPublishing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-rose-950/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seal-letter-title"
        className="w-full max-w-sm rounded-[1.75rem] bg-[#fffdfb] p-5 shadow-2xl ring-1 ring-rose-100"
      >
        <h2 id="seal-letter-title" className="font-[var(--font-display)] text-3xl text-rose-950">
          Seal this letter?
        </h2>
        <p className="mt-3 text-base leading-7 text-stone-600">
          Once you leave this for Shosho, treat these words as final. Make sure they say what you truly mean.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPublishing}
            className="min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-600 ring-1 ring-stone-200 disabled:opacity-55"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPublishing}
            className="min-h-12 rounded-2xl bg-rose-950 px-4 py-3 text-sm font-semibold text-rose-50 disabled:opacity-55"
          >
            {isPublishing ? "Sealing…" : "Seal Letter"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackMessage({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium leading-6 ring-1 ${
        error
          ? "bg-rose-50 text-rose-800 ring-rose-200"
          : "bg-white/85 text-stone-600 ring-rose-100"
      }`}
    >
      {message}
    </p>
  );
}

function getCommitmentPlaceholder(index: number): string {
  const examples = [
    "Protect our boundaries even when you’re not there.",
    "Tell you the truth even when I’m afraid of the consequence.",
    "Stop situations before they become something I have to apologize for.",
    "Remember that keeping your trust matters more than temporary attention."
  ];

  return examples[index] ?? "Write one clear action you intend to keep.";
}
