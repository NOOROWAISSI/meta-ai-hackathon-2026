import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/discover/demo-data";
import { toStudentProfile } from "@/lib/preparation/adapters";
import {
  budgetFor,
  confirmedBlocker,
  currentResource,
  reliableDeadline,
  validateCandidate,
  validatePlan,
} from "@/lib/preparation/logic";
import { preparationRepository } from "@/lib/preparation/repository";
import { mockPreparationService } from "@/lib/preparation/service";
import {
  closeStore,
  exportStore,
  initializeStore,
  readRecord,
  transaction,
  updateRecord,
} from "@/lib/storage/database";
import type { Opportunity, Plan, PlanCandidateOutput, SubmissionState } from "@/lib/contract/types";
import { demoProfileService } from "@/test/fixtures/profile-service";
import canonicalFixture from "@/lib/contract/sample-payload.json";

const editor = {
  ...DEFAULT_PROFILE,
  version: 1,
  weeklyHours: 5,
  goals: ["Prepare a prototype walkthrough"],
  skills: ["Python"],
};
async function ready() {
  await updateRecord("nextstep.profile", DEFAULT_PROFILE, () => editor);
  return preparationRepository.load("aurora-ai");
}
async function draft() {
  const bundle = await ready();
  const output = await mockPreparationService.generate(
    {
      expectedSourceRevision: bundle.context.sourceRevision,
      profile: bundle.profile,
      submission: bundle.submission,
    },
    bundle.opportunity,
    [],
  );
  return { bundle, output };
}
async function accepted() {
  const { bundle, output } = await draft();
  const plan = await preparationRepository.accept({
    opportunityId: "aurora-ai",
    context: bundle.context,
    candidate: output,
    goalIds: bundle.profile.goals.map((g) => g.id),
    baseVersion: null,
    operationId: crypto.randomUUID(),
  });
  return { bundle, output, plan };
}
function datedOpportunity(opportunity: Opportunity, instant: string): Opportunity {
  return {
    ...opportunity,
    informationFreshness: "current",
    sourceEvidence: [
      {
        id: "deadline-evidence",
        sourceUrl: "https://organizer.test/rules",
        sourceSection: "Submission",
        status: "reviewed",
        passage: "Test-only reviewed submission deadline",
        checkedAt: new Date().toISOString(),
      },
    ],
    timelineEvents: [
      {
        id: "submission-close",
        kind: "submission_close",
        sourceStatus: "reviewed",
        claims: [
          {
            id: "deadline-claim",
            publishedText: "Test deadline",
            dateTime: instant,
            timeZone: "UTC",
            evidenceIds: ["deadline-evidence"],
          },
        ],
      },
    ],
  };
}

