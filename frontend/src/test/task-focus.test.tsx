import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TaskDrawer } from "@/components/preparation/TaskDrawer";
import fixture from "@/lib/contract/sample-payload.json";
import type { Plan } from "@/lib/contract/types";
import type { PreparationBundle } from "@/lib/preparation/logic";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Harness() {
  const [open, setOpen] = useState(false);
  const plan = fixture.plan as Plan;
  const bundle = {
    opportunity: fixture.opportunity,
    profile: fixture.profile,
    resources: [],
    submission: fixture.submission,
  } as unknown as PreparationBundle;
  return (
    <>
      <button>Previous task</button>
      <button onClick={() => setOpen(true)}>View task</button>
      {open && (
        <TaskDrawer
          task={plan.tasks[0]!}
          plan={plan}
          bundle={bundle}
          onClose={() => setOpen(false)}
          onSaved={() => {}}
          failNextSave={false}
          onFailureUsed={() => {}}
        />
      )}
    </>
  );
}
for (const dismissal of ["Escape", "Close"] as const) {
  it(`returns focus to the invoking task control after ${dismissal}`, async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "View task" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    if (dismissal === "Escape") fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.getByRole("button", { name: "Previous task" })).not.toHaveFocus();
  });
}
it("keeps the dialog open when an unsaved-change dismissal is cancelled", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "View task" });
  opener.focus();
  fireEvent.click(opener);
  await screen.findByRole("dialog");
  const status = screen.getByRole("radio", { name: "In progress" });
  fireEvent.click(status);
  fireEvent.keyDown(status, { key: "Escape" });
  expect(window.confirm).toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(opener).not.toHaveFocus();
});
