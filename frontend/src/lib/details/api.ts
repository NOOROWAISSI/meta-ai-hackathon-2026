/** Future backend boundary. These async functions return labelled fixture/template output;
 * no provider SDK, model credentials, or browser-to-model requests belong here.
 * Replace with validated backend DTOs when integration is agreed.
 */
import type { UserProfile } from "../discover/types";
import {
  analysisContext,
  evaluateRequirement,
  hasHardBlocker,
  reliableTargetDeadline,
} from "./logic";
import { buildEventDetails } from "./records";
import type {
  AnalysisSnapshot,
  DetailsState,
  EventDetails,
  OpportunityAnswer,
  PreparationPlan,
} from "./types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function fetchEventDetails(
  id: string,
  state: DetailsState,
): Promise<EventDetails | null> {
  await wait(state === "loading" ? 1_000_000 : 300);
  if (state === "unavailable")
    throw new Error(
      "This opportunity could not be loaded. Your discovery search and saved items have been preserved.",
    );
  return buildEventDetails(id, state);
}
export async function requestPersonalAnalysis(
  details: EventDetails,
  profile: UserProfile,
  fail = false,
): Promise<AnalysisSnapshot> {
  await wait(650);
  if (fail)
    throw new Error(
      "Demo analysis is temporarily unavailable. Public event details are still available.",
    );
  const topics = profile.interests.filter((interest) =>
    details.event.topics.some((topic) => topic.toLowerCase() === interest.toLowerCase()),
  );
  const skills = profile.skills.filter((skill) =>
    details.event.relatedSkills.some((related) => related.toLowerCase() === skill.toLowerCase()),
  );
  return {
    context: analysisContext(details, profile),
    profile: structuredClone(profile),
    generatedAt: new Date().toISOString(),
    matches: details.requirements.map((requirement) => evaluateRequirement(requirement, profile)),
    sections: [
      {
        title: "Interests & goals",
        text: `${topics.length ? `Your reported interests in ${topics.join(", ")} overlap with this demo's topics.` : "No direct interest overlap is recorded. You can still explore this opportunity."} ${profile.goals?.length ? `Your stated goals: ${profile.goals.join("; ")}. The event's ability to support these goals is not verified.` : "Your goals are not specified."}`,
      },
      {
        title: "Existing experience",
        text: `${skills.length ? `Related self-reported skills: ${skills.join(", ")}.` : "No related skills have been reported."} ${profile.experience?.trim() ? `Your description: ${profile.experience.trim()}` : ""} ${profile.projects?.length ? `Self-reported project contributions: ${profile.projects.map((project) => `${project.title}: ${project.contribution.trim() || "personal contribution not specified"}`).join("; ")}.` : !profile.experience?.trim() ? "Project experience is not specified." : ""} This is not independently verified competence; repository links are artifacts, not independent proof.`,
      },
      {
        title: "Information to clarify",
        text: "Verify the participation conditions, submission checklist, submission deadline, and original time zone. The demo record does not provide reviewed answers.",
      },
      {
        title: "Worth preparing",
        text: `${details.deliverable ?? "Confirm the expected deliverable first."} Consider practicing ${details.event.relatedSkills.join(", ")}; these are suggestions, not mandatory technologies.`,
      },
      {
        title: "Practical blockers",
        text: [
          details.event.mode === "online"
            ? "Check equipment and online attendance access."
            : "Check venue availability, attendance format, and travel arrangements.",
          ...details.event.uncertainties,
          "Entry cost and other access conditions are not specified.",
          ...(profile.constraints?.trim()
            ? [
                `Your reported practical constraints: ${profile.constraints.trim()}. These are personal circumstances, not organizer requirements.`,
              ]
            : []),
        ].join(" "),
      },
    ],
  };
}
export async function askOpportunity(
  details: EventDetails,
  profile: UserProfile,
  question: string,
): Promise<OpportunityAnswer> {
  await wait(450);
  const team = details.event.team;
  let answer: string;
  if (/alone|solo|own|team/i.test(question))
    answer = !team
      ? "Solo participation and team-size rules are not specified."
      : team.kind === "solo"
        ? "The demo record lists solo participation only."
        : team.kind === "either" || (team.min ?? 2) === 1
          ? `The demo team record allows an individual or team, with ${team.max ? `up to ${team.max} members` : "the maximum not specified"}.`
          : `The demo record lists teams${team.min ? ` of at least ${team.min}` : ""}${team.max ? ` and at most ${team.max} members` : ""}. It does not confirm solo participation.`;
  else if (/prepare|first|start/i.test(question))
    answer = `Start by verifying the organizer's participation rules and submission checklist. ${details.deliverable ? `The demo summary describes this deliverable: ${details.deliverable}` : "The deliverable is not specified."} A reliable submission deadline is not specified, so preparation advice is untimed.`;
  else if (/requirement|important|rule/i.test(question))
    answer = `The available demo record contains ${team ? "team/individual participation information" : "no published team-size conditions"}. Mandatory submission items and complete participation coverage are not specified. Do not treat the summary or related skills as an eligibility decision.`;
  else
    answer = `The selected record is ${details.event.title}. ${details.event.summary} A reviewed answer to your specific question is not available in this record; it remains unknown. Check the source with the organizer.`;
  return {
    context: analysisContext(details, profile),
    question,
    answer: `${answer} These are unverified fictional fixture details; confirm current rules with the organizer.`,
    sourceLabel: "Selected event's demo summary and team record",
    sourceUrl: details.event.sourceUrl,
  };
}
export async function createPreparationCandidate(
  details: EventDetails,
  profile: UserProfile,
  weeklyHours: number,
  freeOnly: boolean,
  budget: number | null,
  currency = "USD",
): Promise<PreparationPlan> {
  await wait(500);
  if (
    !Number.isFinite(weeklyHours) ||
    weeklyHours <= 0 ||
    weeklyHours > 168 ||
    (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000)) ||
    (currency !== "" && !/^[A-Z]{3}$/.test(currency)) ||
    (!freeOnly && budget !== null && !currency)
  )
    throw new Error(
      "Enter positive weekly hours up to 168, and a valid learning budget or leave the maximum unknown.",
    );
  if (
    hasHardBlocker(
      details.requirements.map((requirement) => evaluateRequirement(requirement, profile)),
    )
  )
    throw new Error(
      "A checked mandatory participation condition is not met. A preparation plan cannot bypass it.",
    );
  return {
    eventId: details.event.id,
    title: details.event.title,
    context: analysisContext(details, profile),
    createdAt: new Date().toISOString(),
    weeklyHours,
    freeOnly,
    budget: freeOnly ? 0 : budget,
    ...(currency ? { currency } : {}),
    deadline: reliableTargetDeadline(details),
    tasks: [
      {
        id: "verify",
        title: "Resolve the open event questions",
        deliverable:
          "A dated note containing verified rules and deadlines, or the questions still awaiting an organizer response.",
        completionCriteria:
          "Each open question is answered with a source or explicitly remains unknown.",
        hours: 1,
        status: "not_started",
      },
      {
        id: "outline",
        title: "Outline a project direction",
        deliverable:
          details.deliverable ??
          "A draft project outline after confirming the expected deliverable.",
        completionCriteria: "Describe the intended user, core idea, and one practical limitation.",
        hours: 2,
        status: "not_started",
      },
      {
        id: "practice",
        title: "Rehearse a small prototype walkthrough",
        deliverable: "A short walkthrough draft using your chosen tools.",
        completionCriteria:
          "Demonstrate the main flow and identify what is still unfinished. This does not establish submission compliance.",
        hours: 2,
        status: "not_started",
      },
    ],
  };
}
