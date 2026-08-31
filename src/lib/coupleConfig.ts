import { SHOSHO_USER_ID, YUYU_USER_ID } from "@/lib/coupleUsers";

export const coupleConfig = {
  appName: "yushef",
  coupleId: "yushef",
  startDate: "2025-03-19",
  anniversaryDay: 19,
  allowedUserIds: [SHOSHO_USER_ID, YUYU_USER_ID],
  coupleNames: {
    personA: "Me",
    personB: "Her"
  }
} as const;
