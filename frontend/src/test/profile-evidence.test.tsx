import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfileEvidenceWorkspace } from "@/components/profile/ProfileEvidenceWorkspace";
import { EvidenceOpportunityInsight } from "@/components/catalog/EvidenceOpportunityInsight";
import type { EvidenceView, InsightView } from "@/lib/profile/evidence";

const service = vi.hoisted(() => ({
  read: vi.fn(),
  mutate: vi.fn(),
  upload: vi.fn(),
  repositories: vi.fn(),
  compare: vi.fn(),
  savedComparison: vi.fn(),
  answer: vi.fn(),
  correctExperience: vi.fn(),
}));
vi.mock("@/lib/profile/evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/evidence")>()),
  evidenceService: service,
}));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ language: "en", t: (en: string) => en }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "student-a" } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
const source = {
  id: "cv-1",
  kind: "cv" as const,
  title: "Synthetic CV",
  url: null,
  revision: null,
  importedAt: "2026-10-31T00:00:00Z",
  chunks: [{ id: "p1", locator: "Page 1", text: "I built a scheduling application with React." }],
  warnings: ["Synthetic local test source"],
};
const initial: EvidenceView = {
  profileVersion: 2,
  workspace: { version: 1, sources: [source], confirmed: [], draft: null },
};
const drafted: EvidenceView = {
  ...initial,
  workspace: {
    ...initial.workspace,
    draft: {
      id: "draft-1",
      profileVersion: 2,
      sourcesVersion: 1,
      output: {
        facts: [
          {
            kind: "project",
            value: "Scheduling application",
            basis: "source_statement",
            explanation: "Personal contribution needs student confirmation.",
            references: [{ sourceId: "cv-1", chunkId: "p1", quote: source.chunks[0]!.text }],
          },
        ],
        questions: ["What did you personally implement?"],
      },
    },
  },
};
const insight: InsightView = {
  profileVersion: 2,
  sourcesVersion: 1,
  sourceRevision: "r1",
  analysis: {
    summary:
      "Your calendar validation work can transfer to the prototype's input flow, while model integration is still unreported.",
    connections: [
      {
        title: "Reuse your validation flow",
        explanation:
          "The confirmed React form contribution provides a specific interface to extend.",
        evidenceIds: ["fact-1"],
      },
    ],
    gaps: [
      {
        title: "Model integration unknown",
        explanation: "Your sources do not describe a model call.",
        evidenceIds: [],
      },
    ],
    questions: ["Have you integrated a model API?"],
    preparationPriorities: ["Adapt the form to show one real model response and an error state."],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  service.read.mockResolvedValue(structuredClone(initial));
  service.savedComparison.mockResolvedValue(null);
});
afterEach(cleanup);

const recommended = {
  ...insight,
  analysis: {
    ...insight.analysis,
    recommendation: {
      decision: "recommended" as const,
      reason: "Based on your saved profile, this introduction may add Python-specific practice.",
      benefit: "Python exercises and tests, if not already covered by your work.",
      nextStep: "Start with the published introductory exercise.",
      evidenceIds: [],
    },
  },
};

it("does not save an existing-knowledge correction until the student confirms it", async () => {
  service.savedComparison.mockResolvedValue(recommended);
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  fireEvent.click(await screen.findByRole("button", { name: "I already know this subject" }));
  const input = screen.getByRole("textbox", { name: /What have you already learned/ });
  fireEvent.change(input, {
    target: { value: "I built Python tools with file handling and tests." },
  });
  expect(service.correctExperience).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(service.correctExperience).not.toHaveBeenCalled();
  expect(service.compare).not.toHaveBeenCalled();
});

it("saves a student correction and requires deliberate re-analysis without creating mastery facts", async () => {
  service.savedComparison.mockResolvedValue(recommended);
  service.correctExperience.mockResolvedValue({ ...initial, profileVersion: 3 });
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  fireEvent.click(await screen.findByRole("button", { name: "I already know this subject" }));
  fireEvent.change(screen.getByRole("textbox", { name: /What have you already learned/ }), {
    target: { value: "I independently built Python command-line tools with tests." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm my experience" }));
  await screen.findByText(/Experience confirmed/);
  expect(service.correctExperience).toHaveBeenCalledWith(
    "selected-event",
    initial,
    "en",
    "I independently built Python command-line tools with tests.",
  );
  expect(service.compare).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "I already know this subject" })).toBeDisabled();
});

