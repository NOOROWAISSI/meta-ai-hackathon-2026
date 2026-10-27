import { createFileRoute } from "@tanstack/react-router";
import { DemoPlaceholder } from "@/components/discover/AppShell";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — NextStep" },
      { name: "description", content: "Your interests, skills, and availability." },
      { property: "og:title", content: "Profile — NextStep" },
      { property: "og:description", content: "Your interests, skills, and availability." },
    ],
  }),
  component: () => <DemoPlaceholder title="Profile" description="The full profile page is a placeholder. Edit interests, skills, and weekly hours from the avatar button on Discover." />,
});
