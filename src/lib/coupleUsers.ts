export const SHOSHO_USER_ID = "xLUPD71OGYfG4NByDz0buh8ZIsy2";
export const YUYU_USER_ID = "orPQHip5ooOtfSSkyLYhl5hx9Kg1";

export const coupleUsers = {
  allowedUserIds: [SHOSHO_USER_ID, YUYU_USER_ID],
  displayNames: {
    [SHOSHO_USER_ID]: "Shosho",
    [YUYU_USER_ID]: "Yuyu"
  }
} as const;

export function getUserDisplayName(uid: string | null | undefined): string {
  if (!uid) {
    return "Someone";
  }

  return coupleUsers.displayNames[uid as keyof typeof coupleUsers.displayNames] ?? "Someone";
}
