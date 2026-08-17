import { coupleUsers, getUserDisplayName } from "@/lib/coupleUsers";

export const special19thConfig = {
  eventId: "2026-08-19",
  eventDate: "2026-08-19",
  eventStartIso: "2026-08-19T00:00:00+03:00",
  timeZone: "Africa/Cairo",
  title: "Our First 19th Apart",
  subtitle: "Same 19th. Different places. 💗",
  monthNumber: 17,
  revealDurationSeconds: 3,
  presenceHeartbeatMs: 20_000,
  presenceThresholdMs: 60_000,
  packagePhotoMaxBytes: 10 * 1024 * 1024,
  voiceNoteMaxBytes: 25 * 1024 * 1024,
  momentPhotoMaxBytes: 10 * 1024 * 1024
} as const;

export type Special19thUserId = (typeof coupleUsers.allowedUserIds)[number];

export function isSpecial19thUserId(uid: string): uid is Special19thUserId {
  return coupleUsers.allowedUserIds.includes(uid as Special19thUserId);
}

export function getSpecial19thPartnerId(uid: string): Special19thUserId | null {
  return coupleUsers.allowedUserIds.find((candidate) => candidate !== uid) ?? null;
}

export function hasSpecial19thDateArrived(now = Date.now()): boolean {
  return now >= new Date(special19thConfig.eventStartIso).getTime();
}

export function getSpecial19thUserName(uid: string): string {
  return getUserDisplayName(uid);
}

export function getSpecial19thUserIds(): readonly Special19thUserId[] {
  return coupleUsers.allowedUserIds;
}
