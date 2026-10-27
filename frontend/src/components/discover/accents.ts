import type { Accent } from "@/lib/discover/types";

// Event identity uses only the brand's steel-blue scale.
const violetStyle = {
  badge: "bg-violet-ink text-primary-foreground",
  tint: "bg-violet/7 border-violet/15",
  ink: "text-violet-ink",
  hoverBorder: "hover:border-violet/35",
};
export const ACCENTS: Record<Accent, typeof violetStyle & { strip: string }> = {
  violet: { ...violetStyle, strip: "event-cover event-cover-one" },
  teal: { ...violetStyle, strip: "event-cover event-cover-two" },
  coral: { ...violetStyle, strip: "event-cover event-cover-three" },
  amber: { ...violetStyle, strip: "event-cover event-cover-four" },
  sky: { ...violetStyle, strip: "event-cover event-cover-five" },
};
