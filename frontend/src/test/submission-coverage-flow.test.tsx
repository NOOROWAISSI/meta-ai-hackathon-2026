import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AccountPreparation } from "@/components/account/AccountPlans";
import { accountApi, type SubmissionCoverageView } from "@/lib/account/api";
import fixture from "@/lib/contract/sample-payload.json";
import type {
  Opportunity,
  StudentProfile,
  SubmissionState,
  AssessmentContext,
} from "@/lib/contract/types";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ ready: true, user: { id: "coverage-test-account" } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
const opportunity = {
  ...fixture.opportunity,
  id: "E01",
  timelineEvents: [],
} as unknown as Opportunity;
const profile = {
  ...fixture.profile,
  availableHoursPerWeek: { state: "known", value: 5, reportedAt: "2026-10-28T00:00:00Z" },
  goals: [{ id: "goal-test", statement: "Prepare a prototype" }],
} as unknown as StudentProfile;
const submission = { ...fixture.submission, opportunityId: "E01" } as unknown as SubmissionState;
const context: AssessmentContext = {
  opportunityId: "E01",
  profileId: profile.id,
  profileVersion: profile.version,
  sourceRevision: opportunity.sourceRevision,
  submissionVersion: submission.version,
};
const report = (candidateId: string | null): SubmissionCoverageView => ({
  context,
  planVersion: null,
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
let query: QueryClient;
beforeEach(() => {
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
    candidateId: "candidate-test",
    output: { tasks: [], explanation: "Synthetic test candidate only" },
  });
  vi.spyOn(accountApi, "submissionCoverage").mockImplementation(async (_id, id) =>
    report(id ?? null),
  );
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.restoreAllMocks();
});
function show() {
  return render(
    <QueryClientProvider client={query}>
      <AccountPreparation opportunityId="E01" />
    </QueryClientProvider>,
  );
}
it("waits for candidate coverage and preserves the draft on failed acceptance without implying completeness", async () => {
  let resolve!: (value: SubmissionCoverageView) => void;
  vi.mocked(accountApi.submissionCoverage).mockImplementation(async (_id, id) =>
    id
      ? await new Promise<SubmissionCoverageView>((done) => {
          resolve = done;
        })
      : report(null),
  );
  const accept = vi
    .spyOn(accountApi, "accept")
    .mockRejectedValue(new Error("Evidence changed. Reload before accepting."));
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Generate preparation draft" }));
  const button = await screen.findByRole("button", { name: "Accept plan" });
  expect(button).toBeDisabled();
  await waitFor(() => expect(resolve).toBeDefined());
  await act(async () => {
    resolve(report("candidate-test"));
  });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByText("Source coverage: incomplete")).toBeVisible();
  fireEvent.click(button);
  await screen.findByText("Evidence changed. Reload before accepting.");
  expect(accept).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Draft · not an accepted plan")).toBeVisible();
  expect(screen.queryByText("Plan accepted and confirmed in your account.")).toBeNull();
});
it("does not allow an older coverage response to authorize candidate acceptance", async () => {
  vi.mocked(accountApi.submissionCoverage).mockImplementation(async (_id, id) =>
    id
      ? { ...report(id), context: { ...context, submissionVersion: context.submissionVersion + 1 } }
      : report(null),
  );
  const accept = vi.spyOn(accountApi, "accept");
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Generate preparation draft" }));
  const button = await screen.findByRole("button", { name: "Accept plan" });
  await waitFor(() =>
    expect(accountApi.submissionCoverage).toHaveBeenCalledWith("E01", "candidate-test"),
  );
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(accept).not.toHaveBeenCalled();
});