describe("canonical preparation and transactional progress", () => {
  it("loads fictional sample progress without replacing an existing plan or profile", async () => {
    const { plan } = await accepted();
    const before = await readRecord("nextstep.profile", DEFAULT_PROFILE);
    const sample = await preparationRepository.loadSamplePlan();
    expect(sample.context.opportunityId).toBe("tidewater-climate");
    expect(validatePlan(sample)).toBe(true);
    expect(sample.tasks.map((task) => task.status)).toEqual([
      "done",
      "in_progress",
      "not_started",
      "not_started",
    ]);
    expect(sample.tasks[0]!.remainingEstimatedHours).toBe(0);
    expect(sample.tasks.every((task) => task.resourceIds.length === 0)).toBe(true);
    expect((await preparationRepository.load("aurora-ai")).plan).toEqual(plan);
    expect(await readRecord("nextstep.profile", DEFAULT_PROFILE)).toEqual(before);
  });
  it("reads the supplied v0.2 fixture with the canonical Plan fields", () => {
    expect(validatePlan(canonicalFixture.plan)).toBe(true);
    expect(canonicalFixture.plan.context.profileVersion).toBe(canonicalFixture.profile.version);
    expect(canonicalFixture.plan.taskOrder).toEqual(
      canonicalFixture.plan.tasks.map((task) => task.id),
    );
    expect(canonicalFixture.resources).toEqual([]);
    expect(
      canonicalFixture.opportunity.sourceEvidence.every((source) => source.status === "unverified"),
    ).toBe(true);
  });
  it("ignores a delayed candidate at acceptance after newer profile facts arrive", async () => {
    const { bundle } = await draft();
    const pending = mockPreparationService.generate(
      {
        expectedSourceRevision: bundle.context.sourceRevision,
        profile: bundle.profile,
        submission: bundle.submission,
      },
      bundle.opportunity,
      [],
    );
    await demoProfileService.save({ ...editor, skills: ["React"] }, editor);
    const late = await pending;
    await expect(
      preparationRepository.accept({
        opportunityId: "aurora-ai",
        context: bundle.context,
        candidate: late,
        goalIds: bundle.profile.goals.map((g) => g.id),
        baseVersion: null,
        operationId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Context changed");
    expect((await preparationRepository.list()).length).toBe(0);
  });
  it("does not pad another plan after all accepted tasks are completed", async () => {
    let { plan } = await accepted();
    for (const id of plan.taskOrder)
      plan = await preparationRepository.progress({
        opportunityId: "aurora-ai",
        planId: plan.id,
        baseVersion: plan.version,
        taskId: id,
        status: "done",
        operationId: crypto.randomUUID(),
      });
    const bundle = await preparationRepository.load("aurora-ai");
    const output = await mockPreparationService.generate(
      {
        expectedSourceRevision: bundle.context.sourceRevision,
        profile: bundle.profile,
        submission: bundle.submission,
        previousPlan: plan,
      },
      bundle.opportunity,
      [],
    );
    expect(output.tasks).toEqual([]);
    const next = await preparationRepository.accept({
      opportunityId: "aurora-ai",
      context: bundle.context,
      candidate: output,
      goalIds: bundle.profile.goals.map((g) => g.id),
      baseVersion: plan.version,
      operationId: crypto.randomUUID(),
    });
    expect(next.tasks).toEqual(plan.tasks);
    expect(next.feasibility).toBe("no_remaining_gap");
  });
  it("retains started tasks and artifacts during a remaining-work refresh", async () => {
    let { plan } = await accepted();
    const id = plan.tasks[0]!.id;
    plan = await preparationRepository.progress({
      opportunityId: "aurora-ai",
      planId: plan.id,
      baseVersion: plan.version,
      taskId: id,
      status: "in_progress",
      artifactUrls: ["https://example.org/student-draft"],
      operationId: crypto.randomUUID(),
    });
    const bundle = await preparationRepository.load("aurora-ai");
    const output = await mockPreparationService.generate(
      {
        expectedSourceRevision: bundle.context.sourceRevision,
        profile: bundle.profile,
        submission: bundle.submission,
        previousPlan: plan,
      },
      bundle.opportunity,
      [],
    );
    expect(output.tasks.some((task) => task.title === plan.tasks[0]!.title)).toBe(false);
    const next = await preparationRepository.accept({
      opportunityId: "aurora-ai",
      context: bundle.context,
      candidate: output,
      goalIds: bundle.profile.goals.map((g) => g.id),
      baseVersion: plan.version,
      operationId: crypto.randomUUID(),
    });
    expect(next.tasks.find((task) => task.id === id)).toEqual(plan.tasks[0]);
  });
  it("keeps typed unknown availability distinct from zero", () => {
    expect(toStudentProfile(DEFAULT_PROFILE).availableHoursPerWeek).toEqual({ state: "unknown" });
    expect(
      toStudentProfile({ ...DEFAULT_PROFILE, weeklyHours: 0 }).availableHoursPerWeek,
    ).toMatchObject({ state: "known", value: 0 });
  });
  it("uses only a reviewed unambiguous submission instant, never registration dates", async () => {
    const { bundle } = await draft();
    expect(reliableDeadline(bundle.opportunity)).toBeNull();
    const time = new Date(Date.now() + 7 * 86400000).toISOString();
    const dated = datedOpportunity(bundle.opportunity, time);
    expect(reliableDeadline(dated)).toBe(time);
    expect(
      reliableDeadline({
        ...dated,
        timelineEvents: [{ ...dated.timelineEvents[0]!, sourceStatus: "conflicting" }],
      }),
    ).toBeNull();
    expect(
      reliableDeadline({
        ...dated,
        timelineEvents: [{ ...dated.timelineEvents[0]!, kind: "registration_close" }],
      }),
    ).toBeNull();
    expect(
      reliableDeadline({
        ...dated,
        timelineEvents: [
          {
            ...dated.timelineEvents[0]!,
            claims: [{ ...dated.timelineEvents[0]!.claims[0]!, dateTime: "2026-11-10" }],
          },
        ],
      }),
    ).toBeNull();
  });
  it("rejects model IDs, progress, invented resource IDs and must-priority goal tasks", async () => {
    const { bundle, output } = await draft();
    expect(() =>
      validateCandidate(
        { ...output, tasks: [{ ...output.tasks[0]!, id: "model-task" }] },
        bundle.profile,
        bundle.opportunity,
        [],
      ),
    ).toThrow("Invalid");
    expect(() =>
      validateCandidate(
        { ...output, tasks: [{ ...output.tasks[0]!, priority: "must" }] },
        bundle.profile,
        bundle.opportunity,
        [],
      ),
    ).toThrow("Invalid");
    expect(() =>
      validateCandidate(
        { ...output, tasks: [{ ...output.tasks[0]!, resourceIds: ["made-up-course"] }] },
        bundle.profile,
        bundle.opportunity,
        [],
      ),
    ).toThrow("Invalid");
    expect(() =>
      validateCandidate(
        { ...output, tasks: [{ ...output.tasks[0]!, estimatedHours: NaN }] },
        bundle.profile,
        bundle.opportunity,
        [],
      ),
    ).toThrow("Invalid");
  });
  it("does not store candidates until acceptance; acceptance is retry-safe", async () => {
    const { bundle, output } = await draft();
    expect((await preparationRepository.list()).length).toBe(0);
    const input = {
      opportunityId: "aurora-ai",
      context: bundle.context,
      candidate: output,
      goalIds: bundle.profile.goals.map((g) => g.id),
      baseVersion: null,
      operationId: crypto.randomUUID(),
    };
    const plan = await preparationRepository.accept(input);
    const retry = await preparationRepository.accept(input);
    expect(retry).toEqual(plan);
    expect(validatePlan(plan)).toBe(true);
    expect(plan.taskOrder).toEqual(plan.tasks.map((t) => t.id));
    expect(plan.tasks.every((t) => t.resourceIds.length === 0)).toBe(true);
    expect(plan.feasibility).toBe("untimed");
  });
  it("keeps a failed acceptance draft from overwriting an existing accepted plan", async () => {
    const { bundle, output, plan } = await accepted();
    await expect(
      preparationRepository.accept({
        opportunityId: "aurora-ai",
        context: bundle.context,
        candidate: output,
        goalIds: bundle.profile.goals.map((g) => g.id),
        baseVersion: plan.version,
        operationId: crypto.randomUUID(),
        fail: true,
      }),
    ).rejects.toThrow("storage failure");
    expect((await preparationRepository.load("aurora-ai")).plan).toEqual(plan);
  });
  it("commits Done with zero remaining effort and retains estimates, submission and profile facts", async () => {
    const { plan } = await accepted();
    const beforeProfile = await readRecord("nextstep.profile", DEFAULT_PROFILE);
    const beforeSubmission = await readRecord<SubmissionState | null>("submission:aurora-ai", null);
    const task = plan.tasks[0]!;
    const input = {
      opportunityId: "aurora-ai",
      planId: plan.id,
      baseVersion: plan.version,
      taskId: task.id,
      status: "done" as const,
      operationId: crypto.randomUUID(),
    };
    const updated = await preparationRepository.progress(input);
    const retry = await preparationRepository.progress(input);
    expect(retry.version).toBe(updated.version);
    expect(updated.tasks[0]).toMatchObject({
      status: "done",
      remainingEstimatedHours: 0,
      estimatedHours: task.estimatedHours,
    });
    expect(updated.budget.remainingEffortHours).toBe(
      plan.budget.remainingEffortHours - task.estimatedHours,
    );
    expect(await readRecord("nextstep.profile", DEFAULT_PROFILE)).toEqual(beforeProfile);
    expect(await readRecord("submission:aurora-ai", null)).toEqual(beforeSubmission);
    await closeStore();
    expect((await preparationRepository.load("aurora-ai")).plan?.tasks[0]?.status).toBe("done");
  });
  it("allows only one simultaneous writer for the same base plan version", async () => {
    const { plan } = await accepted();
    const task = plan.tasks[0]!;
    const base = {
      opportunityId: "aurora-ai",
      planId: plan.id,
      baseVersion: plan.version,
      taskId: task.id,
    };
    const outcomes = await Promise.allSettled([
      preparationRepository.progress({
        ...base,
        status: "in_progress",
        operationId: crypto.randomUUID(),
      }),
      preparationRepository.progress({ ...base, status: "done", operationId: crypto.randomUUID() }),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await preparationRepository.load("aurora-ai")).plan?.version).toBe(plan.version + 1);
  });
  it("rolls back a multi-record transaction when a write fails", async () => {
    const { plan } = await accepted();
    const beforeProgress = await readRecord(`progress:${plan.id}`, null);
    await expect(
      transaction<void>("readwrite", (store) => {
        store.put({ ...plan, version: 999 }, "plan:aurora-ai");
        store.put({ saveState: "saving" }, `progress:${plan.id}`);
        throw new Error("simulated quota");
      }),
    ).rejects.toThrow("simulated quota");
    expect((await preparationRepository.load("aurora-ai")).plan).toEqual(plan);
    expect(await readRecord(`progress:${plan.id}`, null)).toEqual(beforeProgress);
  });
  it("rejects stale candidates after profile, source or submission changes", async () => {
    const { bundle, output } = await draft();
    const input = {
      opportunityId: "aurora-ai",
      context: bundle.context,
      candidate: output,
      goalIds: bundle.profile.goals.map((g) => g.id),
      baseVersion: null,
      operationId: crypto.randomUUID(),
    };
    await demoProfileService.save({ ...editor, weeklyHours: 6 }, editor);
    await expect(preparationRepository.accept(input)).rejects.toThrow("Context changed");
    const fresh = await preparationRepository.load("aurora-ai");
    await updateRecord<SubmissionState>("submission:aurora-ai", fresh.submission, (current) => ({
      ...current,
      version: current.version + 1,
    }));
    await expect(
      preparationRepository.accept({ ...input, context: fresh.context }),
    ).rejects.toThrow("Context changed");
    const after = await preparationRepository.load("aurora-ai");
    await updateRecord<Opportunity>("opportunity:aurora-ai", after.opportunity, (current) => ({
      ...current,
      sourceRevision: "next-revision",
    }));
    await expect(
      preparationRepository.accept({ ...input, context: after.context }),
    ).rejects.toThrow("Context changed");
    expect((await preparationRepository.list()).length).toBe(0);
  });
  it("preserves completed tasks and artifacts across accepted replacements", async () => {
    const { bundle, output, plan } = await accepted();
    const done = await preparationRepository.progress({
      opportunityId: "aurora-ai",
      planId: plan.id,
      baseVersion: plan.version,
      taskId: plan.tasks[0]!.id,
      status: "done",
      artifactUrls: ["https://example.org/student-artifact"],
      operationId: crypto.randomUUID(),
    });
    const replacement = await preparationRepository.accept({
      opportunityId: "aurora-ai",
      context: bundle.context,
      candidate: output,
      goalIds: bundle.profile.goals.map((g) => g.id),
      baseVersion: done.version,
      operationId: crypto.randomUUID(),
    });
    expect(replacement.tasks.find((t) => t.id === done.tasks[0]!.id)).toEqual(done.tasks[0]);
  });
  it("keeps unknown dates untimed, zero hours infeasible, and zero remaining work separate", async () => {
    const { plan } = await accepted();
    expect(budgetFor(plan.tasks, null, null).feasibility).toBe("untimed");
    expect(budgetFor(plan.tasks, 0, null).feasibility).toBe("infeasible");
    expect(budgetFor(plan.tasks, 5, new Date(Date.now() + 60000).toISOString()).feasibility).toBe(
      "infeasible",
    );
    expect(
      budgetFor(plan.tasks, 10, new Date(Date.now() + 7 * 86400000).toISOString()).feasibility,
    ).toBe("fits_reported_budget");
    expect(
      budgetFor(
        plan.tasks.map((t) => ({ ...t, status: "done", remainingEstimatedHours: 0 })),
        0,
        null,
      ).feasibility,
    ).toBe("no_remaining_gap");
  });
  it("refuses closed submission windows and reviewed hard blockers", async () => {
    const { bundle } = await draft();
    const closed = datedOpportunity(bundle.opportunity, new Date(Date.now() - 1000).toISOString());
    const request = {
      expectedSourceRevision: bundle.context.sourceRevision,
      profile: bundle.profile,
      submission: bundle.submission,
    };
    await expect(mockPreparationService.generate(request, closed, [])).rejects.toThrow("closed");
    const blocked: Opportunity = {
      ...closed,
      timelineEvents: [],
      requirements: [
        {
          ...bundle.opportunity.requirements[0]!,
          sourceStatus: "reviewed",
          sourceEvidenceIds: ["deadline-evidence"],
          evaluation: { key: "team_bound", bound: "minimum", count: 3 },
        },
      ],
    };
    const solo = {
      ...bundle.profile,
      entrantType: {
        state: "known" as const,
        value: "individual" as const,
        reportedAt: new Date().toISOString(),
      },
    };
    expect(confirmedBlocker(blocked, solo)).not.toBeNull();
    await expect(
      mockPreparationService.generate({ ...request, profile: solo }, blocked, []),
    ).rejects.toThrow("cannot be bypassed");
  });
  it("withholds stale, unverified and fictional resource links", () => {
    expect(
      currentResource({
        id: "one",
        title: "Fictional",
        url: "https://example.org/course",
        relevanceNote: "Synthetic",
        status: "reviewed",
        checkedAt: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(
      currentResource({
        id: "two",
        title: "Old",
        url: "https://learning.test/course",
        relevanceNote: "Test",
        status: "stale",
        checkedAt: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(
      currentResource({
        id: "three",
        title: "Unknown",
        url: "https://learning.test/course",
        relevanceNote: "Test",
        status: "unverified",
        checkedAt: null,
      }),
    ).toBe(false);
  });
  it("adjustment previews and cancellation do not mutate; acceptance protects completed history", async () => {
    const { plan } = await accepted();
    await preparationRepository.progress({
      opportunityId: "aurora-ai",
      planId: plan.id,
      baseVersion: plan.version,
      taskId: plan.tasks[0]!.id,
      status: "done",
      operationId: crypto.randomUUID(),
      artifactUrls: ["https://example.org/artifact"],
    });
    const bundle = await preparationRepository.load("aurora-ai");
    const before = structuredClone(bundle.plan!);
    const preview = await mockPreparationService.adjustment(bundle);
    expect((await preparationRepository.load("aurora-ai")).plan).toEqual(before);
    const changed = await preparationRepository.adjust("aurora-ai", preview);
    expect(changed.tasks.find((t) => t.id === before.tasks[0]!.id)).toEqual(before.tasks[0]);
    await expect(preparationRepository.adjust("aurora-ai", preview)).rejects.toThrow(
      "version conflict",
    );
  });
  it("migrates accepted legacy progress once, preserving Done and original effort", async () => {
    localStorage.setItem("nextstep.profile", JSON.stringify(editor));
    localStorage.setItem(
      "nextstep.plan.aurora-ai",
      JSON.stringify({
        eventId: "aurora-ai",
        title: "Old plan",
        context: "older",
        weeklyHours: 5,
        tasks: [
          {
            id: "old-task",
            title: "Build a prototype",
            deliverable: "A small example",
            completionCriteria: "Explain it",
            hours: 2,
            status: "done",
          },
        ],
      }),
    );
    await initializeStore();
    const plan = (await preparationRepository.load("aurora-ai")).plan!;
    expect(plan.tasks[0]).toMatchObject({
      id: "old-task",
      status: "done",
      estimatedHours: 2,
      remainingEstimatedHours: 0,
    });
    expect(plan.feasibility).toBe("no_remaining_gap");
    expect(localStorage.getItem("nextstep.plan.aurora-ai")).toBeNull();
    expect((await exportStore()).records["legacy-backup:nextstep.plan.aurora-ai"]).toBeDefined();
  });
});
