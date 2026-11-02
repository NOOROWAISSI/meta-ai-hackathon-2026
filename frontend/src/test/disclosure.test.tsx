import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/LocaleProvider";
import { DisclosurePanel } from "@/components/account/DisclosurePanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.dir = "ltr";
  document.documentElement.lang = "en";
});

it("disclosure names the provider, what is sent, and what stays, and decline sends nothing", () => {
  const onAcknowledge = vi.fn();
  const onDecline = vi.fn();
  render(
    <LocaleProvider>
      <DisclosurePanel onAcknowledge={onAcknowledge} onDecline={onDecline} />
    </LocaleProvider>,
  );
  expect(
    screen.getByRole("heading", { name: /How your information is used to generate a draft/ }),
  ).toBeVisible();
  expect(screen.getByText(/Draft generation is done by Meta AI, an external provider/)).toBeVisible();
  expect(screen.getByText("Your available hours per week")).toBeVisible();
  expect(screen.getByText(/are never sent/)).toBeVisible();
  expect(screen.getByText(/You can withdraw this acknowledgment at any time/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(onDecline).toHaveBeenCalledTimes(1);
  expect(onAcknowledge).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "I understand, generate my draft" }));
  expect(onAcknowledge).toHaveBeenCalledTimes(1);
});

it("disclosure renders in Arabic with right-to-left direction", async () => {
  localStorage.setItem("nextstep.language", "ar");
  render(
    <LocaleProvider>
      <DisclosurePanel onAcknowledge={() => {}} onDecline={() => {}} />
    </LocaleProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: /كيف تُستخدم معلوماتك/ })).toBeVisible(),
  );
  expect(document.documentElement.dir).toBe("rtl");
  expect(screen.getByText(/Meta AI، وهو مزوّد خارجي/)).toBeVisible();
  expect(screen.getByRole("button", { name: "فهمت، أنشئ مسودتي" })).toBeVisible();
  expect(screen.getByRole("button", { name: "ليس الآن" })).toBeVisible();
});
