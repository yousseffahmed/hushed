"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import { getUserDisplayName } from "@/lib/coupleUsers";
import { validateWeddingFiles, validateWeddingInput, weddingTypes, type WeddingMoment, type WeddingMomentInput } from "@/lib/weddingTimeline";
import { createWeddingMoment, removeWeddingPhoto, updateWeddingMoment, uploadWeddingPhotos, weddingError } from "@/lib/weddingTimelineService";
import { WeddingIcon } from "./WeddingIcon";
import { WeddingSheet } from "./WeddingSheet";

export function WeddingMomentEditor({ moment, userId, onClose, onSaved }: {
  moment?: WeddingMoment; userId: string; onClose: () => void; onSaved: (id: string) => void;
}) {
  const [value, setValue] = useState<WeddingMomentInput>(moment ?? {
    title: "", subtitle: "", description: "", eventDate: null, plannedDate: null, status: "completed", type: "other"
  });
  const [note, setNote] = useState(moment?.notesByUid[userId]?.text ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const savedId = useRef(moment?.id);
  const photos = (moment?.photos ?? []).filter((photo) => !removed.includes(photo.id) && !deleted.includes(photo.id));
  const set = <K extends keyof WeddingMomentInput>(key: K, next: WeddingMomentInput[K]) => setValue((current) => ({ ...current, [key]: next }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    let wordsSaved = false;
    try {
      const input = validateWeddingInput(value);
      validateWeddingFiles(files, photos.length);
      if (savedId.current) await updateWeddingMoment(savedId.current, input, note);
      else savedId.current = await createWeddingMoment(input, note);
      wordsSaved = true;
      for (const id of removed) {
        await removeWeddingPhoto(savedId.current, id);
        setDeleted((current) => [...current, id]);
        setRemoved((current) => current.filter((entry) => entry !== id));
      }
      if (files.length) {
        setProgress(0);
        await uploadWeddingPhotos(savedId.current, files, setProgress);
        setFiles([]);
      }
      onSaved(savedId.current);
    } catch (failure) {
      setError(`${wordsSaved ? "Your words are saved. " : ""}${weddingError(failure)}`);
    } finally { lock.current = false; setBusy(false); setProgress(null); }
  }

  return <WeddingSheet title={moment ? "Keep this moment close" : "A new page in our story"} onClose={onClose} busy={busy}>
    <form className="wedding-form" onSubmit={save}>
      <fieldset disabled={busy}>
        <label>What shall we call it?<input required maxLength={120} value={value.title} onChange={(e) => set("title", e.target.value)} /></label>
        <div className="wedding-status-picker" aria-label="Moment status">
          {([['completed', 'It happened'], ['upcoming', 'Still to come']] as const).map(([status, label]) =>
            <button type="button" key={status} aria-pressed={value.status === status} onClick={() => set("status", status)}>{value.status === status && <Check size={16} />}{label}</button>)}
        </div>
        {value.status === "completed" ? <label>The date<input type="date" required min="1900-01-01" max="2200-12-31" value={value.eventDate ?? ""} onChange={(e) => set("eventDate", e.target.value || null)} /></label> :
          <label>A date to look forward to <small>(optional)</small><input type="date" min="1900-01-01" max="2200-12-31" value={value.plannedDate ?? ""} onChange={(e) => set("plannedDate", e.target.value || null)} /></label>}
        <fieldset className="wedding-type-picker"><legend>A little chapter about...</legend>
          <div>{weddingTypes.map((type) => <label key={type.value}>
            <input type="radio" name="moment-type" value={type.value} checked={value.type === type.value} onChange={() => set("type", type.value)} />
            <span><WeddingIcon type={type.value} size={19} />{type.label}</span>
          </label>)}</div>
        </fieldset>
        <label>A little caption <small>(optional)</small><input maxLength={240} value={value.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></label>
        <label>The whole story <small>(optional)</small><textarea rows={4} maxLength={10000} value={value.description} onChange={(e) => set("description", e.target.value)} /></label>
        <section className="wedding-upload" aria-label="Photos">
          <div className="wedding-upload-heading"><h3>Photographs to keep</h3><small>{photos.length + files.length} / 10</small></div>
          <div className="wedding-preview-grid">
            {photos.map((photo, index) => <div className="wedding-preview" key={photo.id}>
              <Image src={photo.url} alt={`${value.title}, photograph ${index + 1}`} fill sizes="140px" />
              <button type="button" title="Remove photo" aria-label={`Remove photograph ${index + 1}`} onClick={() => setRemoved((current) => [...current, photo.id])}><X size={16} /></button>
            </div>)}
            {files.map((file, index) => <PhotoPreview key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => setFiles((current) => current.filter((_, i) => i !== index))} />)}
          </div>
          <label className="wedding-photo-input"><ImagePlus size={20} /> Choose our photos
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => {
              const next = Array.from(event.target.files ?? []);
              try { validateWeddingFiles([...files, ...next], photos.length); setFiles((current) => [...current, ...next]); setError(""); }
              catch (failure) { setError(failure instanceof Error ? failure.message : "These photos could not be added."); }
              event.target.value = "";
            }} />
          </label>
          <p className="wedding-fine-print">Up to 10 photos, 5 MB each. JPG, PNG, WebP, GIF or AVIF.</p>
        </section>
        <label>{getUserDisplayName(userId)} remembers... <small>(optional)</small><textarea rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </fieldset>
      {error && <p className="wedding-error" role="alert">{error}</p>}
      {progress !== null && <div className="wedding-progress" role="status"><progress max={100} value={progress} />Keeping our photos safe... {progress}%</div>}
      <div className="wedding-form-actions"><button type="button" className="wedding-text-button" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="wedding-button" disabled={busy}>{busy ? <LoaderCircle size={18} className="wedding-spin" /> : <Check size={18} />}{busy ? "Saving our moment..." : moment ? "Keep these changes" : "Add to our forever"}</button>
      </div>
    </form>
  </WeddingSheet>;
}

function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return <div className="wedding-preview">{url && <Image unoptimized src={url} alt={file.name} fill sizes="140px" />}
    <button type="button" title="Remove photo" aria-label={`Remove ${file.name}`} onClick={onRemove}><X size={16} /></button>
  </div>;
}
