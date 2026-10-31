import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { isNewListing, SourceFreshness } from "@/components/catalog/SourceFreshness";
import { realCatalogService, type ListingSummary } from "@/lib/catalog/service";

vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ language: "en", t: (en: string) => en }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("labels new discoveries only within seven days of first discovery and while current", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const item = { firstSeenAt: "2026-10-28T12:00:00Z", sourceFreshness: "current" as const };
  expect(isNewListing(item, now)).toBe(true);
  expect(isNewListing({ ...item, firstSeenAt: "2026-10-20T12:00:00Z" }, now)).toBe(false);
  expect(isNewListing({ ...item, firstSeenAt: "2026-11-01T12:00:00Z" }, now)).toBe(false);
  expect(isNewListing({ ...item, availabilityState: "ended" }, now)).toBe(false);
  expect(isNewListing({ ...item, availabilityState: "cancelled" }, now)).toBe(false);
  expect(isNewListing({ ...item, sourceFreshness: "stale" }, now)).toBe(false);
});
it("shows failed-source freshness without calling an automatic check a human review", () => {
  render(
    <SourceFreshness
      item={
        {
          lastCheckedAt: "2026-10-29T12:00:00Z",
          sourceFreshness: "stale",
          availabilityState: "cancelled",
        } as ListingSummary
      }
    />,
  );
  expect(screen.getByText("Source update needed")).toBeVisible();
  expect(screen.getByText("Cancelled by organizer")).toBeVisible();
  expect(screen.getByText("Automatically checked:")).toBeVisible();
  expect(screen.queryByText(/reviewed/i)).not.toBeInTheDocument();
});
it("rejects an invalid automatic-check timestamp at the catalog service boundary", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          enabled: true,
          intervalHours: 12,
          lastAttemptAt: "2026-10-29",
          pendingReviewCount: 0,
          automaticallyDiscoveredCount: 0,
        }),
      }),
  );
  await expect(realCatalogService.collectionStatus()).rejects.toThrow();
});
