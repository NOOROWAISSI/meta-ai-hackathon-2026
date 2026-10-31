import type { StudentProfile } from "@/lib/contract/types";
import type { UserProfile } from "@/lib/discover/types";
import type { ProfileService } from "./service";
import { accountApi, type ProfileEnvelope } from "@/lib/account/api";
import { toStudentProfile } from "@/lib/preparation/adapters";
import { EMPTY_PROFILE } from "./defaults";
import { GOALS } from "./model";
const snapshots = new WeakMap<UserProfile, ProfileEnvelope>();
export function fromAccountProfile(value: ProfileEnvelope): UserProfile {
  const p = value.profile;
  const editor = value.editor ?? {};
  const result: UserProfile = {
    ...EMPTY_PROFILE,
    ...editor,
    displayName: editor.displayName ?? value.displayName,
    version: p.version,
    interests: p.interests,
    skills: p.skills.filter((s) => s.state === "reported_has").map((s) => s.label),
    weeklyHours: p.availableHoursPerWeek.state === "known" ? p.availableHoursPerWeek.value : null,
    experience: p.background,
    goals: p.goals.map((g) => g.statement),
    goalChoice: editor.goalChoice ?? "unknown",
    goalDescription: p.goals
      .filter((g) =>
        editor.goalChoice === "now" ||
        editor.goalChoice === "prepare" ||
        editor.goalChoice === "explore"
          ? g.statement !== GOALS[editor.goalChoice]
          : true,
      )
      .map((g) => g.statement)
      .join("\n"),
    preferredFormat:
      p.preferredFormats[0] === "in_person" ? "onsite" : (p.preferredFormats[0] ?? "unknown"),
    entrantType:
      p.entrantType.state === "known"
        ? p.entrantType.value === "individual"
          ? "solo"
          : p.entrantType.value === "team"
            ? "team"
            : "unknown"
        : "unknown",
    teamSize: p.team.size.state === "known" ? p.team.size.value : null,
    residence:
      p.residence.country.state === "known" ? p.residence.country.value : (editor.residence ?? ""),
    educationStatus:
      p.enrollment.state === "known" && p.enrollment.value === "higher_education"
        ? "university"
        : (editor.educationStatus ?? "unknown"),
    constraints: p.constraints.join("\n"),
    learningLanguage: p.preferredLanguage ?? editor.learningLanguage ?? "",
    projects:
      editor.projects ??
      p.projectExperience.map((project) => ({
        id: project.id,
        title: "Project experience",
        description: project.description,
        contribution: "",
        technologies: [],
        url: "",
      })),
  };
  snapshots.set(result, value);
  return result;
}
export function projectAccountProfile(
  editor: UserProfile,
  original: StudentProfile,
  previous?: UserProfile,
): StudentProfile {
  const projected = toStudentProfile(editor);
  return {
    ...original,
    ...projected,
    id: original.id,
    version: original.version,
    reportedAge: original.reportedAge,
    majority: original.majority,
    residence: { ...original.residence, country: projected.residence.country },
    team: { ...original.team, size: projected.team.size },
    ...(previous && editor.educationStatus === previous.educationStatus
      ? { enrollment: original.enrollment }
      : {}),
    ...(previous && editor.entrantType === previous.entrantType
      ? { entrantType: original.entrantType }
      : {}),
    ...(previous && editor.weeklyHours === previous.weeklyHours
      ? { availableHoursPerWeek: original.availableHoursPerWeek }
      : {}),
    ...(previous && editor.preferredFormat === previous.preferredFormat
      ? { preferredFormats: original.preferredFormats }
      : {}),
    ...(previous && editor.constraints === previous.constraints
      ? { constraints: original.constraints }
      : {}),
    ...(previous && JSON.stringify(editor.projects) === JSON.stringify(previous.projects)
      ? { projectExperience: original.projectExperience }
      : {}),
    goals: projected.goals.map(
      (goal) => original.goals.find((previous) => previous.statement === goal.statement) ?? goal,
    ),
    ...(previous &&
    editor.goalChoice === previous.goalChoice &&
    editor.goalDescription === previous.goalDescription
      ? { goals: original.goals }
      : {}),
    skills: [
      ...projected.skills.map(
        (skill) =>
          original.skills.find(
            (previous) => previous.state === "reported_has" && previous.label === skill.label,
          ) ?? skill,
      ),
      ...original.skills.filter(
        (skill) =>
          skill.state !== "reported_has" &&
          !projected.skills.some((next) => next.label === skill.label),
      ),
    ],
    acceptedInterpretations: original.acceptedInterpretations.filter((interpretation) =>
      projected.projectExperience.some((project) => project.id === interpretation.experienceId),
    ),
    clarificationAnswers: original.clarificationAnswers,
  };
}
export const serverProfileService: ProfileService = {
  kind: "server",
  suggestionsAvailable: false,
  async load() {
    return fromAccountProfile(await accountApi.profileEditor());
  },
  async save(profile, previous) {
    const snapshot = snapshots.get(previous);
    if (!snapshot)
      throw new Error("Reload your account profile before saving. Your draft is preserved.");
    return fromAccountProfile(
      await accountApi.saveEditor(
        snapshot.profile,
        projectAccountProfile(profile, snapshot.profile, previous),
        profile,
      ),
    );
  },
  async normalizeSkills(skills) {
    return Array.from(
      new Map(skills.map((skill) => [skill.trim().toLowerCase(), skill.trim()])).values(),
    ).filter(Boolean);
  },
  async suggestExperience() {
    throw new Error(
      "Experience suggestions are awaiting the reviewed Meta integration. No experience has been added.",
    );
  },
};
