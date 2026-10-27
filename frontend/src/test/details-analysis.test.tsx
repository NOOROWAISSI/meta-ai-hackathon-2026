import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HackathonDetails } from "@/components/details/HackathonDetails";
import type { UserProfile } from "@/lib/discover/types";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const profile: UserProfile = { interests: ["AI"], skills: ["Python"], weeklyHours: 5, version: 1 };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui = (facts: UserProfile) => (
    <QueryClientProvider client={client}>
      <HackathonDetails
        eventId="aurora-ai"
        profile={facts}
        saved={false}
        onToggleSave={() => {}}
        onSaveProfile={() => true}
        onBack={() => {}}
      />
    </QueryClientProvider>
  );
  return { ...render(ui(profile)), ui };
}

describe("event personal analysis", () => {
  it("keeps previous analysis visibly outdated until an explicit validated update", async () => {
    const view = mount();
    await screen.findByRole("heading", { name: "Aurora AI Builders Weekend" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Requirements & My Fit" }), {
      button: 0,
      ctrlKey: false,
    });
    await screen.findByText("Existing experience", {}, { timeout: 3000 });
    fireEvent.click(screen.getByText("Existing experience").closest("summary")!);
    await screen.findByText(/Related self-reported skills: Python/, {}, { timeout: 3000 });
    // Start a response for the old profile, then edit before it arrives.
    fireEvent.click(screen.getByRole("button", { name: "Update analysis" }));
    view.rerender(view.ui({ ...profile, skills: ["React"], version: 2 }));
    expect(screen.getByText("Analysis outdated.")).toBeVisible();
    expect(screen.getByText(/Related self-reported skills: Python/)).toBeVisible();
    await waitFor(
      () => expect(screen.getAllByRole("button", { name: "Update analysis" })[0]).toBeEnabled(),
      { timeout: 3000 },
    );
    expect(screen.getByText("Analysis outdated.")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Update analysis" })[0]!);
    await waitFor(() => expect(screen.queryByText("Analysis outdated.")).not.toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.queryByText(/Related self-reported skills: Python/)).not.toBeInTheDocument();
  }, 10000);
  it("keeps a dated event snapshot readable when its source becomes unavailable", async () => {
    mount();
    await screen.findByRole("heading", { name: "Aurora AI Builders Weekend" });
    fireEvent.change(screen.getByLabelText("Preview details state"), {
      target: { value: "source-unavailable" },
    });
    await screen.findByText("Source is unavailable; the dated snapshot is preserved.");
    expect(screen.getByRole("heading", { name: "Aurora AI Builders Weekend" })).toBeVisible();
    expect(screen.getByText("Nov 6, 2026")).toBeVisible();
  });
});
