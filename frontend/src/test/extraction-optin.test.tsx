import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ExtractionOptInPanel } from "@/components/profile/ExtractionOptInPanel";
import type { ProfessionalSource } from "@/lib/profile/evidence";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.dir = "ltr";
  document.documentElement.lang = "en";
});

const source: ProfessionalSource = {
  id: "src-1",
  kind: "cv",
  title: "My CV.pdf",
  url: null,
  revision: null,
  importedAt: "2026-11-02T00:00:00Z",
  chunks: [{ id: "c1", locator: "page 1", text: "Built a React interface." }],
  warnings: [],
};

it("extraction disclosure names Meta, the per-document rule, and the withdrawal limit", () => {
  const onOptIn = vi.fn();
  const onWithdraw = vi.fn();
  render(
    <LocaleProvider>
      <ExtractionOptInPanel
        sources={[source]}
        statuses={{
          "src-1": {
            currentVersion: 1,
            optedIn: false,
            optedInAt: null,
            optedInVersion: null,
          },
        }}
        busy={false}
        onOptIn={onOptIn}
        onWithdraw={onWithdraw}
      />
    </LocaleProvider>,
  );
  expect(screen.getByText(/sent to Meta AI through the backend/)).toBeVisible();
  expect(screen.getByText(/per document and recorded on the server/)).toBeVisible();
  expect(screen.getByText(/separate from the plan-generation acknowledgment/)).toBeVisible();
  expect(screen.getByText(/cannot retract text already sent/)).toBeVisible();
  expect(screen.getByText("My CV.pdf")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Opt in for this document" }));
  expect(onOptIn).toHaveBeenCalledWith("src-1");
  expect(onWithdraw).not.toHaveBeenCalled();
});

it("an opted-in source offers withdrawal instead of opt-in", () => {
  const onOptIn = vi.fn();
  const onWithdraw = vi.fn();
  render(
    <LocaleProvider>
      <ExtractionOptInPanel
        sources={[source]}
        statuses={{
          "src-1": {
            currentVersion: 1,
            optedIn: true,
            optedInAt: "2026-11-02T00:00:00Z",
            optedInVersion: 1,
          },
        }}
        busy={false}
        onOptIn={onOptIn}
        onWithdraw={onWithdraw}
      />
    </LocaleProvider>,
  );
  expect(screen.getByText("Opted in")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
  expect(onWithdraw).toHaveBeenCalledWith("src-1");
  expect(onOptIn).not.toHaveBeenCalled();
});

it("extraction disclosure renders in Arabic", () => {
  localStorage.setItem("nextstep.language", "ar");
  render(
    <LocaleProvider>
      <ExtractionOptInPanel
        sources={[source]}
        statuses={{}}
        busy={false}
        onOptIn={() => {}}
        onWithdraw={() => {}}
      />
    </LocaleProvider>,
  );
  expect(screen.getByText(/بينرسل لـMeta AI عبر الباك/)).toBeVisible();
  expect(screen.getByRole("button", { name: "اسمح لهدا المستند" })).toBeVisible();
});
