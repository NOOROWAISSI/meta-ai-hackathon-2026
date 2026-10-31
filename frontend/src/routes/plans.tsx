import { createFileRoute } from "@tanstack/react-router";
import { AccountPlans } from "@/components/account/AccountPlans";
import { AccountBoundary } from "@/components/account/AccountBoundary";

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
  if (event) return <AccountPlans key={event} eventId={event} />;
  return (
    <AccountBoundary>
      <AccountPlans key={event ?? "index"} {...(event ? { eventId: event } : {})} />
    </AccountBoundary>
  );
}
