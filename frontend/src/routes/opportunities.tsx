import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/opportunities")({
  validateSearch: (search: Record<string, unknown>): { opportunity?: string } => ({
    ...(typeof search["opportunity"] === "string" &&
    /^[A-Za-z0-9-]{1,100}$/.test(search["opportunity"])
      ? { opportunity: search["opportunity"] }
      : {}),
  }),
  head: () => ({ meta: [{ title: "Real opportunities · NextStep" }] }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/",
      search: search.opportunity ? { opportunity: search.opportunity } : {},
    });
  },
});
