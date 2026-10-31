import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RealOpportunities } from "@/components/catalog/RealOpportunities";
import { RealOpportunityDetails } from "@/components/catalog/RealOpportunityDetails";
import { realCatalogService, type ListingSummary } from "@/lib/catalog/service";
import * as briefing from "@/lib/catalog/briefing";
import { accountApi } from "@/lib/account/api";

const state = vi.hoisted(() => ({ signedIn: false }));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ ready: true, user: state.signedIn ? { id: "test-account" } : null }),
}));
vi.mock("@/components/discover/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string;
    search?: Record<string, string>;
    children: ReactNode;
  }) => (
    <a
      href={
        to +
        (search && Object.keys(search).length ? "?" + new URLSearchParams(search).toString() : "")
      }
      {...props}
    >
      {children}
    </a>
  ),
}));
const listing: ListingSummary = {
  id: "test-course",
  kind: "course",
  title: "A source-backed course",
  organizer: "Synthetic test organizer",
  format: "online",
  officialUrl: "https://example.org/test-course",
  summary: "A recorded introduction to AI concepts.",
  topics: ["AI"],
  scope: "global_online",
  registrationDeadline: null,
  registrationState: "not_specified",
  costStatus: "unknown",
  lastReviewedAt: null,
  sourceStatus: "needs_verification",
  sourcePassage: null,
  verificationNote: "Check the actual requirements with the organizer.",
};
const profile: briefing.AccountProfileFacts = {
  id: "profile-test",
  version: 1,
  background: "Self-reported practice",
  interests: ["AI"],
  skills: [
    { id: "python", label: "Python", state: "reported_has" },
    { id: "robotics", label: "Robotics", state: "reported_lacks" },
  ],
  goals: [],
  availableHoursPerWeek: { state: "known", value: 0, reportedAt: "2026-10-28T00:00:00Z" },
};
let query: QueryClient;
beforeEach(() => {
  state.signedIn = false;
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.spyOn(realCatalogService, "listings").mockResolvedValue([listing]);
  vi.spyOn(briefing, "loadAccountProfile").mockResolvedValue(profile);
  vi.spyOn(accountApi, "preferences").mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.restoreAllMocks();
});
function show(children: ReactNode) {
  return render(<QueryClientProvider client={query}>{children}</QueryClientProvider>);
}
it("opens an internal opportunity briefing instead of navigating directly to an external source", async () => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  show(<RealOpportunities />);
  const stack = await screen.findByRole("button", { name: /Open AI & Data/ });
  expect(stack.querySelectorAll(".collection-sheet")).toHaveLength(2);
  expect(screen.queryByRole("link", { name: "Understand this opportunity" })).toBeNull();
  fireEvent.click(stack);
  const link = await screen.findByRole("link", { name: "Understand this opportunity" });
  expect(link).toHaveAttribute("href", "/?opportunity=test-course");
  expect(link).not.toHaveAttribute("target");
  expect(screen.queryByRole("link", { name: "View official course" })).toBeNull();
});
it("shows preparation for a hackathon with a real-world ID", async () => {
  const event = { ...listing, id: "meta-global-ai-2026", kind: "hackathon" as const };
  vi.spyOn(realCatalogService, "listings").mockResolvedValue([event]);
  show(<RealOpportunityDetails opportunityId={event.id} />);
  expect(await screen.findByRole("link", { name: "Prepare for this opportunity" })).toHaveAttribute(
    "href",
    "/plans?event=meta-global-ai-2026",
  );
});
it("keeps public facts and the original source available without a profile or live Meta service", async () => {
  const service = { available: false, explain: vi.fn() };
  show(<RealOpportunityDetails opportunityId={listing.id} analysisService={service} />);
  await screen.findByText(listing.summary);
  expect(screen.getByRole("link", { name: "Open original source" })).toHaveAttribute(
    "href",
    listing.officialUrl,
  );
  expect(
    screen.getByRole("link", { name: "Sign in for a personal view" }).getAttribute("href"),
  ).toContain("opportunity%3Dtest-course");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Requirements & My Fit" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(screen.getByText("Awaiting backend integration")).toBeVisible();
  expect(briefing.loadAccountProfile).not.toHaveBeenCalled();
  expect(service.explain).not.toHaveBeenCalled();
});
it("uses confirmed account facts, preserves zero availability and does not present self-report as AI analysis", async () => {
  state.signedIn = true;
  show(<RealOpportunityDetails opportunityId={listing.id} />);
  await screen.findByText("0 preparation hours per week");
  expect(screen.getByText("Python")).toBeVisible();
  expect(screen.queryByText("Robotics")).toBeNull();
  expect(screen.getByText("Profile-based preview · not AI analysis")).toBeVisible();
  expect(screen.queryByText(/You are eligible/)).toBeNull();
});
it("does not display a late explanation or start a new model request after profile context changes", async () => {
  state.signedIn = true;
  let resolve!: (value: briefing.MetaBriefing) => void;
  const explain = vi
    .fn<
      (
        input: { context: briefing.BriefingContext; listing: ListingSummary },
        signal: AbortSignal,
      ) => Promise<briefing.MetaBriefing>
    >()
    .mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  show(
    <RealOpportunityDetails
      opportunityId={listing.id}
      analysisService={{ available: true, explain }}
    />,
  );
  await screen.findByRole("tab", { name: "Requirements & My Fit" });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Requirements & My Fit" }), {
    button: 0,
    ctrlKey: false,
  });
  const button = await screen.findByRole("button", { name: "Explain this opportunity for me" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(explain).toHaveBeenCalledTimes(1));
  const context = explain.mock.calls[0]![0].context;
  act(() => {
    query.setQueryData(["account-profile-facts", "test-account"], { ...profile, version: 2 });
  });
  await act(async () => {
    resolve({
      context,
      overview: "Outdated private explanation",
      personalRelevance: "Old context",
      preparationPriorities: [],
      questionsToClarify: [],
    });
    await Promise.resolve();
  });
  expect(screen.queryByText("Outdated private explanation")).toBeNull();
  expect(explain).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("The context changed. Request a new explanation.")).toBeVisible();
});
it("shows a recoverable backend configuration error without inventing AI output", async () => {
  state.signedIn = true;
  const explain = vi
    .fn()
    .mockRejectedValue(new Error("The Meta key is not configured on this server."));
  show(
    <RealOpportunityDetails
      opportunityId={listing.id}
      analysisService={{ available: true, explain }}
    />,
  );
  await screen.findByRole("tab", { name: "Requirements & My Fit" });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Requirements & My Fit" }), {
    button: 0,
    ctrlKey: false,
  });
  const button = await screen.findByRole("button", { name: "Explain this opportunity for me" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByText(/The Meta key is not configured on this server/)).toBeVisible();
  expect(explain).toHaveBeenCalledTimes(1);
  expect(button).toBeEnabled();
});
