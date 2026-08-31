"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { apologyLetterConfig, isApologySender } from "@/lib/apologyLetterConfig";
import {
  hasOpenedApologyLocally,
  subscribeToApologyLetter,
  subscribeToApologyPublication,
  type ApologyLetter,
  type ApologyLetterPublication
} from "@/lib/apologyLetterService";

type ApologyHomeCardProps = {
  currentUser: User;
};

export function ApologyHomeCard({ currentUser }: ApologyHomeCardProps) {
  const router = useRouter();
  const [letter, setLetter] = useState<ApologyLetter | null>(null);
  const [publication, setPublication] = useState<ApologyLetterPublication | null>(null);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    setHasOpened(hasOpenedApologyLocally());

    if (isApologySender(currentUser.uid)) {
      return subscribeToApologyLetter(
        currentUser.uid,
        setLetter,
        (error) => console.error("[Apology letter] Home status sync failed", error)
      );
    }

    if (currentUser.uid === apologyLetterConfig.toUid) {
      return subscribeToApologyPublication(
        currentUser.uid,
        setPublication,
        (error) => console.error("[Apology letter] Home invitation sync failed", error)
      );
    }

    return undefined;
  }, [currentUser.uid]);

  const isSender = isApologySender(currentUser.uid);

  if (!isSender && !publication) {
    return null;
  }

  const title = isSender ? "For Shosho" : "For Shosho 💌";
  const description = isSender
    ? letter?.status === "published"
      ? "Your letter is sealed."
      : letter
        ? "Your private draft is waiting."
        : "A quiet place to write what you need to say."
    : hasOpened
      ? "A letter from Yuyu."
      : "Something Yuyu needs to tell you.";
  const buttonLabel = isSender
    ? letter?.status === "published"
      ? "View sealed letter"
      : letter
        ? "Continue writing"
        : "Write private letter"
    : hasOpened
      ? "Read again"
      : "Open when you’re ready";

  return (
    <section className="mt-5 rounded-[1.5rem] bg-[#fffdfb]/90 px-4 py-4 shadow-[0_14px_34px_rgba(113,50,69,0.1)] ring-1 ring-rose-100/90">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-xl ring-1 ring-rose-100"
          aria-hidden="true"
        >
          💌
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.17em] text-rose-400">
            {isSender ? "Private letter" : "From Yuyu"}
          </p>
          <h2 className="mt-0.5 font-[var(--font-display)] text-2xl leading-tight text-rose-950">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-stone-600">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push(apologyLetterConfig.route)}
        className="mt-3 min-h-11 w-full rounded-2xl bg-rose-950 px-4 py-2 text-sm font-semibold text-rose-50 shadow-sm shadow-rose-950/15"
      >
        {buttonLabel}
      </button>
    </section>
  );
}
