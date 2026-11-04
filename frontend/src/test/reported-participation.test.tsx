import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReportedParticipation } from "@/components/catalog/ReportedParticipation";

vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ t: (en: string) => en }) }));
afterEach(cleanup);
const answer = {
  questionId: "participation-selection:meta-global-ai-2026",
  answer: "accepted",
  answeredAt: "2026-10-29T18:00:00Z",
};
it("labels the student's confirmed participation answer as self-reported", () => {
  render(<ReportedParticipation opportunityId="meta-global-ai-2026" answers={[answer]} />);
  expect(screen.getByText("Accepted participant")).toBeVisible();
  expect(screen.getByText("Reported by you · not independently verified")).toBeVisible();
  expect(screen.queryByText("You are eligible")).toBeNull();
});
it("never shows another event's participation or an invalid report as accepted", () => {
  const view = render(<ReportedParticipation opportunityId="E01" answers={[answer]} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(
    <ReportedParticipation
      opportunityId="meta-global-ai-2026"
      answers={[{ ...answer, answeredAt: "2026-10-29" }]}
    />,
  );
  expect(view.container).toBeEmptyDOMElement();
});
it("uses the latest answer without treating an unknown answer as a failure or acceptance", () => {
  const view = render(
    <ReportedParticipation
      opportunityId="meta-global-ai-2026"
      answers={[answer, { ...answer, answer: "unknown" }]}
    />,
  );
  expect(view.container).toBeEmptyDOMElement();
});
