import { createFileRoute } from "@tanstack/react-router";
import { RealOpportunities } from "@/components/catalog/RealOpportunities";
import { RealOpportunityDetails } from "@/components/catalog/RealOpportunityDetails";

export const Route = createFileRoute("/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { opportunity?: string; event?: string; analysis?: "update" } => ({
    ...(typeof search["opportunity"] === "string" &&
    /^[A-Za-z0-9-]{1,100}$/.test(search["opportunity"])
      ? { opportunity: search["opportunity"] }
      : {}),
    ...(typeof search["event"] === "string" && search["event"].length <= 100
      ? { event: search["event"] }
      : {}),
    ...(search["analysis"] === "update" ? { analysis: "update" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Discover Opportunities — NextStep" },
      {
        name: "description",
        content: "Discover source-backed courses, hackathons and learning opportunities.",
      },
      { property: "og:title", content: "Discover Opportunities — NextStep" },
      {
        property: "og:description",
        content: "Personalized hackathon discovery for university students.",
      },
    ],
  }),
  component: DiscoverRoute,
});
function DiscoverRoute() {
  const { opportunity, event } = Route.useSearch();
  const selected = opportunity ?? event;
  return selected ? <RealOpportunityDetails opportunityId={selected} /> : <RealOpportunities />;
}
