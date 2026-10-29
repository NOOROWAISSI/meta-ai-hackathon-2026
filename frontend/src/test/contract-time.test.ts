import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isContractDate, isContractInstant, formatContractInstant } from "@/lib/contract/time";
import { reliableDeadline, validatePlan } from "@/lib/preparation/logic";
import fixture from "@/lib/contract/sample-payload.json";
import type { Opportunity } from "@/lib/contract/types";

describe("v0.2 instant and calendar semantics", () => {
  it.each([
    "2026-10-29T09:30:00Z",
    "2026-10-29T12:30:00+03:00",
    "2026-10-29T04:30:00-05:00",
    "2024-02-29T23:59:59.1234567+14:00",
  ])("accepts an explicit valid instant: %s", (value) =>
    expect(isContractInstant(value)).toBe(true),
  );
  it.each([
    "2026-10-29",
    "2026-10-29T09:30:00",
    "2026-10-29 09:30:00Z",
    "2026-02-29T09:30:00Z",
    "2026-10-29T24:00:00Z",
    "2026-10-29T09:30:60Z",
    "2026-10-29T09:30:00-00:00",
    "2026-10-29T09:30:00+14:01",
    "2026-10-29T09:30:00+0300",
    "2026-10-29T09:30:00Z\n",
    "0000-01-01T00:00:00Z",
  ])("does not infer or normalize an invalid instant: %s", (value) =>
    expect(isContractInstant(value)).toBe(false),
  );
  it("keeps a date-only preference separate from an instant", () => {
    expect(isContractDate("2024-02-29")).toBe(true);
    expect(isContractDate("2026-02-29")).toBe(false);
    expect(isContractDate("2026-10-29\n")).toBe(false);
    expect(isContractDate("2026-10-29T00:00:00Z")).toBe(false);
    expect(isContractInstant("2026-10-29")).toBe(false);
  });
  it("changes display timezone without changing the authoritative instant or original text", () => {
    const original = "2026-10-29T12:30:00+03:00";
    const instant = Date.parse(original);
    expect(instant).toBe(Date.parse("2026-10-29T09:30:00Z"));
    expect(formatContractInstant(original, "UTC")).not.toBe(
      formatContractInstant(original, "America/New_York"),
    );
    expect(original).toBe("2026-10-29T12:30:00+03:00");
    expect(Date.parse(original)).toBe(instant);
  });
  it("keeps ambiguous/conflicting deadlines unknown without rewriting source claims", () => {
    const opportunity = {
      ...fixture.opportunity,
      informationFreshness: "current",
      sourceEvidence: [
        {
          id: "date-source",
          sourceUrl: "https://example.invalid/rules",
          sourceSection: "Deadline",
          passage: "Published cutoff",
          status: "reviewed",
          checkedAt: "2026-10-28T09:00:00Z",
        },
      ],
      timelineEvents: [
        {
          id: "deadline",
          kind: "submission_close",
          sourceStatus: "reviewed",
          claims: [
            {
              id: "claim",
              publishedText: "29 October",
              dateTime: "2026-10-29",
              timeZone: "Asia/Hebron",
              evidenceIds: ["date-source"],
            },
          ],
        },
      ],
    } as unknown as Opportunity;
    const before = JSON.stringify(opportunity);
    expect(reliableDeadline(opportunity)).toBeNull();
    expect(JSON.stringify(opportunity)).toBe(before);
    const exact = structuredClone(opportunity);
    exact.timelineEvents[0]!.claims[0]!.dateTime = "2026-10-29T09:30:00Z";
    expect(reliableDeadline(exact)).toBe("2026-10-29T09:30:00Z");
    exact.timelineEvents[0]!.sourceStatus = "conflicting";
    expect(reliableDeadline(exact)).toBeNull();
    exact.timelineEvents[0]!.sourceStatus = "reviewed";
    exact.sourceEvidence[0]!.checkedAt = "2026-10-28T09:00:00";
    expect(reliableDeadline(exact)).toBeNull();
  });
  it("rejects offset-less budget metadata instead of silently using the host zone", () => {
    expect(
      validatePlan({
        ...fixture.plan,
        budget: { ...fixture.plan.budget, evaluatedAt: "2026-10-29T09:30:00" },
      }),
    ).toBe(false);
  });
});
it("keeps the frontend fixture semantically synchronized with the canonical docs fixture", () => {
  const file = [
    resolve(process.cwd(), "docs/fixtures/sample-payload.json"),
    resolve(process.cwd(), "../docs/fixtures/sample-payload.json"),
  ].find(existsSync);
  expect(file, "Canonical docs fixture must exist").toBeDefined();
  expect(JSON.parse(readFileSync(file!, "utf8"))).toEqual(fixture);
});
