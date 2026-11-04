import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  PreparationSelectionAction,
  SelectedPreparations,
} from "@/components/preparation/PreparationSelection";
import {
  preparationSelectionsApi,
  type PreparationSelection,
} from "@/lib/account/preparation-selections";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ ready: true, user: { id: "synthetic-account" } }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
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
    <a href={to + (search ? "?" + new URLSearchParams(search) : "")} {...props}>
      {children}
    </a>
  ),
}));
const choice: PreparationSelection = {
  opportunityId: "palestine-summit-birzeit-demo-2026",
  title: "Mini Hackathon & Demo Day",
  organizer: "Birzeit University",
  selectedAt: "2026-11-02T01:00:00Z",
  accessState: "source_review_required",
};
let query: QueryClient;
beforeEach(() => {
  mocks.navigate.mockReset();
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.spyOn(preparationSelectionsApi, "read").mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.restoreAllMocks();
});
function show(children: ReactNode) {
  return render(<QueryClientProvider client={query}>{children}</QueryClientProvider>);
}
it("Prepare saves the actual Birzeit choice before navigating and does not show an unconfirmed success", async () => {
  let resolve!: (value: PreparationSelection) => void;
  const pending = new Promise<PreparationSelection>((done) => {
    resolve = done;
  });
  vi.spyOn(preparationSelectionsApi, "select").mockReturnValue(pending);
  show(<PreparationSelectionAction opportunityId={choice.opportunityId} />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare for this opportunity" }));
  expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async () => {
    resolve(choice);
    await pending;
  });
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/plans",
      search: { event: choice.opportunityId },
    }),
  );
  expect(preparationSelectionsApi.select).toHaveBeenCalledWith(
    choice.opportunityId,
    "synthetic-account",
  );
});
it("failed storage keeps the action retryable and never navigates as though saved", async () => {
  vi.spyOn(preparationSelectionsApi, "select")
    .mockRejectedValueOnce(new Error("Synthetic storage failure"))
    .mockResolvedValueOnce(choice);
  show(<PreparationSelectionAction opportunityId={choice.opportunityId} />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare for this opportunity" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(mocks.navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Prepare for this opportunity" }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
});
it("My Plans restores source-review choices and hides them after an accepted plan exists", async () => {
  vi.mocked(preparationSelectionsApi.read).mockResolvedValue([choice]);
  const view = show(<SelectedPreparations acceptedOpportunityIds={[]} />);
  expect(await screen.findByRole("heading", { name: choice.title })).toBeVisible();
  expect(screen.getByText("Planning details need review")).toBeVisible();
  expect(screen.getByRole("link", { name: "Continue preparation" })).toHaveAttribute(
    "href",
    `/plans?event=${choice.opportunityId}`,
  );
  expect(screen.queryByText(/Task progress|eligible|registered/)).toBeNull();
  view.rerender(
    <QueryClientProvider client={query}>
      <SelectedPreparations acceptedOpportunityIds={[choice.opportunityId]} />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("heading", { name: choice.title })).toBeNull();
});
