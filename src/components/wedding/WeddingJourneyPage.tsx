"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, Heart, Plus, RefreshCw } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { coupleUsers } from "@/lib/coupleUsers";
import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";
import type { WeddingMoment } from "@/lib/weddingTimeline";
import { subscribeToWeddingMoments, weddingError } from "@/lib/weddingTimelineService";
import { WeddingTimeline } from "./WeddingTimeline";
import { WeddingMomentEditor } from "./WeddingMomentEditor";
import { WeddingMomentDetail } from "./WeddingMomentDetail";

export function WeddingJourneyPage() {
  const [uid, setUid] = useState<string | null | undefined>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isFirebaseConfigured()) { setError("Firebase needs to be configured before opening our story."); setUid(null); return; }
    return onAuthStateChanged(getFirebaseServices().auth, (user) => setUid(user?.uid ?? null), () => { setError("Sign in again to open our story."); setUid(null); });
  }, []);
  if (uid && coupleUsers.allowedUserIds.some((allowed) => allowed === uid)) return <WeddingStory key={uid} userId={uid} />;
  return <main className="wedding-page wedding-theme"><div className="wedding-auth">
    <Link className="wedding-text-button" href="/"><ArrowLeft size={18} /> Back home</Link>
    {uid === undefined ? <p role="status">Opening our story...</p> : uid ? <p>This story is private to Yuyu and Shosho.</p> : <AuthCard variant="screen" onError={setError} />}
    {error && <p className="wedding-error" role="alert">{error}</p>}
  </div></main>;
}

function WeddingStory({ userId }: { userId: string }) {
  const [moments, setMoments] = useState<WeddingMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<WeddingMoment | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const moment = moments.find((entry) => entry.id === selected);
  useEffect(() => {
    setLoading(true); setError("");
    return subscribeToWeddingMoments((next) => { setMoments(next); setLoading(false); }, (failure) => { setError(weddingError(failure)); setLoading(false); });
  }, [retry]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const add = () => { setSelected(null); setEditor("new"); };
  return <main className="wedding-page wedding-theme">
    <nav className="wedding-nav" aria-label="Wedding journey"><Link href="/" className="wedding-icon-button" aria-label="Back home" title="Back home"><ArrowLeft size={20} /></Link><span>yushef <Heart size={12} /></span><button type="button" className="wedding-icon-button" title="Add a moment" aria-label="Add a moment" onClick={add} disabled={loading || Boolean(error)}><Plus size={21} /></button></nav>
    {loading ? <div className="wedding-loading" role="status"><Heart className="wedding-loading-heart" size={32} /><p>Unfolding our story...</p></div> : error ? <section className="wedding-load-error"><p role="alert">{error}</p><button className="wedding-button" type="button" onClick={() => setRetry((n) => n + 1)}><RefreshCw size={17} /> Try again</button></section> : <WeddingTimeline moments={moments} onOpen={setSelected} onAdd={add} />}
    {!loading && !error && moments.length > 0 && <button className="wedding-button wedding-floating-add" type="button" onClick={add}><Plus size={18} /> Add a moment</button>}
    {notice && <p className="wedding-toast" role="status"><Heart size={16} />{notice}</p>}
    {editor && <WeddingMomentEditor userId={userId} moment={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={(id) => { setEditor(null); setSelected(id); setNotice("Another little piece of forever, kept."); }} />}
    {!editor && moment && <WeddingMomentDetail key={moment.id} moment={moment} userId={userId} onClose={() => setSelected(null)} onEdit={() => setEditor(moment)} onRemoved={() => { setSelected(null); setNotice("The moment was removed from our story."); }} />}
  </main>;
}
