import { createFileRoute } from "@tanstack/react-router";
import { AccountSaved } from "@/components/account/AccountOpportunities";
import { AccountBoundary } from "@/components/account/AccountBoundary";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — NextStep" },
      { name: "description", content: "Hackathons you've saved for later." },
      { property: "og:title", content: "Saved — NextStep" },
      { property: "og:description", content: "Hackathons you've saved for later." },
    ],
  }),
  component: () => (
    <AccountBoundary>
      <AccountSaved />
    </AccountBoundary>
  ),
});
