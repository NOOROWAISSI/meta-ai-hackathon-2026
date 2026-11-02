import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PalestineNetwork } from "@/components/catalog/PalestineNetwork";
import { realCatalogService } from "@/lib/catalog/service";
import * as api from "@/lib/account/api";

const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: auth.signedIn ? { id: "synthetic-account" } : null }),
}));
const network = {
  reviewedAt: "2026-11-01T20:00:00Z",
  referenceUrl: "https://example.org/ministry",
  institutions: [
    {
      id: "najah",
      name: "An-Najah University",
      arabicName: "جامعة النجاح",
      url: "https://example.org/najah",
      referenceUrl: "https://example.org/ministry",
    },
    {
      id: "other",
      name: "Other University",
      arabicName: "جامعة أخرى",
      url: "https://example.org/other",
      referenceUrl: "https://example.org/ministry",
    },
  ],
  organizations: [
    {
      id: "ewb-najah",
      universityId: "najah",
      name: "EWB An-Najah",
      arabicName: "مهندسون بلا حدود",
      family: "EWB",
      url: "https://example.org/ewb",
      referenceUrl: "https://example.org/reference",
      collectionUrl: "https://example.org/ewb",
      channel: "instagram" as const,
    },
  ],
};
let client: QueryClient;
beforeEach(() => {
  auth.signedIn = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.spyOn(realCatalogService, "network").mockResolvedValue(network);
  vi.spyOn(realCatalogService, "collectionStatus").mockResolvedValue({
    enabled: true,
    intervalHours: 12,
    lastAttemptAt: null,
    pendingReviewCount: 0,
    automaticallyDiscoveredCount: 0,
    sources: [],
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
});
function show(onSelect = vi.fn()) {
  render(
    <QueryClientProvider client={client}>
      <PalestineNetwork selected="all" onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return onSelect;
}
it("searches university and group identities, keeps restricted social collection explicit and selects a university", async () => {
  const select = show();
  fireEvent.click(await screen.findByRole("button", { name: /Your campus, connected/ }));
  expect(await screen.findByText("Student branches still need a primary reference.")).toBeVisible();
  expect(screen.getByText("Social source · manual review")).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EWB" } });
  expect(screen.queryByRole("button", { name: "Other University" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "An-Najah University" }));
  expect(select).toHaveBeenCalledWith("najah");
  expect(screen.getByRole("link", { name: "EWB An-Najah" })).toHaveAttribute(
    "href",
    "https://example.org/reference",
  );
});
it("shows following only after storage confirmation and preserves it after an unsuccessful unfollow", async () => {
  auth.signedIn = true;
  let saved = false;
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  vi.spyOn(api, "apiJson").mockImplementation(async (path, method, body) => {
    if (method === "PUT") {
      if (!(body as { following: boolean }).following) throw new Error("Synthetic failed save");
      await pending;
      saved = true;
      return { confirmed: true };
    }
    return saved
      ? [
          {
            universityId: "najah",
            followedAt: "2026-11-01T00:00:00Z",
            seenAt: "2026-11-01T00:00:00Z",
            newOpportunityIds: [],
          },
        ]
      : [];
  });
  show();
  fireEvent.click(await screen.findByRole("button", { name: /Your campus, connected/ }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Follow university" })[0]).toBeEnabled(),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Follow university" })[0]!);
  expect(screen.queryByRole("button", { name: "Following" })).toBeNull();
  await act(async () => {
    resolve();
    await pending;
  });
  fireEvent.click(await screen.findByRole("button", { name: "Following" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("last saved choices are preserved");
  expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute("aria-pressed", "true");
});
