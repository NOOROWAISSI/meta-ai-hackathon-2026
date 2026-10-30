import { describe, expect, it } from "vitest";
import { assessDraftWorkload } from "@/lib/preparation/draft-assessment";
import type {
  Opportunity,
  Plan,
  PlanCandidateOutput,
  PreparationTask,
  StudentProfile,
  TimelineKind,
} from "@/lib/contract/types";
import fixture from "@/lib/contract/sample-payload.json";
import frozen from "@/test/fixtures/frozen-ai-candidates.json";

const now = new Date("2026-10-30T00:00:00Z");
const beginner = frozen.candidates["beginner-limited"] as PlanCandidateOutput;
function event(kind: TimelineKind, days: number): Opportunity["timelineEvents"][number] {
  return {
    id: kind,
    kind,
    sourceStatus: "reviewed",
    claims: [
      {
        id: `${kind}-claim`,
        publishedText: "Synthetic reviewed timing",
        dateTime: new Date(now.getTime() + days * 86400000).toISOString(),
        evidenceIds: ["evidence"],
      },
    ],
  };
}
function opportunity(): Opportunity {
  return {
    ...fixture.opportunity,
    informationFreshness: "current",
    sourceEvidence: [
      {
        id: "evidence",
        sourceUrl: "https://example.invalid/rules",
        sourceSection: "Test timing",
        passage: "Synthetic reviewed timing",
        checkedAt: now.toISOString(),
        status: "reviewed",
      },
    ],
    timelineEvents: [event("submission_close", 14)],
  } as Opportunity;
}
function profile(): StudentProfile {
  return {
    ...fixture.profile,
    availableHoursPerWeek: { state: "known", value: 2, reportedAt: now.toISOString() },
  } as StudentProfile;
}
function task(
  id: string,
  status: PreparationTask["status"],
  remaining: number,
  artifactUrls: string[] = [],
): PreparationTask {
  return {
    id,
    title: id,
    target: { kind: "goal", goalId: "g-beginner" },
    priority: "should",
    deliverable: "Existing work",
    completionCriteria: "Check work",
    estimatedHours: 10,
    remainingEstimatedHours: remaining,
    status,
    artifactUrls,
    resourceIds: [],
  };
}
function plan(tasks: PreparationTask[]): Plan {
  return { ...fixture.plan, tasks, taskOrder: tasks.map((t) => t.id) } as Plan;
}
const assess = (p = profile(), o = opportunity(), saved: Plan | null = null, c = beginner) =>
  assessDraftWorkload(c, saved, p, o, now);

describe("provisional draft workload", () => {
  it("retains the original 9h estimate and explains the frozen beginner shortfall", () => {
    expect(assess()).toMatchObject({
      newHours: 9,
      retainedHours: 0,
      totalHours: 9,
      availableHours: 4,
      shortfallHours: 5,
      status: "overloaded",
      assumesStartNow: true,
    });
  });
  it("recognizes feasible work without altering estimates", () => {
    expect(
      assess(
        profile(),
        opportunity(),
        null,
        frozen.candidates["unknown-facts"] as PlanCandidateOutput,
      ),
    ).toMatchObject({
      newHours: 2,
      totalHours: 2,
      availableHours: 4,
      shortfallHours: 0,
      status: "within_capacity",
    });
  });
  it("preserves unknown weekly availability instead of treating it as zero", () => {
    expect(assess({ ...profile(), availableHoursPerWeek: { state: "unknown" } })).toMatchObject({
      newHours: 9,
      availableHours: null,
      shortfallHours: null,
      status: "unknown",
      uncertainties: ["hours"],
    });
  });
  it("preserves unknown deadlines", () => {
    expect(assess(profile(), { ...opportunity(), timelineEvents: [] })).toMatchObject({
      availableHours: null,
      status: "unknown",
      uncertainties: ["deadline"],
    });
  });
  for (const state of ["unverified", "conflicting", "stale"] as const) {
    it(`withholds capacity for a ${state} submission event`, () => {
      const o = opportunity();
      o.timelineEvents[0]!.sourceStatus = state;
      expect(assess(profile(), o)).toMatchObject({ availableHours: null, status: "unknown" });
    });
  }
  it("does not broaden existing deadline trust for needs-verification sources", () => {
    expect(
      assess(profile(), { ...opportunity(), informationFreshness: "needs_verification" }),
    ).toMatchObject({ availableHours: null, status: "unknown" });
  });
  it("rejects offset-less reviewed timing", () => {
    const o = opportunity();
    o.timelineEvents[0]!.claims[0]!.dateTime = "2026-11-13T00:00:00";
    expect(assess(profile(), o).availableHours).toBeNull();
  });
  it("counts only retained work without changing IDs, status, artifacts or estimates", () => {
    const saved = plan([
      task("done", "done", 0, ["https://example.invalid/done"]),
      task("started", "in_progress", 3),
      task("linked", "not_started", 2, ["https://example.invalid/draft"]),
      task("replaceable", "not_started", 100),
    ]);
    const before = structuredClone({ saved, beginner });
    expect(assess(profile(), opportunity(), saved)).toMatchObject({
      newHours: 9,
      retainedHours: 5,
      totalHours: 14,
      availableHours: 4,
      shortfallHours: 10,
    });
    expect({ saved, beginner }).toEqual(before);
  });
  it("does not invent zero hours for missing retained estimates", () => {
    const saved = plan([task("started", "in_progress", undefined as unknown as number)]);
    expect(assess(profile(), opportunity(), saved)).toMatchObject({
      newHours: 9,
      retainedHours: null,
      totalHours: null,
      availableHours: 4,
      shortfallHours: null,
      status: "unknown",
      uncertainties: ["retained"],
    });
  });
  it("starts capacity at a reviewed future build start, not today", () => {
    const o = opportunity();
    o.timelineEvents.push(event("build_start", 7));
    expect(assess(profile(), o)).toMatchObject({
      availableHours: 2,
      shortfallHours: 7,
      futureBuildStart: "2026-11-06T00:00:00.000Z",
      assumesStartNow: false,
    });
  });
  it("uses now when the reviewed build has already started", () => {
    const o = opportunity();
    o.timelineEvents.push(event("build_start", -7));
    expect(assess(profile(), o)).toMatchObject({ availableHours: 4, futureBuildStart: null });
  });
  it("does not use optimistic capacity for an unreviewed start", () => {
    const o = opportunity();
    o.timelineEvents.push({ ...event("build_start", 7), sourceStatus: "unverified" });
    expect(assess(profile(), o)).toMatchObject({
      availableHours: null,
      status: "unknown",
      uncertainties: ["build_start"],
    });
  });
  it("does not infer which of multiple build-start events is authoritative", () => {
    const o = opportunity();
    o.timelineEvents.push(event("build_start", 7), event("build_start", 8));
    expect(assess(profile(), o)).toMatchObject({ availableHours: null, status: "unknown" });
  });
  it("does not create capacity when the start is after the deadline", () => {
    const o = opportunity();
    o.timelineEvents.push(event("build_start", 15));
    expect(assess(profile(), o)).toMatchObject({
      availableHours: 0,
      shortfallHours: 9,
      status: "overloaded",
    });
  });
  it("keeps the strict frontend comparison provisional near the server tolerance", () => {
    const c = { ...beginner, tasks: [{ ...beginner.tasks[0]!, estimatedHours: 4.01 }] };
    expect(assess(profile(), opportunity(), null, c)).toMatchObject({
      availableHours: 4,
      status: "overloaded",
    });
  });
});
