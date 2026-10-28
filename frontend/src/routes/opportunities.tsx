import { createFileRoute } from "@tanstack/react-router";
import { RealOpportunities } from "@/components/catalog/RealOpportunities";
export const Route = createFileRoute("/opportunities")({
  head: () => ({ meta: [{ title: "Real opportunities · NextStep" }] }),
  component: RealOpportunities,
});
