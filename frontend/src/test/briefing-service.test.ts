import { afterEach, expect, it, vi } from "vitest";
import { briefingContext, metaBriefingService, validateBriefing } from "@/lib/catalog/briefing";
import type { ListingSummary } from "@/lib/catalog/service";
import type { StudentProfile } from "@/lib/contract/types";
import fixture from "@/lib/contract/sample-payload.json";
afterEach(() => vi.unstubAllGlobals());
it("uses only the authenticated application endpoint, never provider credentials", async () => {
  const listing = { id: "selected-event" } as ListingSummary;
  const context = briefingContext(
    listing,
    fixture.profile as StudentProfile,
    "en",
    "reviewed-revision",
  );
  const reply = {
    context,
    overview: "Event",
    personalRelevance: "Related interests",
    preparationPriorities: [],
    questionsToClarify: [],
    sources: [{ label: "Organizer", url: "https://example.invalid/event" }],
    generatedAt: "2026-10-31T00:00:00Z",
  };
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(reply), { status: 200 }));
  vi.stubGlobal("fetch", request);
  const value = await metaBriefingService.explain(
    { listing, context },
    new AbortController().signal,
  );
  expect(request.mock.calls[0]![0]).toBe("/api/listings/selected-event/briefing");
  expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ context });
  expect(validateBriefing(value, context)).toEqual(reply);
});
it("invalidates display context when the canonical source revision changes", () => {
  const listing = { id: "selected-event" } as ListingSummary;
  expect(briefingContext(listing, fixture.profile as StudentProfile, "en", "rev1")).not.toEqual(
    briefingContext(listing, fixture.profile as StudentProfile, "en", "rev2"),
  );
});
