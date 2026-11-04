import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventAgeFields } from "@/components/profile/EventAgeFields";
import { ageConditions } from "@/lib/profile/age-conditions";
import { fromAccountProfile, projectAccountProfile } from "@/lib/profile/server";
import { confirmedProfile, toDraft, validateDraft } from "@/lib/profile/model";
import { EMPTY_PROFILE } from "@/lib/profile/defaults";
import fixture from "@/lib/contract/sample-payload.json";
import type { StudentProfile, Opportunity } from "@/lib/contract/types";
afterEach(cleanup);
it("does not collect age without a reviewed selected-event condition", () => {
  render(<EventAgeFields draft={toDraft(EMPTY_PROFILE)} update={() => {}} errors={{}} />);
  expect(screen.queryByLabelText(/Age in whole years/)).toBeNull();
  expect(ageConditions()).toBeUndefined();
  const event = { ...fixture.opportunity, informationFreshness: "stale" } as Opportunity;
  expect(ageConditions(event)).toBeUndefined();
});
it("keeps age optional, validates whole years and never derives legal majority", () => {
  const draft = toDraft(EMPTY_PROFILE);
  const update = vi.fn();
  render(
    <EventAgeFields
      conditions={{ minimumAge: true, majority: true, sources: [] }}
      draft={draft}
      update={update}
      errors={{}}
    />,
  );
  fireEvent.change(screen.getByLabelText(/Age in whole years/), { target: { value: "22" } });
  expect(update).toHaveBeenCalledWith({ ageInput: "22" });
  expect(screen.getByLabelText(/legal age of majority/)).toBeDisabled();
  expect(validateDraft({ ...draft, ageInput: "22.5" })["ageInput"]).toBeTruthy();
  expect(confirmedProfile({ ...draft, ageInput: "" }).reportedAge).toBeNull();
});
it("loads and saves canonical self-reports while preserving untouched facts and jurisdiction", () => {
  const original = {
    ...fixture.profile,
    reportedAge: { state: "known", value: 22, reportedAt: "2026-10-31T00:00:00Z" },
    majority: {
      jurisdiction: "PS",
      reached: { state: "known", value: true, reportedAt: "2026-10-31T00:00:00Z" },
    },
  } as StudentProfile;
  const view = fromAccountProfile({ profile: original, editor: {}, displayName: "Student" });
  expect(view.reportedAge).toBe(22);
  expect(view.majorityReached).toBe("yes");
  const unchanged = projectAccountProfile({ ...view, displayName: "Changed" }, original, view);
  expect(unchanged.reportedAge).toEqual(original.reportedAge);
  expect(unchanged.majority).toEqual(original.majority);
  const edited = projectAccountProfile(
    { ...view, reportedAge: null, majorityReached: "unknown" },
    original,
    view,
  );
  expect(edited.reportedAge.state).toBe("unknown");
  expect(edited.majority.reached.state).toBe("unknown");
});
