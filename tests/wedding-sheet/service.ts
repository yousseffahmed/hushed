// In-memory boundary for layout tests. No Firebase SDK, credentials or writes.
import type { WeddingMoment, WeddingMomentInput } from "../../src/lib/weddingTimeline";
import { SHOSHO_USER_ID, YUYU_USER_ID } from "../../src/lib/coupleUsers";

export const fixture: WeddingMoment = {
  id: "layout-test", title: "A moment worth keeping", subtitle: "A layout test, not a saved memory.",
  description: "A long story to exercise the full scrolling region.\n\n".repeat(24),
  eventDate: "2026-09-01", plannedDate: null, status: "completed", type: "rings",
  createdByUid: SHOSHO_USER_ID, createdByName: "Shosho", createdAt: "", updatedAt: "", deleting: false,
  photos: [
    { id: "one", url: "/images/wedding-ribbon.png", storagePath: "fixture/one" },
    { id: "two", url: "/apple-touch-icon.png", storagePath: "fixture/two" }
  ],
  notesByUid: {
    [SHOSHO_USER_ID]: { text: "Shosho's test perspective. ".repeat(25), updatedAt: "" },
    [YUYU_USER_ID]: { text: "Yuyu's test perspective. ".repeat(25), updatedAt: "" }
  }
};
let moment = structuredClone(fixture);
export const getMoment = () => structuredClone(moment);
function notify() { window.dispatchEvent(new Event("test-moment-updated")); }
export async function createWeddingMoment(input: WeddingMomentInput, note: string) {
  moment = { ...getMoment(), ...input, notesByUid: { [SHOSHO_USER_ID]: { text: note, updatedAt: "" } } };
  notify(); return moment.id;
}
export async function updateWeddingMoment(_id: string, input: WeddingMomentInput, note: string) {
  moment = { ...getMoment(), ...input, notesByUid: { ...moment.notesByUid, [SHOSHO_USER_ID]: { text: note, updatedAt: "" } } };
  notify();
}
export async function saveWeddingNote(_id: string, text: string) {
  moment.notesByUid[SHOSHO_USER_ID] = { text, updatedAt: "" }; notify();
}
export async function deleteWeddingMoment() { notify(); }
export async function removeWeddingPhoto(_id: string, photoId: string) { moment.photos = moment.photos.filter((photo) => photo.id !== photoId); notify(); }
export async function uploadWeddingPhotos(_id: string, _files: File[], progress: (value: number) => void) { progress(100); }
export const weddingError = (error: unknown) => String(error);
