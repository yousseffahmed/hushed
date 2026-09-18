"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function WeddingSheet({ title, onClose, busy = false, children }: {
  title: string; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      dialog?.style.setProperty("--sheet-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog?.style.setProperty("--sheet-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      dialog?.close();
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className="wedding-sheet wedding-theme" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="wedding-sheet-inner">
        <header className="wedding-sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="wedding-icon-button" aria-label="Close" title="Close" disabled={busy} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
