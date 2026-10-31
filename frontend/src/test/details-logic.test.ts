import { describe, expect, it } from "vitest";
import { askOpportunity } from "@/lib/details/api";
import {
  analysisContext,
  evaluateRequirement,
  hasHardBlocker,
  reliableTargetDeadline,
  startTimeInZone,
} from "@/lib/details/logic";
import { buildEventDetails } from "@/lib/details/records";
import type { Requirement } from "@/lib/details/types";
import { DEFAULT_PROFILE, DEMO_HACKATHONS } from "@/lib/discover/demo-data";

const solo = { ...DEFAULT_PROFILE, entrantType: "solo" as const, teamSize: 1 };
const rule: Requirement = {
  id: "min",
  lane: "participation",
  statement: "At least two entrants",
  mandatory: true,
  rule: "team-min",
  value: 2,
  passage: "Synthetic reviewed fixture",
  sourceUrl: "https://example.org/aurora-ai",
  sourceStatus: "reviewed-demo",
};

describe("event details and independent fit lanes", () => {
  it("never converts an unverified or stale rule into a confirmed failure", () => {
    expect(evaluateRequirement({ ...rule, sourceStatus: "unverified" }, solo).status).toBe(
      "Unknown",
    );
    expect(evaluateRequirement({ ...rule, sourceStatus: "stale" }, solo).status).toBe("Unknown");
    expect(evaluateRequirement({ ...rule, sourceStatus: "conflicting" }, solo).status).toBe(
      "Source conflict",
    );
  });
  it("evaluates explicit reviewed conditions without promoting submission or skill outcomes", () => {
    const failed = evaluateRequirement(rule, solo);
    expect(failed.status).toBe("Not met");
    expect(hasHardBlocker([failed])).toBe(true);
    expect(hasHardBlocker([{ ...failed, requirement: { ...rule, lane: "submission" } }])).toBe(
      false,
    );
    expect(evaluateRequirement(rule, { ...solo, entrantType: "team", teamSize: 3 }).status).toBe(
      "Supported",
    );
    expect(evaluateRequirement(rule, DEFAULT_PROFILE).status).toBe("Unknown");
    expect(evaluateRequirement({ ...rule, value: 1 }, solo).status).toBe("Not applicable");
  });
  it("preserves the five existing events and does not invent benefits or milestones", () => {
    for (const event of DEMO_HACKATHONS) expect(buildEventDetails(event.id)?.event).toEqual(event);
    expect(buildEventDetails("aurora-ai")?.benefits).toEqual([
      "Mentor office hours",
      "API credits",
    ]);
    expect(buildEventDetails("tidewater-climate")?.benefits).toEqual([]);
    expect(buildEventDetails("orbit-games")?.timeline.map((milestone) => milestone.id)).toEqual([
      "event-start",
    ]);
    expect(buildEventDetails("not-an-event")).toBeNull();
  });
  it("keeps registration separate and refuses uncertain deadline/time conversions", () => {
    const details = buildEventDetails("aurora-ai")!;
    expect(reliableTargetDeadline(details)).toBeNull();
    expect(startTimeInZone(details, "UTC")).toBe("Not specified");
    const timed = {
      ...details,
      sourceState: "reviewed-demo" as const,
      submissionDeadline: "2026-11-16T18:00:00+02:00",
      startInstant: "2026-11-14T09:00:00+02:00",
      originalZone: "Asia/Hebron",
    };
    expect(reliableTargetDeadline(timed)).toBe(timed.submissionDeadline);
    expect(startTimeInZone(timed, "UTC")).toContain("7:00");
    expect(startTimeInZone({ ...timed, sourceState: "conflicting" }, "UTC")).toBe("Not specified");
    expect(reliableTargetDeadline({ ...timed, submissionDeadline: "2026-11-16" })).toBeNull();
    expect(reliableTargetDeadline({ ...timed, sourceState: "stale" })).toBeNull();
  });
  it("versions analysis context when profile facts or source revision change", () => {
    const details = buildEventDetails("aurora-ai")!;
    expect(analysisContext(details, solo)).not.toBe(
      analysisContext(details, { ...solo, skills: ["React"] }),
    );
    expect(analysisContext(details, solo)).not.toBe(
      analysisContext({ ...details, revision: "next" }, solo),
    );
  });
  it("keeps an unknown solo answer unknown and anchors the answer to the selected event", async () => {
    const details = buildEventDetails("pulse-health")!;
    const result = await askOpportunity(details, solo, "Can I participate on my own?");
    expect(result.answer).toContain("not specified");
    expect(result.sourceUrl).toBe(details.event.sourceUrl);
  });
});
