import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

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
  return (
    <ProfileScreen {...(event ? { eventId: event } : {})} returnToPlans={returnTo === "plans"} />
  );
}
