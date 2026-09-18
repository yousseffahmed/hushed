export const weddingTypes = [
  { value: "proposal", label: "Proposal" },
  { value: "family", label: "Family" },
  { value: "rings", label: "Rings" },
  { value: "engagement", label: "Engagement" },
  { value: "home", label: "Home" },
  { value: "planning", label: "Planning" },
  { value: "event", label: "Event" },
  { value: "katb_ketab", label: "Katb Ketab" },
  { value: "henna", label: "Henna" },
  { value: "wedding", label: "Wedding" },
  { value: "honeymoon", label: "Honeymoon" },
  { value: "other", label: "Other" }
] as const;

export type WeddingType = (typeof weddingTypes)[number]["value"];
export type WeddingStatus = "completed" | "upcoming";
export type WeddingPhoto = {
  id: string;
  storagePath: string;
  url: string;
};
export type WeddingNote = { text: string; updatedAt: string };
export type WeddingMoment = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  eventDate: string | null;
  plannedDate: string | null;
  status: WeddingStatus;
  type: WeddingType;
  createdByUid: string;
  createdByName: string;
  photos: WeddingPhoto[];
  notesByUid: Record<string, WeddingNote>;
  deleting: boolean;
  createdAt: string;
  updatedAt: string;
};
export type WeddingMomentInput = Pick<WeddingMoment,
  "title" | "subtitle" | "description" | "eventDate" | "plannedDate" | "status" | "type"
>;

export const MAX_WEDDING_PHOTOS = 10;
export const MAX_WEDDING_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_WEDDING_NOTE_LENGTH = 4000;

// A wedding date is a calendar day, not an instant. Preserve it across time zones.
export function isWeddingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1900 && year <= 2200 && date.getFullYear() === year &&
    date.getMonth() === month - 1 && date.getDate() === day;
}

export function formatWeddingDate(value: string | null): string {
  if (!value || !isWeddingDate(value)) return "A date still to come";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

export function momentDate(moment: WeddingMoment): string | null {
  return moment.status === "completed" ? moment.eventDate : moment.plannedDate;
}

export function sortWeddingMoments(moments: WeddingMoment[]): WeddingMoment[] {
  return [...moments].sort((a, b) => {
    if (a.status !== b.status) return a.status === "completed" ? -1 : 1;
    return (momentDate(a) || "9999-12-31").localeCompare(momentDate(b) || "9999-12-31") ||
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}

export function validateWeddingInput(input: WeddingMomentInput): WeddingMomentInput {
  const title = input.title.trim();
  if (!title || title.length > 120) throw new Error("Give this moment a title of up to 120 characters.");
  if (input.subtitle.length > 240 || input.description.length > 10000) {
    throw new Error("Keep the caption under 240 characters and the story under 10,000.");
  }
  if (!weddingTypes.some((type) => type.value === input.type) ||
      !["completed", "upcoming"].includes(input.status)) throw new Error("Choose a moment type and status.");
  if (input.eventDate && !isWeddingDate(input.eventDate) ||
      input.plannedDate && !isWeddingDate(input.plannedDate)) throw new Error("Choose a valid calendar date.");
  if (input.status === "completed" && !input.eventDate) throw new Error("Add the date this moment happened.");
  return { title, subtitle: input.subtitle.trim(), description: input.description.trim(),
    type: input.type, status: input.status,
    eventDate: input.status === "completed" ? input.eventDate : null,
    plannedDate: input.plannedDate || null };
}

export function validateWeddingFiles(files: File[], existingCount: number): void {
  if (files.length + existingCount > MAX_WEDDING_PHOTOS) {
    throw new Error("There is room for 10 photos in each moment.");
  }
  for (const file of files) {
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
      throw new Error("Choose JPG, PNG, WebP, GIF, or AVIF photos. Export HEIC photos as JPG first.");
    }
    if (file.size === 0 || file.size > MAX_WEDDING_PHOTO_BYTES) throw new Error("Each photo needs to be nonempty and 5 MB or smaller.");
  }
}
