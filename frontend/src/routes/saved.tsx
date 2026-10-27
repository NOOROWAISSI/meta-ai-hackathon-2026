import { createFileRoute } from "@tanstack/react-router";
import { DemoPlaceholder } from "@/components/discover/AppShell";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — NextStep" },
      { name: "description", content: "Hackathons you've saved for later." },
      { property: "og:title", content: "Saved — NextStep" },
      { property: "og:description", content: "Hackathons you've saved for later." },
    ],
  }),
  component: () => <DemoPlaceholder title="Saved" description="A dedicated saved list is coming. Your saves are kept in this browser and power “Similar to your saved opportunities” on Discover." />,
});
