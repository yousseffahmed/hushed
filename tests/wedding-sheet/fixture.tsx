import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { WeddingMomentEditor } from "../../src/components/wedding/WeddingMomentEditor";
import { WeddingMomentDetail } from "../../src/components/wedding/WeddingMomentDetail";
import { WeddingTimeline } from "../../src/components/wedding/WeddingTimeline";
import { SHOSHO_USER_ID } from "../../src/lib/coupleUsers";
import { fixture, getMoment } from "./service";
import "../../src/components/wedding/wedding.css";

function Fixture() {
  const [mode, setMode] = useState<"new" | "view" | "edit" | "upcoming" | null>(null);
  const [moment, setMoment] = useState(getMoment);
  const [result, setResult] = useState("");
  useEffect(() => {
    const update = () => setMoment(getMoment());
    window.addEventListener("test-moment-updated", update);
    return () => window.removeEventListener("test-moment-updated", update);
  }, []);
  const complete = () => { setResult("Saved"); setMode(null); };
  return <main className="wedding-page wedding-theme">
    <nav style={{ position: "fixed", top: 0, zIndex: 10, background: "white", display: "flex", gap: 12 }}>
      <button onClick={() => setMode("new")}>New moment</button>
      <button onClick={() => setMode("view")}>View moment</button>
      <button onClick={() => setMode("edit")}>Edit fixture</button>
      <button onClick={() => setMode("upcoming")}>Upcoming</button>
    </nav>
    <p role="status">{result}</p>
    <WeddingTimeline moments={Array.from({ length: 4 }, (_, i) => ({ ...fixture, id: String(i) }))} onAdd={() => setMode("new")} onOpen={() => setMode("view")} />
    {(mode === "new" || mode === "edit") && <WeddingMomentEditor userId={SHOSHO_USER_ID} moment={mode === "edit" ? moment : undefined} onClose={() => setMode(null)} onSaved={complete} />}
    {(mode === "view" || mode === "upcoming") && <WeddingMomentDetail userId={SHOSHO_USER_ID}
      moment={mode === "upcoming" ? { ...moment, status: "upcoming", plannedDate: null, eventDate: null, photos: [], description: "", notesByUid: {} } : moment}
      onClose={() => setMode(null)} onEdit={() => setMode("edit")} onRemoved={() => { setResult("Removed"); setMode(null); }} />}
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
