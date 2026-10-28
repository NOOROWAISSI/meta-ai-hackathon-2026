// Archived browser-demo adapter for regression tests only. Not imported by application routes.
import type { ProfileProject, UserProfile } from "@/lib/discover/types";
import type { ProfileService } from "@/lib/profile/service";
import { DEFAULT_PROFILE } from "@/lib/discover/demo-data";
import { profileAnalysisFacts, toDraft, validateDraft } from "@/lib/profile/model";
import { readRecord, updateRecord } from "@/lib/storage/database";

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const PROFILE_KEY = "nextstep.profile";

async function readProfile(): Promise<UserProfile> {
  const value = await readRecord<UserProfile>(PROFILE_KEY, structuredClone(DEFAULT_PROFILE));
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
    const relevantChanged =
      JSON.stringify(profileAnalysisFacts(profile)) !==
      JSON.stringify(profileAnalysisFacts(previous));
    const confirmed: UserProfile = {
      ...profile,
      version: (previous.version ?? 0) + (relevantChanged || !previous.savedAt ? 1 : 0),
      savedAt: new Date().toISOString(),
    };
    return updateRecord<UserProfile>(PROFILE_KEY, DEFAULT_PROFILE, (current) => {
      if (
        (current.version ?? 0) !== (previous.version ?? 0) ||
        JSON.stringify(current) !== JSON.stringify(previous)
      )
        throw new Error(
          "Your saved profile changed in another tab. Your draft is kept; compare the latest profile before saving.",
        );
      return confirmed;
    });
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
