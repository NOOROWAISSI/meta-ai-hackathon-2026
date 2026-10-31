import type { ListingSummary } from "@/lib/catalog/service";
import { useLocale } from "@/components/LocaleProvider";

export function isNewListing(
  item: Pick<ListingSummary, "firstSeenAt" | "availabilityState" | "sourceFreshness">,
  now = Date.now(),
) {
  const first = item.firstSeenAt ? Date.parse(item.firstSeenAt) : NaN;
  return (
    item.sourceFreshness === "current" &&
    item.availabilityState !== "ended" &&
    item.availabilityState !== "cancelled" &&
    Number.isFinite(first) &&
    first <= now &&
    now - first < 7 * 86400000
  );
}
export function SourceFreshness({ item }: { item: ListingSummary }) {
  const { language, t } = useLocale();
  if (!item.firstSeenAt && !item.lastCheckedAt) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs leading-6"
      aria-label={t("Source updates", "تحديثات المصدر")}
    >
      {isNewListing(item) && (
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 font-semibold text-primary">
          {t("New", "جديد")}
        </span>
      )}
      {item.availabilityState === "ended" && (
        <span className="rounded-full bg-muted px-3 py-0.5">
          {t("Event ended", "انتهت الفعالية")}
        </span>
      )}
      {item.availabilityState === "cancelled" && (
        <span className="rounded-full bg-muted px-3 py-0.5">
          {t("Cancelled by organizer", "ألغتها الجهة المنظّمة")}
        </span>
      )}
      {item.sourceFreshness === "stale" && (
        <span className="text-amber-600 dark:text-amber-300">
          {t("Source update needed", "المصدر بحاجة لتحديث")}
        </span>
      )}
      {item.lastCheckedAt && (
        <span className="text-muted-foreground">
          {t("Automatically checked:", "آخر فحص آلي:")}{" "}
          <time dateTime={item.lastCheckedAt}>
            {new Date(item.lastCheckedAt).toLocaleString(language, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </span>
      )}
    </div>
  );
}
