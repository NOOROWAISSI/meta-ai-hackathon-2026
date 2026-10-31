import { afterEach, expect, it, vi } from "vitest";
import { accountApi } from "@/lib/account/api";
import { fromAccountProfile, projectAccountProfile } from "@/lib/profile/server";
import { confirmedProfile, toDraft } from "@/lib/profile/model";
import type { Opportunity, StudentProfile, SubmissionState } from "@/lib/contract/types";

afterEach(() => {
  vi.unstubAllGlobals();
});
const unknown = { state: "unknown" } as const;
const profile: StudentProfile = {
  id: "profile-real-test",
  version: 3,
  reportedAge: { state: "known", value: 21, reportedAt: "2026-10-28T00:00:00Z" },
  majority: { reached: unknown },
  enrollment: { state: "known", value: "school", reportedAt: "2026-10-28T00:00:00Z" },
  residence: { country: unknown, region: unknown },
  entrantType: unknown,
  team: { size: unknown, division: unknown, sameDivision: unknown, allMembersMeetRule: {} },
  availableHoursPerWeek: { state: "known", value: 0, reportedAt: "2026-10-28T00:00:00Z" },
  background: "Self-reported background",
  projectExperience: [{ id: "project-one", description: "My original project description" }],
  skills: [
    { id: "skill-old-id", label: "Python", state: "reported_has" },
    { id: "skill-lacks", label: "Robotics", state: "reported_lacks" },
  ],
  interests: ["AI"],
  goals: [
    { id: "goal-original-one", statement: "Prepare a prototype" },
    { id: "goal-original-two", statement: "Review the organizer checklist" },
  ],
  preferredFormats: ["online", "hybrid"],
  constraints: ["Laptop only", "Limited connectivity"],
  acceptedInterpretations: [],
  clarificationAnswers: [],
};
it("saving display metadata preserves confirmed facts and original goal/project identities", () => {
  const previous = fromAccountProfile({
    profile,
    editor: { fieldOfStudy: "Computing" },
    displayName: "Test account",
  });
  const draft = toDraft(previous);
  draft.displayName = "Updated display name";
  const projected = projectAccountProfile(confirmedProfile(draft), profile, previous);
  expect(projected.reportedAge).toEqual(profile.reportedAge);
  expect(projected.enrollment).toEqual(profile.enrollment);
  expect(projected.goals).toEqual(profile.goals);
  expect(projected.projectExperience).toEqual(profile.projectExperience);
  expect(projected.preferredFormats).toEqual(profile.preferredFormats);
  expect(projected.constraints).toEqual(profile.constraints);
  expect(projected.skills).toEqual(profile.skills);
  expect(projected.availableHoursPerWeek).toEqual(profile.availableHoursPerWeek);
});
it("uses the server candidate identifier for acceptance and the confirmed version for progress", async () => {
  const candidate = { tasks: [], explanation: "Synthetic provider response used by the test only" };
  const accepted = { id: "plan-one", version: 1, context: { opportunityId: "E02" } };
  const progressed = { ...accepted, version: 2 };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(candidate), {
        status: 200,
        headers: { "X-Candidate-Id": "server-candidate" },
      }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(accepted), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(progressed), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([progressed]), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const opportunity = { id: "E02", sourceRevision: "source-current" } as Opportunity;
  const submission = { opportunityId: "E02", version: 1, items: [] } satisfies SubmissionState;
  const draft = await accountApi.generate(opportunity, profile, submission, null);
  expect(draft.candidateId).toBe("server-candidate");
  const plan = await accountApi.accept("E02", draft.candidateId, null, "accept-operation");
  const request = JSON.parse((fetcher.mock.calls[1]![1] as RequestInit).body as string);
  expect(request).toEqual({
    candidateId: "server-candidate",
    expectedPlanVersion: null,
    operationId: "accept-operation",
  });
  expect(request).not.toHaveProperty("tasks");
  await accountApi.progress(plan, "task-owned-by-plan", "done", "progress-operation");
  expect(JSON.parse((fetcher.mock.calls[2]![1] as RequestInit).body as string)).toEqual({
    expectedVersion: 1,
    status: "done",
    operationId: "progress-operation",
  });
  expect((await accountApi.plans())[0]?.version).toBe(2);
});
it("reports an unavailable provider without creating a template candidate", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ code: "provider_unavailable", message: "Meta is not configured" }),
        { status: 503 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    accountApi.generate(
      { id: "E02", sourceRevision: "current" } as Opportunity,
      profile,
      { opportunityId: "E02", version: 1, items: [] },
      null,
    ),
  ).rejects.toThrow("Meta is not configured");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
