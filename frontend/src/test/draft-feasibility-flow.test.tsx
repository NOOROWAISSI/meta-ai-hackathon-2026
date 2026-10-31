import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountPreparation } from "@/components/account/AccountPlans";
import { accountApi, type SubmissionCoverageView } from "@/lib/account/api";
import fixture from "@/lib/contract/sample-payload.json";
import frozen from "@/test/fixtures/frozen-ai-candidates.json";
import liveQuality from "../../../ai/dotnet/NextStep.MetaAi.Checks/Fixtures/live-quality-1084027.json";
import type {
  AssessmentContext,
  Opportunity,
  Plan,
  PlanCandidateOutput,
  PreparationTask,
  StudentProfile,
  SubmissionState,
} from "@/lib/contract/types";
import type { PreparationBundle } from "@/lib/preparation/logic";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ ready: true, user: { id: "feasibility-test-account" } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

let query: QueryClient;
let opportunity: Opportunity;
let profile: StudentProfile;
let submission: SubmissionState;
let context: AssessmentContext;
let savedPlan: Plan | null;
const candidate = liveQuality.candidates["beginner-limited"] as PlanCandidateOutput;
const report = (candidateId: string | null): SubmissionCoverageView => ({
  context,
  planVersion: savedPlan?.version ?? null,
  candidateId,
  planOutdated: false,
  report: {
    reviewedOutstandingMandatoryRequirementIds: [],
    candidateRequirementIds: [],
    retainedRequirementIds: [],
    unrepresentedRequirementIds: [],
    sourceCoverage: "incomplete",
  },
  unresolvedRequirementIds: [],
});

