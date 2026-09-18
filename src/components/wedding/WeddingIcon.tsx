import { CalendarHeart, Diamond, Heart, House, Moon, NotebookPen, PartyPopper, PenLine, Plane, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import type { WeddingType } from "@/lib/weddingTimeline";

const icons: Record<WeddingType, LucideIcon> = {
  proposal: Heart, family: UsersRound, rings: Diamond, engagement: Sparkles,
  home: House, planning: NotebookPen, event: PartyPopper, katb_ketab: PenLine,
  henna: Moon, wedding: CalendarHeart, honeymoon: Plane, other: Heart
};

export function WeddingIcon({ type, size = 22 }: { type: WeddingType; size?: number }) {
  const Icon = icons[type] ?? Heart;
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
