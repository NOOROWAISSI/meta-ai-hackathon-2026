import { createFileRoute } from "@tanstack/react-router";
import { SavedScreen } from "@/components/saved/SavedScreen";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — NextStep" },
      { name: "description", content: "Hackathons you've saved for later." },
      { property: "og:title", content: "Saved — NextStep" },
      { property: "og:description", content: "Hackathons you've saved for later." },
    ],
  }),
  component: SavedScreen,
});
