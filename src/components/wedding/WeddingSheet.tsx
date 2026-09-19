"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function WeddingSheet({ title, onClose, busy = false, children }: {
  title: string; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const scroller = scrollRef.current;
    if (!dialog || !scroller) return;
    const previous = document.activeElement as HTMLElement | null;
    const { scrollX, scrollY } = window;
    const body = document.body;
    const properties = ["position", "top", "left", "width", "overflow", "paddingRight"] as const;
    const previousStyles = properties.map((property) => [property, body.style[property]] as const);
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    // Overflow alone does not lock the background when iOS pans for its keyboard.
    Object.assign(body.style, {
      position: "fixed", top: `${-scrollY}px`, left: `${-scrollX}px`, width: "100%",
      overflow: "hidden", paddingRight: `${padding + gutter}px`
    });
    const viewport = window.visualViewport;
    let frame = 0;
    const keepFocusVisible = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !scroller.contains(active) ||
            !active.matches("input, textarea, select")) return;
        const bounds = scroller.getBoundingClientRect();
        const field = active.getBoundingClientRect();
        const top = bounds.top + 12;
        const bottom = bounds.bottom - 12;
        if (field.top < top) scroller.scrollTop += field.top - top;
        else if (field.bottom > bottom) scroller.scrollTop += Math.min(field.top - top, field.bottom - bottom);
      });
    };
    const position = () => {
      // Keep CSS dvh as the baseline. The visual viewport also accounts for iOS's
      // keyboard, which can shrink the visible area without resizing the layout.
      if (!viewport || viewport.scale !== 1) {
        dialog.style.removeProperty("--sheet-height");
        dialog.style.removeProperty("--sheet-top");
        return;
      }
      const maxOffset = Math.max(0, document.documentElement.clientHeight - viewport.height);
      const top = Math.max(0, Math.min(viewport.offsetTop, maxOffset));
      dialog.style.setProperty("--sheet-height", `${viewport.height}px`);
      dialog.style.setProperty("--sheet-top", `${top}px`);
    };
    const resize = () => { position(); keepFocusVisible(); };
    position();
    dialog.showModal();
    // Focus a non-input so opening does not summon the keyboard or pan the page.
    closeRef.current?.focus({ preventScroll: true });
    dialog.scrollTop = 0;
    scroller.scrollTop = 0;
    scroller.addEventListener("focusin", keepFocusVisible);
    window.addEventListener("resize", resize);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", position);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("focusin", keepFocusVisible);
      window.removeEventListener("resize", resize);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", position);
      if (document.activeElement instanceof HTMLElement && dialog.contains(document.activeElement)) document.activeElement.blur();
      dialog.close();
      previousStyles.forEach(([property, value]) => { body.style[property] = value; });
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={ref} className="wedding-sheet wedding-theme" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="wedding-sheet-inner">
        <header className="wedding-sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} autoFocus type="button" className="wedding-icon-button" aria-label="Close" title="Close" disabled={busy} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div ref={scrollRef} className="wedding-sheet-scroll" tabIndex={0} role="region" aria-labelledby={titleId}>{children}</div>
      </div>
    </dialog>
  );
}
