import { isContractDate } from "../contract/time";
import type { UserProfile } from "../discover/types";

export const GOALS = {
  now: "Find an opportunity I can pursue now.",
  prepare: "Prepare for an upcoming opportunity.",
  explore: "Explore opportunities in my interests.",
} as const;

export interface ProfileDraft extends Omit<UserProfile, "weeklyHours" | "teamSize" | "maxBudget"> {
  hoursInput: string;
  teamSizeInput: string;
  budgetInput: string;
}
export type ProfileErrors = Record<string, string>;

export function toDraft(profile: UserProfile): ProfileDraft {
  const { weeklyHours, teamSize, maxBudget, ...rest } = profile;
  return {
    ...structuredClone(rest),
    hoursInput: weeklyHours?.toString() ?? "",
    teamSizeInput: teamSize?.toString() ?? "",
    budgetInput: maxBudget?.toString() ?? "",
  };
}

export function validateDraft(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {};
  if (
    draft.avatarDataUrl &&
    (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(draft.avatarDataUrl) ||
      draft.avatarDataUrl.length > 560_000)
  )
    errors["avatarDataUrl"] = "Choose a PNG, JPG, or WebP image up to 400 KB.";
  const numeric = (key: string, input: string, max: number, integer = false) => {
    if (!input.trim()) return;
    const value = Number(input);
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > max ||
      (integer && (!Number.isInteger(value) || value < 1))
    )
      errors[key] = integer
        ? `Enter a whole number from 1 to ${max}, or leave unknown.`
        : `Enter a number from 0 to ${max}, or leave unknown.`;
  };
  numeric("hoursInput", draft.hoursInput, 168);
  if (draft.entrantType === "team") numeric("teamSizeInput", draft.teamSizeInput, 100, true);
  if (draft.learningBudget === "paid") numeric("budgetInput", draft.budgetInput, 1_000_000);
  if (
    draft.learningBudget === "paid" &&
    draft.budgetInput.trim() &&
    !/^[A-Z]{3}$/.test(draft.currency ?? "")
  )
    errors["currency"] = "Choose a currency for your maximum budget.";
  if (draft.targetDate && !isContractDate(draft.targetDate))
    errors["targetDate"] = "Enter a valid calendar date.";
  for (const project of draft.projects ?? []) {
    const prefix = `project.${project.id}`;
    if (!project.title.trim())
      errors[`${prefix}.title`] = "Give this project a title, or remove the empty entry.";
    if (project.url.trim()) {
      try {
        const url = new URL(project.url);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      } catch {
        errors[`${prefix}.url`] = "Use a complete http:// or https:// repository or demo URL.";
      }
    }
  }
  return errors;
}

export function confirmedProfile(draft: ProfileDraft): UserProfile {
  const { hoursInput, teamSizeInput, budgetInput, ...rest } = structuredClone(draft);
  const goals =
    draft.goalChoice && draft.goalChoice !== "unknown"
      ? [
          GOALS[draft.goalChoice],
          ...(draft.goalDescription?.trim() ? [draft.goalDescription.trim()] : []),
        ]
      : draft.goalDescription !== undefined
        ? draft.goalDescription.trim()
          ? [draft.goalDescription.trim()]
          : []
        : draft.goals;
  return {
    ...rest,
    weeklyHours: hoursInput.trim() === "" ? null : Number(hoursInput),
    teamSize:
      draft.entrantType === "solo"
        ? 1
        : draft.entrantType === "team" && teamSizeInput.trim() !== ""
          ? Number(teamSizeInput)
          : null,
    maxBudget:
      draft.learningBudget === "paid" && budgetInput.trim() !== "" ? Number(budgetInput) : null,
    ...(goals ? { goals } : {}),
  };
}

/** Contact/display metadata does not change an opportunity comparison. */
export function profileAnalysisFacts(profile: UserProfile) {
  const { displayName, avatarDataUrl, savedAt, version, ...facts } = profile;
  return facts;
}

export function profileCompletion(profile: UserProfile) {
  const checks = [
    ["Education status", !!profile.educationStatus && profile.educationStatus !== "unknown"],
    ["Field of study", !!profile.fieldOfStudy?.trim()],
    ["Residence preference", !!profile.residence],
    ["Interests", profile.interests.length > 0],
    ["Goal", (!!profile.goalChoice && profile.goalChoice !== "unknown") || !!profile.goals?.length],
    ["Participation format", !!profile.preferredFormat && profile.preferredFormat !== "unknown"],
    ["Reported skills", profile.skills.length > 0],
    [
      "Weekly availability",
      profile.weeklyHours !== null &&
        Number.isFinite(profile.weeklyHours) &&
        profile.weeklyHours >= 0 &&
        profile.weeklyHours <= 168,
    ],
    [
      "Learning budget preference",
      !!profile.learningBudget && profile.learningBudget !== "unknown",
    ],
    ["Learning language", !!profile.learningLanguage?.trim()],
    ["Team preference", !!profile.entrantType && profile.entrantType !== "unknown"],
  ] as const;
  return { completed: checks.filter(([, done]) => done).length, total: checks.length, checks };
}
