import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { JoinedHackathons } from "@/components/account/JoinedHackathons";
import type { ListingSummary } from "@/lib/catalog/service";

vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ t: (en: string) => en }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string;
    search?: Record<string, string>;
    children: ReactNode;
  }) => (
    <a href={to + (search ? "?" + new URLSearchParams(search).toString() : "")} {...props}>
      {children}
    </a>
  ),
}));
afterEach(cleanup);
const event: ListingSummary = {
  id: "meta-global-ai-2026",
  kind: "hackathon",
  title: "Meta Global AI Developer Hackathon 2026",
  organizer: "Meta",
  format: "online",
  officialUrl: "https://example.invalid/event",
  summary: "Synthetic source description",
  topics: ["AI"],
  scope: "global_online",
  registrationDeadline: null,
  registrationState: "not_specified",
  costStatus: "unknown",
  lastReviewedAt: null,
  sourceStatus: "needs_verification",
  sourcePassage: null,
  verificationNote: "Synthetic source",
};
const answer = {
  questionId: `participation-selection:${event.id}`,
  answer: "accepted",
  answeredAt: "2026-10-29T18:00:00Z",
};
it("shows reported participation even before a preparation plan exists", () => {
  render(<JoinedHackathons listings={[event]} answers={[answer]} plans={[]} />);
  expect(screen.getByRole("heading", { name: "Your hackathons" })).toBeVisible();
  expect(screen.getByText(event.title)).toBeVisible();
  expect(screen.getByText("Preparation plan not created yet.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Open preparation" })).toHaveAttribute(
    "href",
    "/plans?event=meta-global-ai-2026",
  );
  expect(screen.queryByText("Continue plan")).toBeNull();
});
it("does not duplicate a hackathon in the unplanned list after a confirmed plan exists", () => {
  const view = render(
    <JoinedHackathons
      listings={[event]}
      answers={[answer]}
      plans={[
        {
          context: {
            opportunityId: event.id,
            profileId: "profile-test",
            profileVersion: 1,
            sourceRevision: "review-test",
            submissionVersion: 1,
          },
        },
      ]}
    />,
  );
  expect(view.container).toBeEmptyDOMElement();
});
it("does not invent participation from missing, superseded or course answers", () => {
  const view = render(<JoinedHackathons listings={[event]} answers={[]} plans={[]} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(
    <JoinedHackathons
      listings={[event]}
      answers={[answer, { ...answer, answer: "unknown" }]}
      plans={[]}
    />,
  );
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(
    <JoinedHackathons listings={[{ ...event, kind: "course" }]} answers={[answer]} plans={[]} />,
  );
  expect(view.container).toBeEmptyDOMElement();
});
