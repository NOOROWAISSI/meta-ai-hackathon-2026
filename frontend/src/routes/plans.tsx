import { createFileRoute } from "@tanstack/react-router";
import { PlanWorkspace } from "@/components/details/PlanWorkspace";

export const Route = createFileRoute("/plans")({
  validateSearch: (search: Record<string, unknown>): { event?: string } =>
    typeof search["event"] === "string" && search["event"].length <= 100
      ? { event: search["event"] }
      : {},
  head: () => ({
    meta: [
      { title: "My Plans — NextStep" },
      { name: "description", content: "Preparation plans for hackathons you want to join." },
      { property: "og:title", content: "My Plans — NextStep" },
      { property: "og:description", content: "Preparation plans for hackathons you want to join." },
    ],
  }),
  component: PlansRoute,
});

function PlansRoute() {
  const { event } = Route.useSearch();
  return <PlanWorkspace key={event ?? "index"} {...(event ? { eventId: event } : {})} />;
}
