import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StartingPointComparison } from "@/components/catalog/StartingPointComparison";
import type { BriefingContext, BriefingStartingPoint } from "@/lib/catalog/briefing";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/lib/catalog/briefing", () => ({ saveBriefingStartingPoint: save }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
const context: BriefingContext = {
  opportunityId: "selected-event",
  profileId: "owned-profile",
  profileVersion: 3,
  sourceRevision: "selected-source",
  language: "en",
};
const data: BriefingStartingPoint = {
  questionId: "preparation-start:example",
  challenge: "Build a working prototype",
  question: "Have you built similar work?",
  answer: null,
  label: "Starting point unknown",
  explanation: "A topic tag does not establish hands-on experience.",
  nextAction: "Confirm your experience before choosing a learning path.",
  options: [
    { value: "not_yet", label: "I have not tried this" },
    { value: "guided", label: "I followed a guide" },
    { value: "independent", label: "I built similar work myself" },
    { value: "not_sure", label: "Not sure" },
  ],
  evidence: [],
};
let query: QueryClient;
beforeEach(() => {
  save.mockReset();
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  query.clear();
});
function show() {
  render(
    <QueryClientProvider client={query}>
      <StartingPointComparison data={data} context={context} />
    </QueryClientProvider>,
  );
}

it("keeps a starting-point selection unconfirmed until the explicit Save action", async () => {
  save.mockResolvedValue({ version: 4 });
  show();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: "I built similar work myself" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm my starting point" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(context, data.questionId, "independent"));
  expect(
    await screen.findByText("Saved to your profile. Update the comparison to use it."),
  ).toBeVisible();
});
it("preserves the selected answer after failed storage and retries the same confirmed request", async () => {
  save
    .mockRejectedValueOnce(new Error("Storage temporarily unavailable"))
    .mockResolvedValueOnce({ version: 4 });
  show();
  fireEvent.click(screen.getByRole("radio", { name: "I followed a guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm my starting point" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Storage temporarily unavailable");
  expect(screen.queryByText("Saved to your profile. Update the comparison to use it.")).toBeNull();
  expect(screen.getByRole("radio", { name: "I followed a guide" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
  expect(
    await screen.findByText("Saved to your profile. Update the comparison to use it."),
  ).toBeVisible();
});
