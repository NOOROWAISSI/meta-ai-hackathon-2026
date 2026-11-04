import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/components/profile/ProfileScreen";
import { AccountBoundary } from "@/components/account/AccountBoundary";
import { useQuery } from "@tanstack/react-query";
import { realCatalogService } from "@/lib/catalog/service";
import { accountApi } from "@/lib/account/api";
import { ageConditions } from "@/lib/profile/age-conditions";

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): { event?: string; returnTo?: "plans" } => ({
    ...(typeof search["event"] === "string" && search["event"].length <= 100
      ? { event: search["event"] }
      : {}),
    ...(search["returnTo"] === "plans" ? { returnTo: "plans" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Student Profile — NextStep" },
      {
        name: "description",
        content: "Your interests, self-reported experience, and preparation preferences.",
      },
    ],
  }),
  component: ProfileRoute,
});
function ProfileRoute() {
  const { event, returnTo } = Route.useSearch();
  const catalog = useQuery({
    queryKey: ["real-listings"],
    queryFn: realCatalogService.listings,
    staleTime: 300000,
  });
  const selected = catalog.data?.find((item) => item.id === event);
  const record = useQuery({
    queryKey: ["canonical-opportunity", event],
    queryFn: () => accountApi.opportunity(event!),
    enabled: !!event && selected?.kind === "hackathon",
    retry: false,
  });
  return (
    <AccountBoundary>
      <ProfileScreen
        evidenceEnabled
        ageRequirements={ageConditions(record.data)}
        {...(event ? { eventId: event } : {})}
        {...(selected ? { contextEvent: selected } : {})}
        returnToPlans={returnTo === "plans"}
      />
    </AccountBoundary>
  );
}
