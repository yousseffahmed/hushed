"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getSpecial19thMediaUrl, type Special19thPackage } from "@/lib/special19thService";

type RevealedPackageCardProps = {
  packageData: Special19thPackage;
};

export function RevealedPackageCard({ packageData }: RevealedPackageCardProps) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getSpecial19thMediaUrl(packageData.photoStoragePath),
      getSpecial19thMediaUrl(packageData.voiceNoteStoragePath)
    ])
      .then(([nextPhotoUrl, nextVoiceUrl]) => {
        if (!cancelled) {
          setPhotoUrl(nextPhotoUrl);
          setVoiceUrl(nextVoiceUrl);
          setMediaError("");
        }
      })
      .catch((error) => {
        console.error("[Special 19th] Revealed package media could not load", error);

        if (!cancelled) {
          setMediaError("This package's media is taking a little longer to arrive.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [packageData.photoStoragePath, packageData.voiceNoteStoragePath]);

  return (
    <article className="overflow-hidden rounded-[2rem] bg-white/88 shadow-[0_18px_44px_rgba(176,92,112,0.15)] ring-1 ring-rose-100/90">
      <div className="flex items-center justify-between gap-4 bg-rose-950 px-5 py-4 text-rose-50">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
            Sealed with love
          </p>
          <h3 className="mt-1 font-[var(--font-display)] text-3xl">
            From {packageData.ownerName}
          </h3>
        </div>
        <span className="text-2xl" aria-hidden="true">
          💌
        </span>
      </div>

      {photoUrl ? (
        <div className="relative aspect-[4/3] w-full bg-rose-100">
          <Image
            src={photoUrl}
            alt={`${packageData.ownerName}'s package photo`}
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/2] items-center justify-center bg-rose-50 px-5 text-sm font-medium text-stone-500">
          Opening the photo...
        </div>
      )}

      <div className="space-y-4 p-5">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            A letter for you
          </p>
          <p className="mt-2 whitespace-pre-wrap font-[var(--font-display)] text-xl leading-8 text-rose-950">
            {packageData.letter}
          </p>
        </section>

        <section className="rounded-3xl bg-rose-50/80 p-4 ring-1 ring-rose-100">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            One thing I wish we were doing together
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{packageData.wish}</p>
        </section>

        <section className="rounded-3xl bg-rose-50/80 p-4 ring-1 ring-rose-100">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            One thing I love about you this month
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            {packageData.loveThisMonth}
          </p>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
            Their voice, right here
          </p>
          {voiceUrl ? (
            <audio controls preload="metadata" src={voiceUrl} className="mt-3 h-11 w-full" />
          ) : (
            <p className="mt-2 text-sm font-medium text-stone-500">Opening the voice note...</p>
          )}
        </section>

        {mediaError ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {mediaError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
