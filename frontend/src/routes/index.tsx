import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/discover/AppShell";
import { DiscoverScreen } from "@/components/discover/DiscoverScreen";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { event?: string } =>
    typeof search["event"] === "string" && search["event"].length <= 100
      ? { event: search["event"] }
      : {},
  head: () => ({
    meta: [
      { title: "Discover Hackathons — NextStep" },
      {
        name: "description",
        content: "Discover tech hackathons that match your interests and prepare to participate.",
      },
      { property: "og:title", content: "Discover Hackathons — NextStep" },
      {
        property: "og:description",
        content: "Personalized hackathon discovery for university students.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <DiscoverScreen />
    </AppShell>
  ),
});
