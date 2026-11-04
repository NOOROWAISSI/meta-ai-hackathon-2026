import type {
  AssessmentContext,
  Goal,
  Opportunity,
  ProfileFact,
  Requirement,
  StudentProfile,
  SubmissionState,
} from "../contract/types";
import type { EventDetails } from "../details/types";
import type { UserProfile } from "../discover/types";

const unknown = <T>(): ProfileFact<T> => ({ state: "unknown" });
const fact = <T>(value: T | undefined, reportedAt: string): ProfileFact<T> =>
  value === undefined ? unknown<T>() : { state: "known", value, reportedAt };
export function goalId(statement: string) {
  let hash = 2166136261;
  for (const char of statement.trim()) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return `goal-${(hash >>> 0).toString(36)}`;
}
/** The existing profile form is a view model. This is its one-way canonical API projection. */
export function toStudentProfile(editor: UserProfile): StudentProfile {
  const at = editor.savedAt ?? "1970-01-01T00:00:00.000Z";
  const goals: Goal[] = Array.from(
    new Set(editor.goals?.map((g) => g.trim()).filter(Boolean) ?? []),
  ).map((statement) => ({ id: goalId(statement), statement }));
  return {
    id: "student-local",
    version: editor.version ?? 0,
    reportedAge: fact(editor.reportedAge ?? undefined, at),
    majority: {
      reached: fact(
        editor.majorityReached === "yes"
          ? true
          : editor.majorityReached === "no"
            ? false
            : undefined,
        at,
      ),
      ...(editor.majorityJurisdiction ? { jurisdiction: editor.majorityJurisdiction } : {}),
    },
    enrollment: fact(editor.educationStatus === "university" ? "higher_education" : undefined, at),
    residence: {
      country: fact(
        editor.residence && editor.residence !== "Prefer not to specify"
          ? editor.residence
          : undefined,
        at,
      ),
      region: unknown(),
    },
    entrantType: fact(
      editor.entrantType === "solo"
        ? "individual"
        : editor.entrantType === "team"
          ? "team"
          : undefined,
      at,
    ),
    team: {
      size: fact(
        editor.entrantType === "solo"
          ? 1
          : editor.entrantType === "team" && editor.teamSize != null
            ? editor.teamSize
            : undefined,
        at,
      ),
      division: unknown(),
      sameDivision: unknown(),
      allMembersMeetRule: {},
    },
    availableHoursPerWeek: fact(editor.weeklyHours ?? undefined, at),
    background: editor.experience ?? "",
    projectExperience: (editor.projects ?? []).map((p) => ({
      id: p.id,
      description: [
        p.title,
        p.description,
        p.contribution
          ? `Personal contribution: ${p.contribution}`
          : "Personal contribution: not provided",
      ].join(". "),
    })),
    skills: editor.skills.map((label) => ({ id: goalId(label), label, state: "reported_has" })),
    interests: editor.interests,
    goals,
    preferredFormats:
      editor.preferredFormat && !["unknown", "any"].includes(editor.preferredFormat)
        ? [
            editor.preferredFormat === "onsite"
              ? "in_person"
              : (editor.preferredFormat as "online" | "hybrid"),
          ]
        : [],
    constraints: editor.constraints?.trim() ? [editor.constraints.trim()] : [],
    acceptedInterpretations: [],
    clarificationAnswers: [],
    ...(editor.learningLanguage ? { preferredLanguage: editor.learningLanguage } : {}),
  };
}
export function toOpportunity(details: EventDetails): Opportunity {
  const event = details.event;
  const requirements: Requirement[] = details.requirements.map((r) => ({
    id: r.id,
    statement: r.statement,
    subject: r.lane === "submission" ? "project" : "individual",
    applicability: { key: "all" },
    evaluation:
      r.rule === "team-min" || r.rule === "team-max"
        ? {
            key: "team_bound",
            bound: r.rule === "team-min" ? "minimum" : "maximum",
            count: Number(r.value),
          }
        : {
            key: "unresolved",
            reason: "No reviewed organizer rule is available in this fictional record.",
          },
    claims: r.passage ? [{ value: r.passage, evidenceIds: [`${r.id}-evidence`] }] : [],
    sourceEvidenceIds: r.passage ? [`${r.id}-evidence`] : [],
    sourceStatus:
      r.sourceStatus === "conflicting"
        ? "conflicting"
        : r.sourceStatus === "stale"
          ? "stale"
          : "unverified",
    ...(r.lane === "participation"
      ? {
          kind: "hard_eligibility" as const,
          lane: "participation" as const,
          isMandatory: true as const,
        }
      : r.lane === "submission"
        ? {
            kind: "submission_mandatory" as const,
            lane: "submission" as const,
            isMandatory: true as const,
          }
        : r.lane === "access"
          ? { kind: "logistics" as const, lane: "logistics" as const, isMandatory: r.mandatory }
          : {
              kind: "preparation_advice" as const,
              lane: "preparation" as const,
              isMandatory: false as const,
            }),
  }));
  const incomplete = {
    state: "incomplete" as const,
    reviewedRequirementIds: [],
    missingChecks: ["Fictional fixture; organizer conditions have not been reviewed."],
    reviewedAt: null,
  };
  return {
    id: event.id,
    title: event.title,
    organizer: event.organizer,
    canonicalEventUrl: event.sourceUrl,
    officialUrl: event.sourceUrl,
    format: event.mode === "onsite" ? "in_person" : event.mode,
    theme: event.summary,
    sourceRevision: details.revision,
    lastReviewedAt: null,
    informationFreshness: "needs_verification",
    costStatus: "unknown",
    benefits: details.benefits,
    sourceEvidence: details.requirements
      .filter((r) => r.passage)
      .map((r) => ({
        id: `${r.id}-evidence`,
        sourceUrl: r.sourceUrl,
        sourceSection: "Fictional demo record",
        status: "unverified" as const,
        passage: r.passage!,
        checkedAt: null,
      })),
    sourceCoverage: {
      participation: { ...incomplete },
      submission: { ...incomplete },
      prize: { ...incomplete },
    },
    requirements,
    timelineEvents: details.timeline.map((t) => ({
      id: t.id,
      kind:
        t.id === "registration-close" ? ("registration_close" as const) : ("build_start" as const),
      sourceStatus: "unverified" as const,
      claims: [
        {
          id: `${t.id}-claim`,
          publishedText: `Fictional record: ${t.date}`,
          dateTime: null,
          evidenceIds: [],
        },
      ],
    })),
    interestTags: [],
  };
}
export const emptySubmission = (opportunityId: string): SubmissionState => ({
  opportunityId,
  version: 1,
  items: [],
});
export function assessmentContext(
  opportunity: Opportunity,
  profile: StudentProfile,
  submission: SubmissionState,
): AssessmentContext {
  return {
    opportunityId: opportunity.id,
    profileId: profile.id,
    profileVersion: profile.version,
    sourceRevision: opportunity.sourceRevision,
    submissionVersion: submission.version,
  };
}
export const sameContext = (a: AssessmentContext, b: AssessmentContext) =>
  a.opportunityId === b.opportunityId &&
  a.profileId === b.profileId &&
  a.profileVersion === b.profileVersion &&
  a.sourceRevision === b.sourceRevision &&
  a.submissionVersion === b.submissionVersion;
