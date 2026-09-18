"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUpRight, Heart, Infinity as InfinityIcon, Plus } from "lucide-react";
import { formatWeddingDate, momentDate, weddingTypes, type WeddingMoment } from "@/lib/weddingTimeline";
import { WeddingIcon } from "./WeddingIcon";

type Props = { moments: WeddingMoment[]; onOpen: (id: string) => void; onAdd: () => void };
type Point = { x: number; y: number };

function trailPath(points: Point[]): string {
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middle = (previous.y + point.y) / 2;
    return `${path} C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

export function WeddingTimeline({ moments, onOpen, onAdd }: Props) {
  const trail = useRef<HTMLDivElement>(null);
  const draw = useRef<SVGPathElement>(null);
  const [geometry, setGeometry] = useState({ width: 1, height: 1, path: "" });
  const completed = moments.filter((moment) => moment.status === "completed");
  const upcoming = moments.filter((moment) => moment.status === "upcoming");

  useEffect(() => {
    const root = trail.current;
    if (!root) return;
    const calculate = () => {
      const bounds = root.getBoundingClientRect();
      const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-trail-node]"));
      const points = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
      });
      setGeometry({ width: bounds.width, height: root.scrollHeight, path: trailPath(points) });
    };
    const resize = new ResizeObserver(calculate);
    resize.observe(root);
    root.querySelectorAll("[data-moment]").forEach((element) => resize.observe(element));
    calculate();
    return () => resize.disconnect();
  }, [moments]);

  useEffect(() => {
    const root = trail.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!draw.current) return;
      const bounds = root.getBoundingClientRect();
      const progress = reduced.matches ? 1 : Math.max(0, Math.min(1, (window.innerHeight * 0.68 - bounds.top) / bounds.height));
      draw.current.style.strokeDashoffset = String(1 - progress);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("wedding-in-view", entry.isIntersecting);
        if (entry.isIntersecting) entry.target.classList.add("wedding-revealed");
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    root.querySelectorAll("[data-moment]").forEach((element) => observer.observe(element));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, [geometry]);

  const renderMoment = (moment: WeddingMoment, index: number) => (
    <article key={moment.id} className={`wedding-moment ${index % 2 ? "wedding-moment-right" : ""} ${moment.status === "upcoming" ? "wedding-future-moment" : ""}`}
      data-moment style={{ "--print-angle": index % 2 ? "3deg" : "-3deg" } as CSSProperties}>
      <button type="button" className="wedding-node" data-trail-node onClick={() => onOpen(moment.id)} aria-label={`Open ${moment.title}`}>
        <WeddingIcon type={moment.type} size={24} />
      </button>
      <button type="button" className="wedding-moment-content" onClick={() => onOpen(moment.id)}>
        <span className="wedding-eyebrow">{weddingTypes.find((type) => type.value === moment.type)?.label}
          {moment.status === "upcoming" ? " / Still to come" : ""}</span>
        <span className="wedding-date">{formatWeddingDate(momentDate(moment))}</span>
        <h2>{moment.title}</h2>
        {moment.subtitle ? <p className="wedding-caption">{moment.subtitle}</p> : null}
        {moment.photos.length ? <div className={`wedding-photo-stack ${moment.photos.length > 1 ? "wedding-photo-stack-multiple" : ""}`}>
          {moment.photos.slice(0, 3).map((photo, photoIndex) => (
            <div className="wedding-print" key={photo.id} style={{ "--print-index": photoIndex } as CSSProperties}>
              <div className="wedding-print-image">
                <Image src={photo.url} alt={photoIndex === 0 ? moment.title : ""} fill sizes="(min-width: 768px) 300px, 65vw" />
              </div>
              <span aria-hidden="true">{photoIndex === 0 ? "a little closer to forever" : ""}</span>
            </div>
          ))}
          {moment.photos.length > 1 ? <span className="wedding-photo-count">{moment.photos.length} photographs</span> : null}
        </div> : null}
        {moment.deleting ? <span className="wedding-open-label">Photo cleanup needs a retry <ArrowUpRight size={15} /></span> :
          <span className="wedding-open-label">Open this moment <ArrowUpRight size={15} /></span>}
      </button>
      <span className="wedding-node-tail" data-trail-node aria-hidden="true" />
    </article>
  );

  return (
    <>
      <header className="wedding-story-header">
        <p className="wedding-eyebrow">Yuyu &amp; Shosho</p>
        <Image src="/images/wedding-ribbon.png" alt="" width={180} height={180} priority className="wedding-rings" />
        <h1>Our Road<br />to <em>Forever</em></h1>
        <p>Every little moment that brought us<br className="wedding-desktop-break" /> closer to &ldquo;I do.&rdquo;</p>
        {moments.length ? <a href="#wedding-story" className="wedding-scroll-cue">This is how we got here <ArrowDown size={16} /></a> : null}
      </header>
      <div className="wedding-trail" id="wedding-story" ref={trail}>
        <svg className="wedding-trail-svg" viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true" preserveAspectRatio="none">
          <path d={geometry.path} className="wedding-trail-base" />
          <path d={geometry.path} className="wedding-trail-ink" pathLength="1" ref={draw} />
        </svg>
        <div className="wedding-chapter wedding-then"><span data-trail-node><Heart size={17} /></span><p>{completed.length ? "The moments that brought us here" : "Our story starts with us"}</p></div>
        {completed.map(renderMoment)}
        {!moments.length ? <section className="wedding-empty">
          <p className="wedding-handwriting">A beginning worth keeping.</p>
          <h2>Every forever has<br />a first little moment.</h2>
          <p>The big yes. A nervous hello.<br />Whatever yours was, it belongs here.</p>
          <button className="wedding-button" type="button" onClick={onAdd}><Plus size={18} /> Add our first moment</button>
        </section> : null}
        <div className="wedding-chapter wedding-now"><span data-trail-node><Heart size={18} fill="currentColor" /></span><p>Now</p><small>Here we are, together.</small></div>
        {upcoming.map((moment, index) => renderMoment(moment, completed.length + index))}
        <footer className="wedding-chapter wedding-ending">
          <span data-trail-node><InfinityIcon size={26} /></span>
          <h2>And all that&apos;s<br /><em>still to come.</em></h2>
          <p>One little moment at a time.</p>
          <button type="button" className="wedding-text-button" onClick={onAdd}><Plus size={17} /> Leave a place for what&apos;s next</button>
        </footer>
      </div>
    </>
  );
}
