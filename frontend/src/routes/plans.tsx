import { createFileRoute } from "@tanstack/react-router";
import { DemoPlaceholder } from "@/components/discover/AppShell";

export const Route = createFileRoute("/plans")({
  component: () => (
    <DemoPlaceholder
      title="My Plans"
      description="Preparation plans will be added with the event details workflow."
    />
  ),
});
