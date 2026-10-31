import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SavedScreen } from "@/components/saved/SavedScreen";
import { savedService, type SavedSnapshot } from "@/lib/saved/service";
import { DEFAULT_PROFILE, DEMO_HACKATHONS } from "@/lib/discover/demo-data";
import { VisitMemoryProvider } from "@/components/VisitMemory";

vi.mock("@/components/discover/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    search?: unknown;
  }) => (
    <a href={to} className={props.className}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const data: SavedSnapshot = {
  ids: ["aurora-ai"],
  savedAt: {},
  profile: DEFAULT_PROFILE,
  catalog: DEMO_HACKATHONS,
  plannedIds: [],
};
const mount = () =>
  render(
    <VisitMemoryProvider>
      <SavedScreen />
    </VisitMemoryProvider>,
  );

it("recovers a failed load and offers the existing accepted preparation plan", async () => {
  const load = vi
    .spyOn(savedService, "load")
    .mockRejectedValueOnce(new Error("Storage unavailable."));
  mount();
  await screen.findByRole("button", { name: "Retry loading" });
  load.mockResolvedValue({ ...data, plannedIds: ["aurora-ai"] });
  fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
  await screen.findByRole("heading", { name: "Aurora AI Builders Weekend" });
  expect(screen.getByRole("button", { name: "Continue preparation" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Explore preparation" })).toBeNull();
});

it("shows loading, accessible search/filter states, and the no-profile invitation", async () => {
  let resolve!: (value: SavedSnapshot) => void;
  vi.spyOn(savedService, "load").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  mount();
  expect(screen.getByRole("status", { name: "Loading saved opportunities" })).toBeInTheDocument();
  resolve(data);
  await screen.findByRole("heading", { name: "Aurora AI Builders Weekend" });
  expect(screen.getByRole("link", { name: "Complete my profile" })).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search saved opportunities" }), {
    target: { value: "not-found" },
  });
  expect(screen.getByText("No matching saved opportunities")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("button", { name: "View details" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Explore preparation" })).toBeVisible();
});

it("retains a card until removal confirms, retries failure, and offers undo only after commit", async () => {
  const load = vi.spyOn(savedService, "load").mockResolvedValue(data);
  let reject!: (error: Error) => void;
  const remove = vi.spyOn(savedService, "remove").mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  mount();
  await screen.findByRole("heading", { name: "Aurora AI Builders Weekend" });
  fireEvent.click(screen.getByRole("button", { name: "Unsave Aurora AI Builders Weekend" }));
  expect(screen.getByRole("heading", { name: "Aurora AI Builders Weekend" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  reject(new Error("Storage unavailable."));
  await screen.findByRole("button", { name: "Retry change" });
  expect(screen.getByRole("heading", { name: "Aurora AI Builders Weekend" })).toBeVisible();
  remove.mockResolvedValue({ id: "aurora-ai", index: 0 });
  load.mockResolvedValue({ ...data, ids: [] });
  fireEvent.click(screen.getByRole("button", { name: "Retry change" }));
  await screen.findByText("No saved opportunities yet.");
  vi.spyOn(savedService, "undo").mockResolvedValue();
  load.mockResolvedValue(data);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await screen.findByRole("heading", { name: "Aurora AI Builders Weekend" });
  await waitFor(() => expect(screen.getByText("Restored to Saved.")).toBeVisible());
});
