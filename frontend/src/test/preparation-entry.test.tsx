import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreparationEntry } from "@/components/preparation/PreparationEntry";
import {
  CatalogRequestError,
  realCatalogService,
  type PreparationAccess,
} from "@/lib/catalog/service";

const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ ready: true, user: auth.userId ? { id: auth.userId } : null }),
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ t: (en: string) => en }) }));
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
    <a href={to + (search ? "?" + new URLSearchParams(search).toString() : "")} {...props}>
      {children}
    </a>
  ),
}));
const base = {
  opportunityId: "university-ai-week",
  title: "University AI Week",
  organizer: "Synthetic university",
  kind: "hackathon" as const,
  officialUrl: "https://example.invalid/event",
};
const review: PreparationAccess = {
  ...base,
  state: "source_review_required",
  planningOpportunityId: null,
  reviewNeeds: ["participation_rules", "submission_requirements", "source_evidence"],
};
const available: PreparationAccess = {
  ...base,
  state: "workspace_available",
  planningOpportunityId: base.opportunityId,
  reviewNeeds: [],
};
beforeEach(() => {
  auth.userId = null;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function show(
  id = base.opportunityId,
  workspace = vi.fn(() => <div>Confirmed plan workspace</div>),
) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const element = (eventId: string) => (
    <QueryClientProvider client={query}>
      <PreparationEntry opportunityId={eventId} renderWorkspace={workspace} />
    </QueryClientProvider>
  );
  return { ...render(element(id)), workspace, element };
}
it("allows an anonymous student to see source-review needs without opening a workspace", async () => {
  vi.spyOn(realCatalogService, "preparationAccess").mockResolvedValue(review);
  const view = show();
  await screen.findByText("Source review needed");
  expect(screen.getByRole("heading", { name: base.title })).toBeVisible();
  expect(screen.getByText("Participation conditions")).toBeVisible();
  expect(screen.getByRole("link", { name: "Back to opportunity" })).toHaveAttribute(
    "href",
    "/?opportunity=university-ai-week",
  );
  expect(screen.queryByText("Generate preparation draft")).toBeNull();
  expect(view.workspace).not.toHaveBeenCalled();
});
it("opens an authenticated workspace for any server-supported ID, with no E-prefix requirement", async () => {
  auth.userId = "student-a";
  vi.spyOn(realCatalogService, "preparationAccess").mockResolvedValue(available);
  const view = show();
  await screen.findByText("Confirmed plan workspace");
  expect(view.workspace).toHaveBeenCalledWith("university-ai-week");
});
it("preserves the selected event through sign-in for a supported planning record", async () => {
  vi.spyOn(realCatalogService, "preparationAccess").mockResolvedValue(available);
  const view = show();
  const signIn = await screen.findByRole("link", { name: "Sign in" });
  expect(signIn.getAttribute("href")).toContain("returnTo=%2Fplans%3Fevent%3Duniversity-ai-week");
  expect(view.workspace).not.toHaveBeenCalled();
});
it("does not turn a course with an E-looking ID into a hackathon workspace", async () => {
  auth.userId = "student-a";
  vi.spyOn(realCatalogService, "preparationAccess").mockResolvedValue({
    ...base,
    opportunityId: "E999",
    kind: "course",
    state: "unsupported_kind",
    planningOpportunityId: null,
    reviewNeeds: [],
  });
  const view = show("E999");
  await screen.findByText("Explore this learning opportunity.");
  expect(view.workspace).not.toHaveBeenCalled();
});
it("shows an unavailable event clearly and recovers from a temporary error with Retry", async () => {
  vi.spyOn(realCatalogService, "preparationAccess")
    .mockRejectedValueOnce(new CatalogRequestError(404))
    .mockResolvedValueOnce(review);
  show();
  await screen.findByText("Opportunity unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Source review needed");
  expect(screen.queryByRole("alert")).toBeNull();
});
it("ignores a late capability response for an event the student has left", async () => {
  let resolveOld!: (value: PreparationAccess) => void;
  vi.spyOn(realCatalogService, "preparationAccess").mockImplementation((id) =>
    id === "old-event"
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve(review),
  );
  const view = show("old-event");
  view.rerender(view.element(base.opportunityId));
  await screen.findByRole("heading", { name: base.title });
  await act(async () => {
    resolveOld({ ...review, opportunityId: "old-event", title: "Old event" });
    await Promise.resolve();
  });
  expect(screen.queryByRole("heading", { name: "Old event" })).toBeNull();
});
it("rejects a response belonging to a different selected event at the service boundary", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...available,
        opportunityId: "other-event",
        planningOpportunityId: "other-event",
      }),
    }),
  );
  await expect(realCatalogService.preparationAccess(base.opportunityId)).rejects.toThrow(
    "does not match",
  );
});
