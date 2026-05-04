export const coupleUsers = {
  allowedUserIds: [
    "xLUPD71OGYfG4NByDz0buh8ZIsy2",
    "orPQHip5ooOtfSSkyLYhl5hx9Kg1"
  ],
  displayNames: {
    xLUPD71OGYfG4NByDz0buh8ZIsy2: "Shosho",
    orPQHip5ooOtfSSkyLYhl5hx9Kg1: "Yuyu"
  }
} as const;

export function getUserDisplayName(uid: string | null | undefined): string {
  if (!uid) {
    return "Someone";
  }

  return coupleUsers.displayNames[uid as keyof typeof coupleUsers.displayNames] ?? "Someone";
}