beforeEach(() => {
  savedPlan = null;
  const now = new Date();
  opportunity = {
    ...fixture.opportunity,
    id: "E01",
    informationFreshness: "current",
    requirements: [],
    sourceEvidence: [
      {
        id: "time-evidence",
        sourceUrl: "https://example.invalid/rules",
        sourceSection: "Test timing",
        status: "reviewed",
        passage: "Synthetic reviewed deadline",
        checkedAt: now.toISOString(),
      },
    ],
    timelineEvents: [
      {
        id: "close",
        kind: "submission_close",
        sourceStatus: "reviewed",
        claims: [
          {
            id: "close-claim",
            publishedText: "Synthetic closing time",
            dateTime: new Date(now.getTime() + 14 * 86400000).toISOString(),
            evidenceIds: ["time-evidence"],
          },
        ],
      },
    ],
  } as Opportunity;
  profile = {
    ...fixture.profile,
    availableHoursPerWeek: { state: "known", value: 2, reportedAt: now.toISOString() },
    goals: [
      {
        id: "g-beginner",
        statement: "Build and demonstrate a simple task tracker with a clear user journey",
      },
    ],
  } as StudentProfile;
  submission = { ...fixture.submission, opportunityId: "E01", items: [] } as SubmissionState;
  context = {
    opportunityId: "E01",
    profileId: profile.id,
    profileVersion: profile.version,
    sourceRevision: opportunity.sourceRevision,
    submissionVersion: submission.version,
  };
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Network forbidden in offline replay"))),
  );
  vi.spyOn(accountApi, "opportunity").mockResolvedValue(opportunity);
  vi.spyOn(accountApi, "profile").mockResolvedValue(profile);
  vi.spyOn(accountApi, "submission").mockResolvedValue(submission);
  vi.spyOn(accountApi, "plans").mockResolvedValue([]);
  vi.spyOn(accountApi, "resources").mockResolvedValue([]);
  vi.spyOn(accountApi, "analyze").mockResolvedValue({
    context,
    participationSummary: "needs_verification",
    submissionSummary: "needs_verification",
    phases: [],
    matches: [],
    warnings: [],
  });
  vi.spyOn(accountApi, "generate").mockResolvedValue({
    candidateId: "draft-test",
    output: candidate,
  });
  vi.spyOn(accountApi, "submissionCoverage").mockImplementation(async (_id, id) =>
    report(id ?? null),
  );
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function showDraft() {
  render(
    <QueryClientProvider client={query}>
      <AccountPreparation opportunityId="E01" />
    </QueryClientProvider>,
  );
  const first = await screen.findByRole("button", {
    name: /^(Generate preparation draft|Review a new preparation draft)$/,
  });
  if (first.textContent?.includes("Review a new")) fireEvent.click(first);
  fireEvent.click(await screen.findByRole("button", { name: "Generate preparation draft" }));
  await screen.findByRole("heading", { name: "Review your preparation draft." });
  return screen.getByRole("complementary", { name: "Time and workload preview" });
}

it("discloses the frozen 9h beginner workload against about 4h before explicit acceptance", async () => {
  const original = structuredClone(candidate);
  const accept = vi.spyOn(accountApi, "accept");
  const preview = await showDraft();
  expect(preview).toHaveTextContent("More work than available time");
  for (const [label, value] of [
    ["New tasks", "9h"],
    ["Retained work remaining", "0h"],
    ["Total estimated workload", "9h"],
    ["Available hours", "4h"],
    ["Estimated shortfall", "5h"],
  ]) {
    expect(within(preview).getByText(label!).parentElement).toHaveTextContent(value!);
  }
  expect(preview).toHaveTextContent(/smaller optional scope|more preparation time/i);
  expect(preview).toHaveTextContent(/preview|provisional/i);
  for (const text of [
    "minimum demo scope",
    "critical path",
    "unfamiliar skills",
    "keep every mandatory requirement and retained task visible",
    "Update your goal or reported availability in Profile",
    "reconsider this opportunity",
    "not a replacement plan or a claim",
  ])
    expect(preview).toHaveTextContent(text);
  await waitFor(() => expect(screen.getByRole("button", { name: "Accept plan" })).toBeEnabled());
  expect(accept).not.toHaveBeenCalled();
  expect(candidate).toEqual(original);
  expect(fetch).not.toHaveBeenCalled();
});

function retainTasks(unknownRemaining = false) {
  const task = (
    id: string,
    status: PreparationTask["status"],
    remaining: number,
    artifactUrls: string[] = [],
  ): PreparationTask => ({
    id,
    title: id,
    target: { kind: "goal", goalId: "g-beginner" },
    priority: "should",
    deliverable: "Existing deliverable",
    completionCriteria: "Existing criteria",
    estimatedHours: 10,
    remainingEstimatedHours: remaining,
    status,
    artifactUrls,
    resourceIds: [],
  });
  const tasks = [
    task("done-original-id", "done", 0, ["https://example.invalid/done"]),
    task(
      "started-original-id",
      "in_progress",
      unknownRemaining ? (undefined as unknown as number) : 3,
    ),
    task("artifact-original-id", "not_started", 2, ["https://example.invalid/artifact"]),
    task("replaceable-id", "not_started", 100),
  ];
  savedPlan = { ...fixture.plan, context, tasks, taskOrder: tasks.map((t) => t.id) } as Plan;
  vi.mocked(accountApi.plans).mockResolvedValue([savedPlan]);
}

it("includes retained effort and preserves saved records after a failed explicit acceptance", async () => {
  retainTasks();
  const before = structuredClone(savedPlan);
  const accept = vi
    .spyOn(accountApi, "accept")
    .mockRejectedValue(new Error("Synthetic save failure"));
  const preview = await showDraft();
  expect(within(preview).getByText("Retained work remaining").parentElement).toHaveTextContent(
    "5h",
  );
  expect(within(preview).getByText("Total estimated workload").parentElement).toHaveTextContent(
    "14h",
  );
  const button = screen.getByRole("button", { name: "Accept plan" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByText("Synthetic save failure");
  expect(accept).toHaveBeenCalledWith("E01", "draft-test", savedPlan!.version, expect.any(String));
  expect(savedPlan).toEqual(before);
  expect(screen.getByText("Draft · not an accepted plan")).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

it("shows unknown total effort when a retained estimate is missing", async () => {
  retainTasks(true);
  const preview = await showDraft();
  expect(within(preview).getByText("Retained work remaining").parentElement).toHaveTextContent(
    "Unknown",
  );
  expect(within(preview).getByText("Total estimated workload").parentElement).toHaveTextContent(
    "Unknown",
  );
  expect(preview).toHaveTextContent("Schedule fit is unknown.");
});

for (const changed of ["context", "plan version"] as const) {
  it(`hides stale assessment and disables acceptance after a ${changed} change`, async () => {
    if (changed === "plan version") retainTasks();
    const preview = await showDraft();
    act(() =>
      query.setQueryData<PreparationBundle>(
        ["account", "feasibility-test-account", "preparation", "E01"],
        (old) =>
          old
            ? changed === "context"
              ? {
                  ...old,
                  context: { ...old.context, profileVersion: old.context.profileVersion + 1 },
                }
              : { ...old, plan: { ...old.plan!, version: old.plan!.version + 1 } }
            : old,
      ),
    );
    await waitFor(() => expect(preview).toHaveTextContent("Workload preview unavailable."));
    expect(within(preview).queryByText("Available hours")).toBeNull();
    expect(
      within(preview).queryByRole("heading", { name: "Before committing to this workload" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Accept plan" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
}

for (const [id, hours, days, effort, status] of [
  ["mandatory-missing", 6, 21, "12h", "Within estimated capacity"],
  ["experienced", 10, 28, "39h", "Within estimated capacity"],
  ["existing-progress", 7, 21, "15h", "Within estimated capacity"],
  ["unknown-facts", null, null, "2h", "Schedule fit is unknown"],
  ["approved-resources", 5, null, "10h", "Schedule fit is unknown"],
] as const) {
  it(`replays frozen ${id} candidate without a live provider`, async () => {
    const output = frozen.candidates[id] as PlanCandidateOutput;
    const before = structuredClone(output);
    profile.availableHoursPerWeek =
      hours === null
        ? { state: "unknown" }
        : { state: "known", value: hours, reportedAt: new Date().toISOString() };
    if (days === null) opportunity.timelineEvents = [];
    else
      opportunity.timelineEvents[0]!.claims[0]!.dateTime = new Date(
        Date.now() + days * 86400000,
      ).toISOString();
    vi.mocked(accountApi.generate).mockResolvedValue({ candidateId: "draft-test", output });
    const preview = await showDraft();
    expect(preview).toHaveTextContent(status);
    expect(within(preview).getByText("New tasks").parentElement).toHaveTextContent(effort);
    for (const task of output.tasks)
      expect(screen.getByRole("heading", { name: task.title })).toBeVisible();
    expect(screen.getByText(output.explanation)).toBeVisible();
    expect(output).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  });
}

for (const phase of ["draft", "done"] as const) {
  it(`keeps delivery and confirmation review explicit for the exact AI-01 response in ${phase} state`, async () => {
    const output = liveQuality.candidates["mandatory-missing"] as PlanCandidateOutput;
    const before = structuredClone(output);
    opportunity.requirements = [
      {
        id: "req-demo-video",
        statement:
          "Mandatory submission: record and submit a demonstration video of the working prototype; this item is currently missing.",
        kind: "submission_mandatory",
        lane: "submission",
        isMandatory: true,
        subject: "project",
        applicability: { key: "all" },
        evaluation: { key: "submission_criterion", criterion: "presence", parameters: {} },
        claims: [],
        sourceEvidenceIds: ["time-evidence"],
        sourceStatus: "reviewed",
      },
    ];
    submission.items = [
      {
        requirementId: "req-demo-video",
        state: "missing",
        criterionResults: { presence: "reported_not_met" },
        evidenceLevel: "self_report",
      },
    ];
    const originalEvidence = structuredClone(submission);
    vi.mocked(accountApi.generate).mockResolvedValue({ candidateId: "draft-test", output });
    vi.mocked(accountApi.submissionCoverage).mockImplementation(async (_id, id) => ({
      ...report(id ?? null),
      report: {
        ...report(id ?? null).report,
        reviewedOutstandingMandatoryRequirementIds: ["req-demo-video"],
        candidateRequirementIds: phase === "draft" ? ["req-demo-video"] : [],
        retainedRequirementIds: phase === "done" ? ["req-demo-video"] : [],
        unrepresentedRequirementIds: [],
      },
    }));
    const accept = vi.spyOn(accountApi, "accept");
    const progress = vi.spyOn(accountApi, "progress");
    if (phase === "done") {
      const tasks: PreparationTask[] = output.tasks.map((t, i) => ({
        ...t,
        id: `original-${i}`,
        status: "done",
        remainingEstimatedHours: 0,
        artifactUrls: [],
      }));
      savedPlan = { ...fixture.plan, context, tasks, taskOrder: tasks.map((t) => t.id) } as Plan;
      vi.mocked(accountApi.plans).mockResolvedValue([savedPlan]);
      render(
        <QueryClientProvider client={query}>
          <AccountPreparation opportunityId="E01" />
        </QueryClientProvider>,
      );
    } else await showDraft();
    const review = await screen.findByLabelText("Mandatory action review");
    for (const text of [
      "then send or upload the artifact when ready",
      "Check the actual receipt or confirmation",
      "A file ready to submit is still unsent",
      "Unknown instructions or missing confirmation remain unresolved",
      "it does not confirm portal submission or eligibility",
    ])
      expect(review).toHaveTextContent(text);
    expect(screen.getByText(opportunity.requirements[0]!.statement)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText(/0 reviewed outstanding requirements/)).toBeVisible(),
    );
    expect(screen.getByRole("combobox", { name: "Your reported evidence" })).toHaveValue("missing");
    expect(submission).toEqual(originalEvidence);
    expect(output).toEqual(before);
    expect(accept).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
}
