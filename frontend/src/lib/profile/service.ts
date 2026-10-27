import type { ProfileProject, UserProfile } from "../discover/types";
import { DEFAULT_PROFILE } from "../discover/demo-data";
import { profileAnalysisFacts, toDraft, validateDraft } from "./model";

export interface ExperienceSuggestion {
  projectId: string;
  original: string;
  proposed: string;
  suggestedSkills: string[];
  clarification: string | null;
}

/** Future ASP.NET Core boundary. Never put a Meta key or model SDK in this module. */
export interface ProfileService {
  load(): Promise<UserProfile>;
  save(profile: UserProfile, previous: UserProfile, fail?: boolean): Promise<UserProfile>;
  suggestExperience(project: ProfileProject, fail?: boolean): Promise<ExperienceSuggestion>;
  normalizeSkills(skills: string[]): Promise<string[]>;
}
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const PROFILE_KEY = "nextstep.profile";

function readProfile(): UserProfile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return structuredClone(DEFAULT_PROFILE);
  const value = JSON.parse(raw) as UserProfile;
  if (
    !value ||
    !Array.isArray(value.interests) ||
    !Array.isArray(value.skills) ||
    !value.interests.every((v) => typeof v === "string") ||
    !value.skills.every((v) => typeof v === "string") ||
    !(
      value.weeklyHours === null ||
      (typeof value.weeklyHours === "number" && Number.isFinite(value.weeklyHours))
    )
  )
    throw new Error("The saved profile could not be read. Existing data has not been changed.");
  return value;
}

export const demoProfileService: ProfileService = {
  async load() {
    await pause(100);
    return readProfile();
  },
  async save(profile, previous, fail = false) {
    await pause(450);
    if (fail) throw new Error("Demo save failure. Your edits are still here; retry when ready.");
    if (Object.keys(validateDraft(toDraft(profile))).length)
      throw new Error("Some profile fields are invalid. Your saved information has not changed.");
    const current = readProfile();
    if (
      (current.version ?? 0) !== (previous.version ?? 0) ||
      JSON.stringify(current) !== JSON.stringify(previous)
    )
      throw new Error(
        "Your saved profile changed in another tab. Keep these edits, then reload the profile in another tab to compare before saving.",
      );
    const relevantChanged =
      JSON.stringify(profileAnalysisFacts(profile)) !==
      JSON.stringify(profileAnalysisFacts(previous));
    const confirmed: UserProfile = {
      ...profile,
      version: (previous.version ?? 0) + (relevantChanged || !previous.savedAt ? 1 : 0),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(confirmed));
    window.dispatchEvent(new Event("nextstep:storage"));
    return confirmed;
  },
  async normalizeSkills(skills) {
    // Demo normalization is limited to whitespace and case-insensitive deduplication.
    return skills
      .map((skill) => skill.trim())
      .filter(
        (skill, index, all) =>
          !!skill &&
          all.findIndex((entry) => entry.toLowerCase() === skill.toLowerCase()) === index,
      );
  },
  async suggestExperience(project, fail = false) {
    await pause(550);
    if (fail) throw new Error("Demo suggestion unavailable. Your original project is unchanged.");
    const contribution = project.contribution.trim();
    const clear = contribution.length >= 12 && !/^(we|our team|the team)\b/i.test(contribution);
    return {
      projectId: project.id,
      original: project.contribution,
      proposed: clear ? `My contribution: ${contribution}` : "",
      suggestedSkills: clear ? await demoProfileService.normalizeSkills(project.technologies) : [],
      clarification: clear
        ? null
        : "What did you personally build, design, test, or research? Describe your own part before requesting wording help.",
    };
  },
};

export const profileService: ProfileService = demoProfileService;
