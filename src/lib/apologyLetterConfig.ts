import { coupleConfig } from "@/lib/coupleConfig";
import { SHOSHO_USER_ID, YUYU_USER_ID } from "@/lib/coupleUsers";

export const apologyLetterConfig = {
  coupleId: coupleConfig.coupleId,
  letterId: "apology-shosho-2026-08-31",
  publicationId: "apology-shosho-2026-08-31",
  route: "/for-shosho",
  type: "apology",
  title: "For Shosho — I’m Sorry",
  fromUid: YUYU_USER_ID,
  fromName: "Yuyu",
  toUid: SHOSHO_USER_ID,
  toName: "Shosho",
  maxApologyLength: 12_000,
  maxReflectionLength: 8_000,
  maxCommitmentLength: 500,
  maxCommitments: 6,
  openedStorageKey: "yushef:apology-shosho-2026-08-31:opened"
} as const;

export function isApologyParticipant(uid: string): boolean {
  return uid === apologyLetterConfig.fromUid || uid === apologyLetterConfig.toUid;
}

export function isApologySender(uid: string): boolean {
  return uid === apologyLetterConfig.fromUid;
}

export function isApologyRecipient(uid: string): boolean {
  return uid === apologyLetterConfig.toUid;
}
