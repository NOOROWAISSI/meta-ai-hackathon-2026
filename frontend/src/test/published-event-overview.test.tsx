import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PublishedEventOverview } from "@/components/catalog/PublishedEventOverview";
import fixture from "@/lib/contract/sample-payload.json";
import type { Opportunity, Requirement } from "@/lib/contract/types";

vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ language: "en", t: (en: string) => en }),
}));
afterEach(cleanup);
const event: Opportunity = {
  ...(fixture.opportunity as unknown as Opportunity),
  benefits: ["Published workshop access"],
  timelineEvents: [
    {
      id: "application",
      kind: "registration_close",
      sourceStatus: "conflicting",
      claims: [
        {
          id: "main-time",
          publishedText: "Main page: 25 October, 23:59 ET",
          dateTime: null,
          timeZone: "ET",
          evidenceIds: [],
        },
        {
          id: "rules-time",
          publishedText: "Rules page: 25 October, 23:59 EST",
          dateTime: null,
          timeZone: "EST",
          evidenceIds: [],
        },
      ],
    },
    {
      id: "submission",
      kind: "submission_close",
      sourceStatus: "reviewed",
      claims: [
        {
          id: "due",
          publishedText: "4 November, 21:00 ET",
          dateTime: null,
          timeZone: "ET",
          evidenceIds: [],
        },
      ],
    },
  ],
  requirements: [],
};
it("shows both conflicting source times and keeps project submission separate", () => {
  render(<PublishedEventOverview event={event} />);
  expect(screen.getByRole("heading", { name: "Applications close" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Project submission" })).toBeVisible();
  expect(screen.getByText("Source conflict — exact cutoff unconfirmed")).toBeVisible();
  expect(screen.getAllByText("Main page: 25 October, 23:59 ET")[0]).toBeVisible();
  expect(screen.getAllByText("Rules page: 25 October, 23:59 EST")[0]).toBeVisible();
  expect(screen.queryByRole("timer")).toBeNull();
});
it("shows published rubric weights separately from student progress", () => {
  const base = fixture.opportunity.requirements[0] as unknown as Requirement;
  const rules: Requirement[] = [
    ["impact", "Impact", 30],
    ["tooling", "Meta tooling", 25],
    ["engineering", "Engineering", 20],
    ["demo", "Demo", 25],
  ].map(([id, label, weight]) => ({
    ...base,
    id: `${event.id}-judging-${id}`,
    kind: "preparation_advice",
    lane: "preparation",
    isMandatory: false,
    subject: "project",
    sourceStatus: "reviewed",
    evaluation: { key: "unresolved", reason: "Published rubric only" },
    statement: `Prepare ${label}.`,
    claims: [{ value: `${label}: ${weight}%`, evidenceIds: [] }],
  }));
  render(<PublishedEventOverview event={{ ...event, requirements: rules }} />);
  expect(screen.getByRole("heading", { name: "How projects are judged" })).toBeVisible();
  expect(screen.getByText("30%")).toBeVisible();
  expect(
    screen.getByText(
      "Organizer-published judging weights, separate from student skills and application selection.",
    ),
  ).toBeVisible();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
it("does not invent benefits or a judging rubric when they are absent", () => {
  render(<PublishedEventOverview event={{ ...event, benefits: [], requirements: [] }} />);
  expect(screen.queryByRole("heading", { name: "What you can gain" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "How projects are judged" })).toBeNull();
});
