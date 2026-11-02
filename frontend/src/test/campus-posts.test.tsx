import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampusPosts } from "@/components/catalog/CampusPosts";
import { realCatalogService, type CampusActivity } from "@/lib/catalog/service";

const base: CampusActivity = {
  id: "instagram-post",
  universityIds: ["birzeit"],
  organizationIds: [],
  title: "A public community announcement",
  summary: "A collected announcement with an unknown deadline.",
  originalUrl: "https://www.instagram.com/test-community/",
  contentUrl: "https://example.org/public-republication",
  channel: "instagram",
  kind: "hackathon",
  publishedDateText: null,
  eventDateText: "13 November; year unknown",
  availability: "unknown",
  sourcePassage: "The public source's original announcement passage.",
  verificationLevel: "secondary_excerpt",
  collectedAt: "2026-11-02T00:50:00Z",
};
let query: QueryClient;
beforeEach(() => {
  query = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.spyOn(realCatalogService, "network").mockResolvedValue({
    reviewedAt: "2026-11-02T00:50:00Z",
    referenceUrl: "https://example.org/ministry",
    institutions: [],
    organizations: [],
  });
  vi.spyOn(realCatalogService, "campusPosts").mockResolvedValue([
    base,
    {
      ...base,
      id: "past",
      title: "An ended workshop",
      summary: "A description of an archived workshop.",
      channel: "official_website",
      availability: "ended",
      verificationLevel: "primary_source",
    },
    {
      ...base,
      id: "other-university",
      title: "Another university's update",
      summary: "An update from a different university.",
      universityIds: ["najah"],
      channel: "facebook",
    },
  ]);
});
afterEach(() => {
  cleanup();
  query.clear();
  vi.restoreAllMocks();
});
function show(university = "all") {
  render(
    <QueryClientProvider client={query}>
      <CampusPosts university={university} />
    </QueryClientProvider>,
  );
}
it("shows actual post content and source provenance without turning an indexed excerpt into verified registration", async () => {
  show("birzeit");
  expect(await screen.findByText(base.summary)).toBeVisible();
  expect(screen.getByText("Public republication · original not read")).toBeVisible();
  expect(screen.queryByText("Another university's update")).toBeNull();
  fireEvent.click(screen.getAllByText("Read the source excerpt")[0]!);
  expect(screen.getAllByText(base.sourcePassage)[0]).toBeVisible();
  expect(screen.getAllByRole("link", { name: "Where this text was read" })[0]).toHaveAttribute(
    "href",
    base.contentUrl,
  );
  expect(screen.queryByRole("button", { name: /Register|Accept plan/ })).toBeNull();
});
it("filters the post feed by social channel and keeps ended activities in the archive", async () => {
  show();
  await screen.findByText(base.title);
  fireEvent.change(screen.getByLabelText("Published on"), { target: { value: "instagram" } });
  expect(screen.queryByText("An ended workshop")).toBeNull();
  fireEvent.change(screen.getByLabelText("Published on"), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("Activity"), { target: { value: "archive" } });
  expect(screen.getByText("An ended workshop")).toBeVisible();
  expect(screen.queryByText(base.title)).toBeNull();
});
it("offers a real retry after the feed fails to load", async () => {
  vi.mocked(realCatalogService.campusPosts).mockRejectedValueOnce(new Error("Unavailable"));
  show();
  expect(await screen.findByRole("alert")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Retry posts" }));
  expect(await screen.findByText(base.summary)).toBeVisible();
});
