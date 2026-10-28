import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LanguageToggle, LocaleProvider, useLocale } from "@/components/LocaleProvider";
import { translateCatalog } from "@/lib/catalog/translation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.documentElement.dir = "ltr";
  document.documentElement.lang = "en";
});
function Preview() {
  const { t } = useLocale();
  return (
    <>
      <LanguageToggle />
      <p>{t("Saved", "المحفوظات")}</p>
    </>
  );
}
it("language changes direction and labels while surviving a new page mount", async () => {
  const first = render(
    <LocaleProvider>
      <Preview />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "التبديل للعربية" }));
  expect(screen.getByText("المحفوظات")).toBeVisible();
  expect(document.documentElement.dir).toBe("rtl");
  first.unmount();
  render(
    <LocaleProvider>
      <Preview />
    </LocaleProvider>,
  );
  await waitFor(() => expect(screen.getByText("المحفوظات")).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
  expect(document.documentElement.dir).toBe("ltr");
});
it("an unavailable translation rejects without changing original catalog data", async () => {
  vi.stubEnv("VITE_ENABLE_META_TRANSLATION", "true");
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
  vi.stubGlobal("fetch", fetcher);
  await expect(translateCatalog("ar")).rejects.toThrow("Original content is preserved");
  expect(fetcher.mock.calls[1]?.[0]).toBe("/api/localization/catalog");
  expect(fetcher.mock.calls[1]?.[1].body).toBe('{"language":"ar"}');
});
it("does not call a Meta integration before it is enabled", async () => {
  vi.stubEnv("VITE_ENABLE_META_TRANSLATION", "false");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(translateCatalog("ar")).rejects.toThrow("separately reviewed Meta integration");
  expect(fetcher).not.toHaveBeenCalled();
});
