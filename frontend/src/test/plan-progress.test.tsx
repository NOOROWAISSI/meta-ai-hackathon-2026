import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PlanProgress } from "@/components/preparation/PlanProgress";
afterEach(cleanup);
it("labels progress as completed tasks and keeps remaining effort separate", () => {
  render(<PlanProgress done={1} total={6} remainingHours={21} />);
  expect(screen.getByRole("progressbar", { name: "Task progress" })).toHaveAttribute(
    "aria-valuenow",
    "17",
  );
  expect(screen.getByText("1 of 6 tasks completed")).toBeVisible();
  expect(screen.getByText("21h")).toBeVisible();
  expect(screen.queryByText(/eligibility|readiness|competence/i)).toBeNull();
});
it("handles an empty plan without inventing completed work", () => {
  render(<PlanProgress done={0} total={0} remainingHours={0} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByText("0 of 0 tasks completed")).toBeVisible();
});
