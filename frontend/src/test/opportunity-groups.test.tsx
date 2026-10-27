import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpportunityGroups } from "@/components/discover/OpportunityGroups";
import { DEMO_HACKATHONS } from "@/lib/discover/demo-data";
import type { Hackathon } from "@/lib/discover/types";

const renderCard = (event: Hackathon) => <article>{event.title}</article>;

describe("opportunity collections", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows named collections and opens only that collection's cards", () => {
    render(<OpportunityGroups items={DEMO_HACKATHONS} renderCard={renderCard} />);
    expect(screen.getByRole("button", { name: "Open AI & Data: 2 opportunities" })).toBeEnabled();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Open AI & Data: 2 opportunities" }));
    expect(screen.getByRole("button", { name: "Open AI & Data: 2 opportunities" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Open Web & Creative: 2 opportunities" }),
    ).toBeVisible();
    expect(screen.getAllByRole("article").map((node) => node.textContent)).toEqual([
      "Aurora AI Builders Weekend",
      "Tidewater Climate Data Jam",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Fold back into stack" }));
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Open Web & Creative: 2 opportunities" }),
    ).toBeVisible();
  });

  it("updates group counts from filtered results and preserves an open group's empty state", () => {
    const { rerender } = render(
      <OpportunityGroups items={DEMO_HACKATHONS} renderCard={renderCard} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open AI & Data: 2 opportunities" }));
    const web = DEMO_HACKATHONS.filter((event) => event.topics.includes("Web"));
    rerender(<OpportunityGroups items={web} renderCard={renderCard} />);
    expect(screen.getByText("No matches in this collection.")).toBeVisible();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Choose another group" }));
    expect(screen.getByRole("button", { name: "Open AI & Data: 0 opportunities" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Open Web & Creative: 2 opportunities" }),
    ).toBeEnabled();
  });

  it("can display all opportunities without duplicating cards", () => {
    render(<OpportunityGroups items={DEMO_HACKATHONS} renderCard={renderCard} />);
    fireEvent.click(screen.getByRole("button", { name: "View all 5 opportunities" }));
    expect(screen.getAllByRole("article")).toHaveLength(5);
  });
});