it("retains an unsaved correction after a failed save and makes the same action retryable", async () => {
  service.savedComparison.mockResolvedValue(recommended);
  service.correctExperience.mockRejectedValueOnce(new Error("Correction storage failed"));
  service.correctExperience.mockResolvedValueOnce({ ...initial, profileVersion: 3 });
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  fireEvent.click(await screen.findByRole("button", { name: "I already know this subject" }));
  const input = screen.getByRole("textbox", { name: /What have you already learned/ });
  fireEvent.change(input, { target: { value: "I already implemented Python file parsing." } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm my experience" }));
  await screen.findByText(/Correction storage failed/);
  expect(input).toHaveValue("I already implemented Python file parsing.");
  expect(screen.queryByText(/Experience confirmed/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm my experience" }));
  await screen.findByText(/Experience confirmed/);
  expect(service.correctExperience.mock.calls[1]).toEqual(service.correctExperience.mock.calls[0]);
});

it("does not apply a late correction response to a different opportunity", async () => {
  let resolve!: (value: EvidenceView) => void;
  service.savedComparison.mockResolvedValue(recommended);
  service.correctExperience.mockReturnValueOnce(
    new Promise<EvidenceView>((done) => {
      resolve = done;
    }),
  );
  const rendered = render(<EvidenceOpportunityInsight opportunityId="first-event" />);
  fireEvent.click(await screen.findByRole("button", { name: "I already know this subject" }));
  fireEvent.change(screen.getByRole("textbox", { name: /What have you already learned/ }), {
    target: { value: "I built this before." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm my experience" }));
  await waitFor(() => expect(service.correctExperience).toHaveBeenCalledOnce());
  rendered.rerender(<EvidenceOpportunityInsight opportunityId="second-event" />);
  await waitFor(() =>
    expect(service.savedComparison).toHaveBeenCalledWith(
      "second-event",
      "en",
      expect.any(AbortSignal),
    ),
  );
  await act(async () => {
    resolve({ ...initial, profileVersion: 3 });
  });
  expect(screen.queryByText(/Experience confirmed/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "I already know this subject" })).toBeEnabled();
});

it("confirms a focused answer without automatically requesting another AI analysis", async () => {
  service.savedComparison.mockResolvedValue({
    ...insight,
    analysis: {
      ...insight.analysis,
      recommendation: {
        decision: "needs_clarification",
        reason: "Python experience is not described.",
        benefit: "The answer distinguishes a useful introduction from repeated material.",
        nextStep: "Describe one Python task you have done, if any.",
        evidenceIds: [],
      },
    },
  });
  service.answer.mockResolvedValue({ ...initial, profileVersion: 3 });
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  const answer = await screen.findByRole("textbox", { name: "Have you integrated a model API?" });
  fireEvent.change(answer, {
    target: { value: "I have not used a model API; I built the interface independently." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm answer" }));
  await waitFor(() => expect(service.answer).toHaveBeenCalledOnce());
  expect(service.answer).toHaveBeenCalledWith(
    "selected-event",
    initial,
    "en",
    "Have you integrated a model API?",
    "I have not used a model API; I built the interface independently.",
  );
  await screen.findByText(/Outdated explanation/);
  expect(service.compare).not.toHaveBeenCalled();
});

it("leads with a useful recommendation, benefit and next move rather than a profile inventory", async () => {
  service.savedComparison.mockResolvedValue({
    ...insight,
    analysis: {
      ...insight.analysis,
      recommendation: {
        decision: "already_covered",
        reason:
          "Your confirmed Python project already implements the published introductory topics.",
        benefit: "Review unfamiliar topics; repeating the full introduction adds little.",
        nextStep: "Compare the published topics with your existing project before enrolling.",
        evidenceIds: [],
      },
    },
  });
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  await screen.findByText("Much of this repeats your existing work");
  expect(screen.getByText("What would you gain?")).toBeInTheDocument();
  expect(screen.getByText("Your next move")).toBeInTheDocument();
  expect(
    screen.getByText("See the reasoning and preparation details").closest("details"),
  ).not.toHaveAttribute("open");
});

it("restores a saved comparison without another model call and marks old context", async () => {
  service.savedComparison.mockResolvedValue({ ...insight, outdated: true });
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  await screen.findByText(insight.analysis.summary);
  expect(service.compare).not.toHaveBeenCalled();
  expect(screen.getByText(/Outdated explanation/)).toBeInTheDocument();
});

it("does not analyze imported sources before selection and explicit consent", async () => {
  render(<ProfileEvidenceWorkspace disabled={false} onChanged={() => {}} />);
  const analyze = await screen.findByRole("button", { name: "Analyze selected sources" });
  expect(analyze).toBeDisabled();
  expect(service.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Analyze Synthetic CV" }));
  expect(analyze).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the selected text/ }));
  service.mutate.mockResolvedValue(structuredClone(drafted));
  fireEvent.click(analyze);
  await screen.findByText("Your review comes first");
  expect(service.mutate).toHaveBeenCalledWith("/analyze", {
    profileVersion: 2,
    sourcesVersion: 1,
    sourceIds: ["cv-1"],
    consent: true,
    language: "en",
  });
  expect(
    screen.getByRole("button", { name: "Confirm selected facts in my profile" }),
  ).toBeDisabled();
});

it("requires personal contribution and explicit fact selection before project adoption", async () => {
  service.read.mockResolvedValue(structuredClone(drafted));
  const changed = vi.fn();
  render(<ProfileEvidenceWorkspace disabled={false} onChanged={changed} />);
  const confirm = await screen.findByRole("button", {
    name: "Confirm selected facts in my profile",
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /project · Source statement/ }));
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/What did you personally contribute/), {
    target: { value: "I implemented form validation and the calendar interface." },
  });
  expect(confirm).toBeEnabled();
  service.mutate.mockResolvedValue({ ...initial, profileVersion: 3 });
  fireEvent.click(confirm);
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(service.mutate).toHaveBeenCalledWith("/accept", {
    draftId: "draft-1",
    profileVersion: 2,
    sourcesVersion: 1,
    facts: [
      {
        index: 0,
        value: "Scheduling application",
        contribution: "I implemented form validation and the calendar interface.",
      },
    ],
  });
});

it("failed adoption preserves selected edited facts and never displays false success", async () => {
  service.read.mockResolvedValue(structuredClone(drafted));
  service.mutate.mockRejectedValue(new Error("Storage unavailable; retry"));
  render(<ProfileEvidenceWorkspace disabled={false} onChanged={() => {}} />);
  fireEvent.click(await screen.findByRole("checkbox", { name: /project · Source statement/ }));
  fireEvent.change(screen.getByLabelText(/What did you personally contribute/), {
    target: { value: "I wrote the validation flow." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm selected facts in my profile" }));
  await screen.findByText("Storage unavailable; retry");
  expect(screen.getByLabelText(/What did you personally contribute/)).toHaveValue(
    "I wrote the validation flow.",
  );
  expect(screen.queryByText("Confirmed saved.")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /project · Source statement/ })).toBeChecked();
  service.mutate.mockResolvedValue({ ...initial, profileVersion: 3 });
  fireEvent.click(screen.getByRole("button", { name: "Retry last action" }));
  await screen.findByText("Confirmed saved.");
  expect(service.mutate).toHaveBeenCalledTimes(2);
  expect(service.mutate.mock.calls[1]).toEqual(service.mutate.mock.calls[0]);
});

it("outdated extraction cannot be adopted", async () => {
  service.read.mockResolvedValue({ ...drafted, profileVersion: 3 });
  render(<ProfileEvidenceWorkspace disabled={false} onChanged={() => {}} />);
  await screen.findByText("This draft is outdated. Refresh and analyze again.");
  expect(
    screen.getByRole("button", { name: "Confirm selected facts in my profile" }),
  ).toBeDisabled();
});

it("source uploads reject oversized files before contacting the backend", async () => {
  render(<ProfileEvidenceWorkspace disabled={false} onChanged={() => {}} />);
  await screen.findByText("Private sources · review before analysis");
  const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "oversized.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(screen.getByLabelText("Upload PDF or DOCX · maximum 5 MB"), {
    target: { files: [file] },
  });
  await screen.findByText("Choose a file under 5 MB.");
  expect(service.upload).not.toHaveBeenCalled();
});

it("explains concrete transfers, gaps, citations and preparation rather than matching a topic", async () => {
  service.read.mockResolvedValue({
    ...initial,
    currentFacts: [
      {
        id: "fact-1",
        kind: "project",
        value: "Calendar and validation flow",
        contribution: "I wrote the React validation.",
        references: [{ sourceId: "cv-1", chunkId: "p1", quote: source.chunks[0]!.text }],
        confirmedAt: "2026-10-31T00:00:00Z",
      },
    ],
  });
  service.compare.mockResolvedValue(insight);
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  const compare = await screen.findByRole("button", { name: "Explain this opportunity for me" });
  expect(compare).toBeDisabled();
  expect(service.compare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: /Use Meta through the backend/ }));
  await waitFor(() => expect(compare).toBeEnabled());
  fireEvent.click(compare);
  await screen.findByText(insight.analysis.summary);
  expect(screen.getByText("Reuse your validation flow")).toBeInTheDocument();
  expect(screen.getByText("Model integration unknown")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Why this conclusion?"));
  expect(screen.getByText("Calendar and validation flow")).toBeInTheDocument();
  expect(screen.getByText(/Synthetic CV · Page 1/)).toBeInTheDocument();
});

it("ignores a late comparison after confirmed profile information changes", async () => {
  let complete!: (value: InsightView) => void;
  service.compare.mockReturnValue(
    new Promise<InsightView>((resolve) => {
      complete = resolve;
    }),
  );
  render(<EvidenceOpportunityInsight opportunityId="selected-event" />);
  const compare = await screen.findByRole("button", { name: "Explain this opportunity for me" });
  fireEvent.click(screen.getByRole("checkbox", { name: /Use Meta through the backend/ }));
  await waitFor(() => expect(compare).toBeEnabled());
  fireEvent.click(compare);
  await waitFor(() => expect(service.compare).toHaveBeenCalledOnce());
  service.read.mockResolvedValue({ ...initial, profileVersion: 3 });
  window.dispatchEvent(new Event("nextstep:account-data"));
  await waitFor(() => expect(service.read).toHaveBeenCalledTimes(2));
  complete(insight);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Explain this opportunity for me" })).toBeEnabled(),
  );
  expect(screen.queryByText(insight.analysis.summary)).not.toBeInTheDocument();
});
