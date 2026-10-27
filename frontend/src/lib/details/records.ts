import { DEMO_HACKATHONS } from "../discover/demo-data";
import type { DetailsState, EventDetails, Requirement } from "./types";

/** Additional display fields are transcribed only from the existing fictional summaries. */
const EXCERPTS: Record<
  string,
  Pick<
    EventDetails,
    "duration" | "participants" | "deliverable" | "technologies" | "judging" | "benefits"
  >
> = {
  "aurora-ai": {
    duration: "48 hours (demo summary)",
    participants: null,
    deliverable: "Prototype helpful AI assistants for campus life.",
    technologies: null,
    judging: null,
    benefits: ["Mentor office hours", "API credits"],
  },
  "tidewater-climate": {
    duration: null,
    participants: null,
    deliverable:
      "Visualize flooding risk and propose community-facing tools using open coastal sensor datasets.",
    technologies:
      "Open coastal sensor datasets are described in the demo summary. Required technologies are not specified.",
    judging: null,
    benefits: [],
  },
  "pulse-health": {
    duration: null,
    participants: null,
    deliverable: "Design accessible digital tools to help patients prepare for appointments.",
    technologies: null,
    judging: "Criteria: not specified. The demo summary says clinicians join as judges.",
    benefits: [],
  },
  "ledger-fintech": {
    duration: null,
    participants: null,
    deliverable: "Build transparent budgeting tools for student organizations.",
    technologies:
      "A sandboxed payments API is described in the demo summary. Required technologies are not specified.",
    judging: null,
    benefits: [],
  },
  "orbit-games": {
    duration: null,
    participants:
      "Beginners are encouraged in the demo summary. Formal participation conditions are not specified.",
    deliverable: "Interactive art, small games, or playful interfaces.",
    technologies: null,
    judging: null,
    benefits: [],
  },
};

export function buildEventDetails(id: string, state: DetailsState = "normal"): EventDetails | null {
  const event = DEMO_HACKATHONS.find((item) => item.id === id);
  if (!event) return null;
  const excerpt = EXCERPTS[id]!;
  const reviewed = state === "hard-blocker";
  const sourceStatus = reviewed ? "reviewed-demo" : state === "stale" ? "stale" : "unverified";
  const requirements: Requirement[] = [];
  const add = (requirement: Omit<Requirement, "sourceUrl" | "sourceStatus">) =>
    requirements.push({ ...requirement, sourceUrl: event.sourceUrl, sourceStatus });
  if (event.team?.kind === "solo")
    add({
      id: "solo",
      lane: "participation",
      statement: "Individual participation only.",
      mandatory: true,
      rule: "solo-only",
      passage: "Synthetic record: team.kind = solo.",
    });
  if (event.team?.min)
    add({
      id: "team-min",
      lane: "participation",
      statement: `Teams have at least ${event.team.min} member${event.team.min === 1 ? "" : "s"}.`,
      mandatory: true,
      rule: "team-min",
      value: event.team.min,
      passage: `Synthetic record: minimum team size ${event.team.min}.`,
    });
  if (event.team?.max)
    add({
      id: "team-max",
      lane: "participation",
      statement: `Teams have at most ${event.team.max} members.`,
      mandatory: true,
      rule: "team-max",
      value: event.team.max,
      passage: `Synthetic record: maximum team size ${event.team.max}.`,
    });
  if (!event.team)
    add({
      id: "team-unknown",
      lane: "participation",
      statement: "Participation and team-size conditions",
      mandatory: true,
      rule: "unknown",
      passage: null,
    });
  add({
    id: "coverage",
    lane: "participation",
    statement: "Other participation conditions, including geographic restrictions",
    mandatory: true,
    rule: "unknown",
    passage: null,
  });
  add({
    id: "submission",
    lane: "submission",
    statement: "Mandatory submission checklist and acceptance criteria",
    mandatory: true,
    rule: "unknown",
    passage: null,
  });
  add({
    id: "access",
    lane: "access",
    statement:
      event.mode === "online"
        ? "Check online access, equipment, and attendance requirements."
        : "Check venue access, travel, and attendance requirements.",
    mandatory: false,
    rule: "unknown",
    passage: event.location
      ? `Synthetic location record: ${event.location}. Access arrangements are not specified.`
      : null,
  });
  event.relatedSkills.forEach((skill, index) =>
    add({
      id: `skill-${index}`,
      lane: "preparation",
      statement: `${skill} may be useful preparation.`,
      mandatory: false,
      rule: "skill",
      value: skill,
      passage: `Synthetic relatedSkills entry: ${skill}. This is advice, not an organizer requirement.`,
    }),
  );
  if (state === "conflicting-dates") {
    const requirement = requirements.find(
      (item) => item.lane === "participation" && item.rule !== "unknown",
    );
    if (requirement) {
      requirement.sourceStatus = "conflicting";
      requirement.conflictingPassage =
        "Simulated alternative claim: individual and team participation are both allowed. Neither claim has been verified.";
    }
  }
  const timeline: EventDetails["timeline"] = [];
  if (event.registrationDeadline)
    timeline.push({
      id: "registration-close",
      title: "Registration closes",
      date: event.registrationDeadline,
      originalZone: null,
      ...(state === "conflicting-dates" ? { conflictingDate: "2026-11-08" } : {}),
    });
  if (event.eventStart)
    timeline.push({
      id: "event-start",
      title: "Hackathon begins",
      date: event.eventStart,
      originalZone: null,
    });
  timeline.sort((a, b) => a.date.localeCompare(b.date));
  return {
    event,
    ...excerpt,
    revision: `${id}.fixture-1.${state === "conflicting-dates" || reviewed ? state : "base"}`,
    sourceState: reviewed
      ? "reviewed-demo"
      : state === "source-unavailable"
        ? "unavailable"
        : state === "stale"
          ? "stale"
          : state === "conflicting-dates"
            ? "conflicting"
            : "unverified",
    listingHost: null,
    rulesUrl: null,
    startInstant: null,
    originalZone: null,
    registrationOpens: null,
    submissionDeadline: null,
    resultsDate: null,
    entryCost: null,
    requirements,
    timeline,
  };
}
