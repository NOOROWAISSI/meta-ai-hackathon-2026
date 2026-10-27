import type { UserProfile } from "../discover/types";
import type { EventDetails, FitMatch, Requirement } from "./types";

export function analysisContext(details: EventDetails, profile: UserProfile) {
  return JSON.stringify([details.event.id, details.revision, details.sourceState, profile]);
}
export function hasPersonalProfile(profile: UserProfile) {
  return !!(
    profile.interests.length ||
    profile.skills.length ||
    profile.goals?.length ||
    profile.experience?.trim() ||
    (profile.entrantType && profile.entrantType !== "unknown") ||
    profile.teamSize
  );
}

/** Deterministic lane evaluation. A demo AI response never sets these statuses. */
export function evaluateRequirement(requirement: Requirement, profile: UserProfile): FitMatch {
  const evidence =
    profile.entrantType === "solo"
      ? "Self-report: participating alone (1 person)."
      : profile.teamSize
        ? `Self-report: team of ${profile.teamSize}.`
        : "Relevant profile information: not specified.";
  const result = (
    status: FitMatch["status"],
    explanation: string,
    profileEvidence = evidence,
    nextAction: string | null = null,
  ): FitMatch => ({ requirement, status, explanation, profileEvidence, nextAction });
  if (requirement.rule === "skill") {
    const reported = profile.skills.some(
      (skill) => skill.toLowerCase() === String(requirement.value).toLowerCase(),
    );
    return result(
      reported ? "Supported" : "Unknown",
      reported
        ? "You reported this skill. This is preparation advice, not verification of competence or eligibility."
        : "You have not reported this skill. That does not mean you lack it.",
      reported ? `Self-reported skill: ${requirement.value}` : "No self-report for this skill.",
      reported
        ? null
        : "Add relevant experience or decide whether practicing this skill would help.",
    );
  }
  if (requirement.sourceStatus === "conflicting")
    return result(
      "Source conflict",
      "The available demo claims disagree. No confident conclusion can be made.",
      evidence,
      "Inspect both claims and verify the organizer's current rules.",
    );
  if (requirement.sourceStatus !== "reviewed-demo")
    return result(
      "Unknown",
      requirement.sourceStatus === "stale"
        ? "The dated source snapshot is stale. Recheck the current rule before relying on it."
        : "The fixture has no reviewed organizer passage for this condition.",
      evidence,
      "Check the official rules; keep this condition unconfirmed until reviewed.",
    );
  if (requirement.rule === "unknown")
    return result(
      "Unknown",
      "The record does not contain enough information to evaluate this condition.",
      evidence,
      "Ask the organizer for the missing condition or submission checklist.",
    );
  if (requirement.rule === "solo-only") {
    if (!profile.entrantType || profile.entrantType === "unknown")
      return result(
        "Unknown",
        "Individual or team participation has not been reported.",
        evidence,
        "Edit your participation preference.",
      );
    return result(
      profile.entrantType === "solo" ? "Supported" : "Not met",
      "Compared with your explicitly reported participation choice. Synthetic reviewed-rule preview only.",
    );
  }
  if (
    profile.entrantType === "solo" &&
    Number(requirement.value) <= 1 &&
    requirement.rule === "team-min"
  )
    return result(
      "Not applicable",
      "This minimum adds no team restriction to an individual entrant in this demo scenario.",
    );
  const size = profile.entrantType === "solo" ? 1 : profile.teamSize;
  if (!size || !Number.isInteger(size) || size < 1)
    return result(
      "Unknown",
      "Your team size has not been reported.",
      evidence,
      "Add your team size, including yourself.",
    );
  const meets =
    requirement.rule === "team-min"
      ? size >= Number(requirement.value)
      : size <= Number(requirement.value);
  return result(
    meets ? "Supported" : "Not met",
    meets
      ? "Your self-reported team size matches this checked demo condition. Other participation rules remain separate."
      : "Your self-reported team size contradicts this checked mandatory demo condition.",
  );
}
export function hasHardBlocker(matches: FitMatch[]) {
  return matches.some(
    (match) =>
      match.requirement.lane === "participation" &&
      match.requirement.mandatory &&
      match.status === "Not met",
  );
}
export function reliableTargetDeadline(details: EventDetails): string | null {
  // Registration is not a project submission deadline. Unknown offsets are not instants.
  const deadline = details.submissionDeadline;
  if (
    details.sourceState !== "reviewed-demo" ||
    !deadline ||
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) ||
    !Number.isFinite(Date.parse(deadline))
  )
    return null;
  return deadline;
}
export function startTimeInZone(details: EventDetails, zone: string) {
  if (
    details.sourceState === "stale" ||
    details.sourceState === "conflicting" ||
    details.sourceState === "unavailable"
  )
    return "Not specified";
  if (
    !details.startInstant ||
    !details.originalZone ||
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(details.startInstant)
  )
    return "Not specified";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone,
    }).format(new Date(details.startInstant));
  } catch {
    return "Not specified";
  }
}
