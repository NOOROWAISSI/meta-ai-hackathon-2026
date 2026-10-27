/** Canonical Frontend Contract v0.2 types. Legacy screen models are adapted at the boundary. */
export type MatchStatus =
  "supported" | "not_met" | "unknown" | "source_conflict" | "not_applicable";
export type ParticipationSummary =
  "does_not_meet_confirmed_requirement" | "needs_verification" | "meets_checked_conditions";
export type SubmissionSummary = "incomplete" | "needs_verification" | "meets_checked_criteria";
export type WindowStatus = "upcoming" | "open" | "closed" | "unknown";
export type TaskStatus = "not_started" | "in_progress" | "done";
export type SourceStatus = "reviewed" | "unverified" | "stale" | "conflicting";
export type RequirementKind =
  "hard_eligibility" | "submission_mandatory" | "logistics" | "preparation_advice";
export type Division = "school" | "college_plus";
export type ProfileFact<T> =
  { state: "known"; value: T; reportedAt: string } | { state: "unknown"; reason?: string };
export interface Goal {
  id: string;
  statement: string;
}
export type SourceEvidence = { id: string; sourceUrl: string; sourceSection: string } & (
  | { status: "reviewed" | "stale"; passage: string; checkedAt: string }
  | { status: "unverified"; passage?: string; checkedAt: string | null }
);
export interface CoverageReview {
  state: "complete" | "incomplete";
  reviewedRequirementIds: string[];
  missingChecks: string[];
  reviewedAt: string | null;
}
export interface SourceCoverage {
  participation: CoverageReview;
  submission: CoverageReview;
  prize: CoverageReview;
}
export type TimelineKind =
  | "registration_open"
  | "registration_close"
  | "build_start"
  | "build_end"
  | "submission_open"
  | "submission_close"
  | "judging_start"
  | "judging_end"
  | "results";
export interface TimelineClaim {
  id: string;
  publishedText: string;
  dateTime: string | null;
  timeZone?: string;
  evidenceIds: string[];
}
export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  claims: TimelineClaim[];
  sourceStatus: SourceStatus;
}
export interface InterestTag {
  id: string;
  label: string;
  evidenceIds: string[];
}
export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  listingHost?: string;
  canonicalEventUrl: string;
  officialUrl: string;
  rulesUrl?: string;
  format: "online" | "in_person" | "hybrid" | "unknown";
  theme: string;
  sourceRevision: string;
  lastReviewedAt: string | null;
  informationFreshness: "current" | "stale" | "needs_verification";
  costStatus: "free" | "paid" | "unknown";
  benefits: string[];
  sourceEvidence: SourceEvidence[];
  sourceCoverage: SourceCoverage;
  requirements: Requirement[];
  timelineEvents: TimelineEvent[];
  interestTags: InterestTag[];
}
export type RuleClassification =
  | { kind: "hard_eligibility"; lane: "participation" | "prize"; isMandatory: true }
  | { kind: "submission_mandatory"; lane: "submission"; isMandatory: true }
  | { kind: "logistics"; lane: "logistics"; isMandatory: boolean }
  | { kind: "preparation_advice"; lane: "preparation"; isMandatory: false };
export type Applicability =
  | { key: "all" }
  | { key: "division"; division: Division }
  | { key: "entrant_type"; entrantType: "individual" | "team" | "organization" };
export type RuleEvaluation =
  | { key: "minimum_age"; minimum: number }
  | { key: "majority"; jurisdiction: "residence" }
  | { key: "enrollment"; allowed: Array<"school" | "higher_education"> }
  | { key: "team_bound"; bound: "minimum" | "maximum"; count: number }
  | { key: "same_division" }
  | { key: "geographic_policy"; policyId: string }
  | {
      key: "submission_criterion";
      criterion:
        | "presence"
        | "visibility"
        | "duration"
        | "license"
        | "functionality"
        | "disclosure"
        | "content";
      parameters: Record<string, string | number | boolean>;
    }
  | { key: "reported_condition"; factKey: string; expected: boolean }
  | { key: "unresolved"; reason: string };
