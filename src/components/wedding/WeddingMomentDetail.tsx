"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";
import { formatWeddingDate, momentDate, weddingTypes, type WeddingMoment } from "@/lib/weddingTimeline";
import { deleteWeddingMoment, saveWeddingNote, weddingError } from "@/lib/weddingTimelineService";
import { WeddingSheet } from "./WeddingSheet";
import { WeddingIcon } from "./WeddingIcon";

export function WeddingMomentDetail({ moment, userId, onClose, onEdit, onRemoved }: {
  moment: WeddingMoment; userId: string; onClose: () => void; onEdit: () => void; onRemoved: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const lock = useRef(false);
  const index = Math.min(photoIndex, Math.max(0, moment.photos.length - 1));
  const photo = moment.photos[index];

  async function act(action: () => Promise<void>, complete: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); complete(); }
    catch (failure) { setError(weddingError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <WeddingSheet title={confirm ? "Remove this moment?" : moment.title} onClose={onClose} busy={busy}>
    {confirm ? <div className="wedding-confirm">
      <Trash2 size={28} />
      <p>This will remove it from our wedding journey. Photos attached to this moment will also be cleaned up where possible.</p>
      {error && <p role="alert" className="wedding-error">{error}</p>}
      <div className="wedding-form-actions"><button type="button" disabled={busy} className="wedding-text-button" onClick={() => { setConfirm(false); setError(""); }}>Keep It</button>
        <button type="button" disabled={busy} className="wedding-button wedding-danger" onClick={() => act(() => deleteWeddingMoment(moment.id), onRemoved)}>{busy ? <LoaderCircle size={18} className="wedding-spin" /> : <Trash2 size={18} />}{busy ? "Removing..." : "Remove"}</button></div>
    </div> : <div className="wedding-detail">
      <p className="wedding-detail-type"><WeddingIcon type={moment.type} size={18} />{weddingTypes.find((type) => type.value === moment.type)?.label}{moment.status === "upcoming" && " / Still to come"}</p>
      <p className="wedding-date">{formatWeddingDate(momentDate(moment))}</p>
      {moment.subtitle && <p className="wedding-detail-caption">{moment.subtitle}</p>}
      {photo && <section className="wedding-gallery" aria-label="Moment photographs">
        <div className="wedding-gallery-image"><Image src={photo.url} alt={`${moment.title}, photograph ${index + 1}`} fill sizes="(min-width: 640px) 550px, 90vw" /></div>
        {moment.photos.length > 1 && <div className="wedding-gallery-controls">
          <button type="button" className="wedding-icon-button" aria-label="Previous photo" title="Previous photo" disabled={index === 0} onClick={() => setPhotoIndex(index - 1)}><ArrowLeft size={20} /></button>
          <span aria-live="polite">{index + 1} of {moment.photos.length}</span>
          <button type="button" className="wedding-icon-button" aria-label="Next photo" title="Next photo" disabled={index === moment.photos.length - 1} onClick={() => setPhotoIndex(index + 1)}><ArrowRight size={20} /></button>
        </div>}
      </section>}
      {moment.description && <p className="wedding-story-text">{moment.description}</p>}
      <div className="wedding-perspectives">
        <Heart size={18} aria-hidden="true" />
        {coupleUsers.allowedUserIds.map((uid) => <section key={uid}>
          <h3>{getUserDisplayName(uid)} remembers...</h3>
          {uid === userId && editingNote ? <form onSubmit={(event) => { event.preventDefault(); act(() => saveWeddingNote(moment.id, note), () => setEditingNote(false)); }}>
            <label className="wedding-sr-only" htmlFor="wedding-personal-note">Your personal note</label>
            <textarea id="wedding-personal-note" autoFocus rows={4} maxLength={4000} value={note} disabled={busy} onChange={(e) => setNote(e.target.value)} />
            <div className="wedding-form-actions"><button className="wedding-text-button" type="button" disabled={busy} onClick={() => setEditingNote(false)}>Cancel</button><button className="wedding-button" disabled={busy} type="submit"><Check size={17} />{busy ? "Saving..." : "Keep my words"}</button></div>
          </form> : <>
            {moment.notesByUid[uid]?.text ? <p className="wedding-story-text">{moment.notesByUid[uid].text}</p> : <p className="wedding-note-empty">{uid === userId ? "" : "A little space for their words."}</p>}
            {uid === userId && !moment.deleting && <button className="wedding-text-button" type="button" onClick={() => { setNote(moment.notesByUid[uid]?.text ?? ""); setEditingNote(true); }}><Pencil size={16} />{moment.notesByUid[uid]?.text ? "Edit my note" : "Add what you remember"}</button>}
          </>}
        </section>)}
      </div>
      {moment.deleting && <p className="wedding-error">Photo cleanup needs another try. Remove this moment again to finish.</p>}
      {error && <p className="wedding-error" role="alert">{error}</p>}
      <footer className="wedding-detail-actions">
        <button type="button" className="wedding-text-button" disabled={busy || moment.deleting} onClick={onEdit}><Pencil size={17} /> Edit moment</button>
        <button type="button" className="wedding-text-button wedding-danger-text" disabled={busy} onClick={() => { setConfirm(true); setError(""); }}><Trash2 size={17} /> Remove</button>
      </footer>
    </div>}
  </WeddingSheet>;
}
