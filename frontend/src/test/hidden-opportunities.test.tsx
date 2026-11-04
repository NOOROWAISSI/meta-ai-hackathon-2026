import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DiscoverScreen } from "@/components/discover/DiscoverScreen";
import { VisitMemoryProvider } from "@/components/VisitMemory";
import { readRecord, updateRecord } from "@/lib/storage/database";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("lists persisted Not interested items and restores them without changing bookmarks or plans", async () => {
  await updateRecord("nextstep.hidden", [], () => ["aurora-ai"]);
  await updateRecord("nextstep.saved", [], () => ["aurora-ai"]);
  await updateRecord("plan:aurora-ai", null, () => ({ preserved: true }));
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={query}>
      <VisitMemoryProvider>
        <DiscoverScreen />
      </VisitMemoryProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("Not interested · 1 hidden opportunities");
  fireEvent.click(screen.getByText("Not interested · 1 hidden opportunities"));
  fireEvent.click(await screen.findByRole("button", { name: "Restore opportunity" }));
  await waitFor(() =>
    expect(screen.getByText("Not interested · 0 hidden opportunities")).toBeVisible(),
  );
  expect(await readRecord("nextstep.hidden", [])).toEqual([]);
  expect(await readRecord("nextstep.saved", [])).toEqual(["aurora-ai"]);
  expect(await readRecord("plan:aurora-ai", null)).toEqual({ preserved: true });
});
