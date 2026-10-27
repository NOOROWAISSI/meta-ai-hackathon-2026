import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/discover/demo-data";
import { confirmedProfile, profileCompletion, toDraft, validateDraft } from "@/lib/profile/model";
import { demoProfileService, PROFILE_KEY } from "@/lib/profile/service";
import { analysisContext } from "@/lib/details/logic";
import { buildEventDetails } from "@/lib/details/records";

const project = {
  id: "project-one",
  title: "Campus tool",
  description: "A team project",
  contribution: "I built the search interface in React.",
  technologies: ["React"],
  url: "",
};
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("confirmed student profiles", () => {
  it("keeps unknown availability separate from zero and accepts an otherwise blank profile", () => {
    const blank = toDraft(DEFAULT_PROFILE);
    expect(validateDraft(blank)).toEqual({});
    expect(confirmedProfile(blank).weeklyHours).toBeNull();
    expect(
      confirmedProfile({ ...blank, hoursInput: "0", entrantType: "unknown", teamSizeInput: "4" }),
    ).toMatchObject({ weeklyHours: 0, teamSize: null });
    expect(profileCompletion({ ...DEFAULT_PROFILE, weeklyHours: 0 }).completed).toBe(1);
    expect(profileCompletion(DEFAULT_PROFILE).completed).toBe(0);
  });
  it("validates project URLs, numbers and dates without requiring optional fields", () => {
    const draft = {
      ...toDraft(DEFAULT_PROFILE),
      hoursInput: "-1",
      targetDate: "2027-02-30",
      learningBudget: "paid" as const,
      budgetInput: "25",
      currency: "",
      entrantType: "team" as const,
      teamSizeInput: "2.5",
      projects: [{ ...project, url: "javascript:alert(1)" }],
    };
    const errors = validateDraft(draft);
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        "hoursInput",
        "targetDate",
        "currency",
        "teamSizeInput",
        "project.project-one.url",
      ]),
    );
    expect(
      validateDraft({
        ...toDraft(DEFAULT_PROFILE),
        projects: [{ ...project, url: "https://example.org/my-demo" }],
      }),
    ).toEqual({});
  });
  it("preserves the saved profile and completed plan when a save fails, then confirms a retry", async () => {
    const previous = { ...DEFAULT_PROFILE, version: 1 };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(previous));
    localStorage.setItem(
      "nextstep.plan.aurora-ai",
      JSON.stringify({ tasks: [{ id: "done-task", status: "done" }] }),
    );
    const plan = localStorage.getItem("nextstep.plan.aurora-ai");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await expect(
      demoProfileService.save({ ...previous, weeklyHours: 0 }, previous),
    ).rejects.toThrow("quota");
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!)).toEqual(previous);
    write.mockRestore();
    const saved = await demoProfileService.save({ ...previous, weeklyHours: 0 }, previous);
    expect(saved).toMatchObject({ weeklyHours: 0, version: 2 });
    expect(localStorage.getItem("nextstep.plan.aurora-ai")).toBe(plan);
    expect(await demoProfileService.load()).toEqual(saved);
  });
  it("marks relevant analysis changes, but display name changes do not invalidate comparison", () => {
    const details = buildEventDetails("aurora-ai")!;
    const context = analysisContext(details, DEFAULT_PROFILE);
    expect(
      analysisContext(details, {
        ...DEFAULT_PROFILE,
        displayName: "Student",
        avatarDataUrl: "data:image/png;base64,aGVsbG8=",
        savedAt: "2026-01-01",
        version: 9,
      }),
    ).toBe(context);
    expect(analysisContext(details, { ...DEFAULT_PROFILE, skills: ["React"] })).not.toBe(context);
  });
  it("does not overwrite a newer profile saved in another tab", async () => {
    const previous = { ...DEFAULT_PROFILE, version: 1 };
    const newer = { ...previous, skills: ["Python"], version: 2 };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newer));
    await expect(
      demoProfileService.save({ ...previous, skills: ["React"] }, previous),
    ).rejects.toThrow("another tab");
    expect(JSON.parse(localStorage.getItem(PROFILE_KEY)!)).toEqual(newer);
  });
  it("asks for personal contribution instead of inventing team achievements", async () => {
    const suggestion = await demoProfileService.suggestExperience({
      ...project,
      contribution: "We built a great tool.",
    });
    expect(suggestion.clarification).toMatch(/personally/);
    expect(suggestion.proposed).toBe("");
    expect(suggestion.suggestedSkills).toEqual([]);
    const faithful = await demoProfileService.suggestExperience(project);
    expect(faithful.original).toBe(project.contribution);
    expect(faithful.proposed).toBe(`My contribution: ${project.contribution}`);
    expect(faithful.suggestedSkills).toEqual(["React"]);
  });
});
