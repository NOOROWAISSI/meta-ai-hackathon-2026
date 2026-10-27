import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";

function Toggle() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

describe("application theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.documentElement.classList.remove("dark");
  });

  it("starts light and restores the selected dark mode after remounting", () => {
    const view = render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("nextstep.theme")).toBe("dark");
    view.unmount();
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "dark" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("can change theme for the current visit when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(screen.getByRole("button", { name: "dark" })).toBeVisible();
    expect(document.documentElement).toHaveClass("dark");
  });
});