export type Requirement = RuleClassification & {
  id: string;
  statement: string;
  subject: "individual" | "team" | "project";
  applicability: Applicability;
  evaluation: RuleEvaluation;
  claims: Array<{ value: string; evidenceIds: string[] }>;
  sourceEvidenceIds: string[];
  sourceStatus: SourceStatus;
};
export interface StudentProfile {
  id: string;
  version: number;
  reportedAge: ProfileFact<number>;
  majority: { jurisdiction?: string; reached: ProfileFact<boolean> };
  enrollment: ProfileFact<"school" | "higher_education" | "not_enrolled">;
  residence: { country: ProfileFact<string>; region: ProfileFact<string> };
  entrantType: ProfileFact<"individual" | "team" | "organization">;
  team: {
    size: ProfileFact<number>;
    division: ProfileFact<Division>;
    sameDivision: ProfileFact<boolean>;
    allMembersMeetRule: Record<string, ProfileFact<boolean>>;
  };
  availableHoursPerWeek: ProfileFact<number>;
  background: string;
  projectExperience: Array<{ id: string; description: string }>;
  skills: Array<{
    id: string;
    label: string;
    state: "reported_has" | "reported_lacks" | "unknown";
  }>;
  interests: string[];
  goals: Goal[];
  preferredFormats: Array<"online" | "in_person" | "hybrid">;
  constraints: string[];
  acceptedInterpretations: Array<{ experienceId: string; text: string; acceptedAt: string }>;
  clarificationAnswers: Array<{ questionId: string; answer: string; answeredAt: string }>;
  preferredLanguage?: string;
}
export interface SubmissionState {
  opportunityId: string;
  version: number;
  items: Array<{
    requirementId: string;
    state: "missing" | "reported_present" | "unknown";
    artifactUrl?: string;
    criterionResults: Record<string, "reported_met" | "reported_not_met" | "unknown">;
    evidenceLevel: "self_report" | "independently_checked";
  }>;
}
export interface AssessmentContext {
  opportunityId: string;
  profileId: string;
  profileVersion: number;
  sourceRevision: string;
  submissionVersion: number;
}
export interface ClarificationQuestion {
  id: string;
  experienceId?: string;
  question: string;
  optional: true;
}
export interface RequirementMatch {
  requirementId: string;
  status: MatchStatus;
  explanation: string;
  sourceEvidenceIds: string[];
  evidenceLevel: "self_report" | "linked_artifact" | "independently_checked" | "none";
  reasonCode:
    | "matches"
    | "fails"
    | "missing_profile_fact"
    | "missing_submission_fact"
    | "insufficient_source"
    | "stale_source"
    | "conflicting_claims"
    | "not_applicable";
  clarificationQuestion?: ClarificationQuestion;
}
export interface PhaseState {
  phase: "registration" | "build" | "submission";
  status: WindowStatus;
  timelineEventIds: string[];
  explanation: string;
}
export interface AnalysisResult {
  context: AssessmentContext;
  participationSummary: ParticipationSummary;
  submissionSummary: SubmissionSummary;
  phases: PhaseState[];
  matches: RequirementMatch[];
  warnings: Array<{ code: string; requirementId?: string; message: string }>;
}
export interface Recommendation {
  opportunityId: string;
  profileVersion: number;
  sourceRevision: string;
  rankingVersion: string;
  mode: "generic" | "personalized";
  matchedFactors: Array<{
    profileField: "interests" | "goals" | "background" | "preferredFormats";
    profileValue: string;
    tagId: string;
    evidenceIds: string[];
  }>;
  reason: string;
  relevanceBand: "high" | "medium" | "low";
}
export interface OpportunityPreference {
  opportunityId: string;
  saved: boolean;
  notInterested: boolean;
}
export type ReviewedResource = { id: string; title: string; url: string; relevanceNote: string } & (
  | { status: "reviewed" | "stale"; checkedAt: string }
  | { status: "unverified"; checkedAt: string | null }
);
export type TaskTarget =
  { kind: "requirement"; requirementId: string } | { kind: "goal"; goalId: string };
export interface PreparationTask {
  id: string;
  title: string;
  target: TaskTarget;
  priority: "must" | "should" | "could";
  deliverable: string;
  completionCriteria: string;
  estimatedHours: number;
  remainingEstimatedHours: number;
  status: TaskStatus;
  resourceIds: string[];
  artifactUrls: string[];
}
export interface PlanBudget {
  evaluatedAt: string;
  hoursPerWeek: number | null;
  deadlineInstant: string | null;
  availableHours: number | null;
  remainingEffortHours: number;
  assumption: "even_weekly_distribution" | "untimed";
}
export interface Plan {
  id: string;
  version: number;
  context: AssessmentContext;
  goals: Goal[];
  tasks: PreparationTask[];
  taskOrder: string[];
  budget: PlanBudget;
  feasibility: "fits_reported_budget" | "untimed" | "infeasible" | "no_remaining_gap";
  warnings: string[];
}
export interface ProgressState {
  planId: string;
  confirmedPlanVersion: number;
  saveState: "confirmed" | "saving" | "unsaved_error";
}
export interface PlanChange {
  taskId: string;
  proposedRemainingEstimatedHours: number;
  reason: string;
}
export interface PlanAdjustmentPreview {
  originalPlanId: string;
  baseVersion: number;
  context: AssessmentContext;
  unfinishedTaskOrder: string[];
  proposedChanges: PlanChange[];
  preservedCompletedTaskIds: string[];
  explanation: string;
}
export interface AnalysisRequest {
  expectedSourceRevision: string;
  profile: StudentProfile;
  submission: SubmissionState;
}
export interface PlanCandidateRequest extends AnalysisRequest {
  previousPlan?: Plan;
}
export interface PlanCandidateOutput {
  tasks: Array<{
    title: string;
    target: TaskTarget;
    priority: "must" | "should" | "could";
    deliverable: string;
    completionCriteria: string;
    estimatedHours: number;
    resourceIds: string[];
  }>;
  explanation: string;
}
export interface ApiError {
  code:
    | "invalid_input"
    | "version_conflict"
    | "rate_limited"
    | "provider_unavailable"
    | "timeout"
    | "invalid_model_output"
    | "not_found";
  message: string;
  requestId: string;
  retryable: boolean;
  fieldErrors?: Record<string, string[]>;
}
export interface MockBundle {
  opportunity: Opportunity;
  profile: StudentProfile;
  submission: SubmissionState;
  recommendations: Recommendation[];
  analysis: AnalysisResult;
  resources: ReviewedResource[];
  plan: Plan;
  progress: ProgressState;
}
