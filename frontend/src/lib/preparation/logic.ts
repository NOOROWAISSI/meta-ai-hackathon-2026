import { isContractInstant } from "../contract/time";
import type {
  AssessmentContext,
  Opportunity,
  Plan,
  PlanBudget,
  PlanCandidateOutput,
  ReviewedResource,
  StudentProfile,
  SubmissionState,
  TimelineKind,
} from "../contract/types";

export const FEASIBILITY_LABELS: Record<Plan["feasibility"], string> = {
  fits_reported_budget: "Fits your reported time",
  untimed: "Untimed preparation",
  infeasible: "More work than available time",
  no_remaining_gap: "No remaining preparation tasks",
};
export function confirmedBlocker(opportunity: Opportunity, profile: StudentProfile): string | null {
  if (opportunity.informationFreshness !== "current") return null;
  for (const requirement of opportunity.requirements) {
    if (
      requirement.lane !== "participation" ||
      !requirement.isMandatory ||
      requirement.sourceStatus !== "reviewed" ||
      !requirement.sourceEvidenceIds.length ||
      requirement.sourceEvidenceIds.some(
        (id) =>
          !opportunity.sourceEvidence.some(
            (e) =>
              e.id === id &&
              e.status === "reviewed" &&
              e.passage.trim() &&
              isContractInstant(e.checkedAt),
          ),
      )
    )
      continue;
    const applicability = requirement.applicability;
    if (
      applicability.key === "division" &&
      (profile.team.division.state !== "known" ||
        profile.team.division.value !== applicability.division)
    )
      continue;
    if (
      applicability.key === "entrant_type" &&
      (profile.entrantType.state !== "known" ||
        profile.entrantType.value !== applicability.entrantType)
    )
      continue;
    const rule = requirement.evaluation;
    let fails = false;
    if (rule.key === "minimum_age")
      fails = profile.reportedAge.state === "known" && profile.reportedAge.value < rule.minimum;
    if (rule.key === "majority")
      fails = profile.majority.reached.state === "known" && !profile.majority.reached.value;
    if (rule.key === "enrollment")
      fails =
        profile.enrollment.state === "known" &&
        !rule.allowed.includes(profile.enrollment.value as "school" | "higher_education");
    if (rule.key === "same_division")
      fails = profile.team.sameDivision.state === "known" && !profile.team.sameDivision.value;
    if (rule.key === "team_bound") {
      const size =
        profile.entrantType.state === "known" && profile.entrantType.value === "individual"
          ? 1
          : profile.team.size.state === "known"
            ? profile.team.size.value
            : null;
      fails = size !== null && (rule.bound === "minimum" ? size < rule.count : size > rule.count);
    }
    if (fails) return requirement.statement;
  }
  return null;
}
export function reliableDeadline(opportunity: Opportunity): string | null {
  return reviewedTimelineInstant(opportunity, "submission_close");
}
export function reviewedTimelineInstant(
  opportunity: Opportunity,
  kind: TimelineKind,
): string | null {
  const events = opportunity.timelineEvents.filter((t) => t.kind === kind);
  if (
    events.length !== 1 ||
    events[0]!.sourceStatus !== "reviewed" ||
    opportunity.informationFreshness !== "current"
  )
    return null;
  const claims = events[0]!.claims;
  const times = claims.map((c) => c.dateTime);
  if (times.length !== 1 || times.some((t) => !isContractInstant(t))) return null;
  const instants = new Set(times.map((t) => Date.parse(t!)));
  if (instants.size !== 1) return null;
  if (
    claims.some(
      (c) =>
        !c.evidenceIds.length ||
        c.evidenceIds.some(
          (id) =>
            !opportunity.sourceEvidence.some(
              (e) =>
                e.id === id &&
                e.status === "reviewed" &&
                e.passage.trim() &&
                isContractInstant(e.checkedAt),
            ),
        ),
    )
  )
    return null;
  return times[0]!;
}
export function budgetFor(
  tasks: Plan["tasks"],
  hours: number | null,
  deadline: string | null,
  now = new Date(),
): { budget: PlanBudget; feasibility: Plan["feasibility"] } {
  const remaining = tasks.reduce(
    (sum, t) => sum + (t.status === "done" ? 0 : t.remainingEstimatedHours),
    0,
  );
  const available =
    hours !== null && deadline !== null
      ? Math.max(0, ((Date.parse(deadline) - now.getTime()) / (7 * 86400000)) * hours)
      : null;
  return {
    budget: {
      evaluatedAt: now.toISOString(),
      hoursPerWeek: hours,
      deadlineInstant: deadline,
      availableHours: available,
      remainingEffortHours: remaining,
      assumption: available === null ? "untimed" : "even_weekly_distribution",
    },
    feasibility:
      remaining === 0
        ? "no_remaining_gap"
        : hours === 0 || (available !== null && remaining > available)
          ? "infeasible"
          : available === null
            ? "untimed"
            : "fits_reported_budget",
  };
}
export function validateCandidate(
  raw: unknown,
  profile: StudentProfile,
  opportunity: Opportunity,
  resources: ReviewedResource[],
): PlanCandidateOutput {
  const fail = () => {
    throw new Error("Invalid demo output. No candidate was accepted. Retry generation.");
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
  const candidate = raw as Record<string, unknown>;
  if (
    Object.keys(candidate).some((k) => !["tasks", "explanation"].includes(k)) ||
    typeof candidate["explanation"] !== "string" ||
    !candidate["explanation"].trim() ||
    candidate["explanation"].length > 4000 ||
    !Array.isArray(candidate["tasks"]) ||
    candidate["tasks"].length > 6
  )
    return fail();
  for (const value of candidate["tasks"]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
    const task = value as Record<string, unknown>;
    if (
      Object.keys(task).some(
        (k) =>
          ![
            "title",
            "target",
            "priority",
            "deliverable",
            "completionCriteria",
            "estimatedHours",
            "resourceIds",
          ].includes(k),
      )
    )
      return fail();
    for (const key of ["title", "deliverable", "completionCriteria"]) {
      if (
        typeof task[key] !== "string" ||
        !(task[key] as string).trim() ||
        (task[key] as string).length > 2000
      )
        return fail();
    }
    if (
      typeof task["estimatedHours"] !== "number" ||
      !Number.isFinite(task["estimatedHours"]) ||
      task["estimatedHours"] <= 0 ||
      task["estimatedHours"] > 168 ||
      !["must", "should", "could"].includes(String(task["priority"]))
    )
      return fail();
    const target = task["target"] as Record<string, unknown> | undefined;
    if (!target || typeof target !== "object") return fail();
    if (target["kind"] === "goal") {
      if (
        Object.keys(target).some((k) => !["kind", "goalId"].includes(k)) ||
        !profile.goals.some((g) => g.id === target["goalId"]) ||
        task["priority"] === "must"
      )
        return fail();
    } else if (target["kind"] === "requirement") {
      const r = opportunity.requirements.find((r) => r.id === target["requirementId"]);
      if (
        Object.keys(target).some((k) => !["kind", "requirementId"].includes(k)) ||
        !r ||
        r.sourceStatus !== "reviewed" ||
        (r.lane !== "submission" && r.lane !== "preparation") ||
        (task["priority"] === "must" && !r.isMandatory)
      )
        return fail();
    } else return fail();
    if (
      !Array.isArray(task["resourceIds"]) ||
      task["resourceIds"].length > 10 ||
      new Set(task["resourceIds"]).size !== task["resourceIds"].length ||
      task["resourceIds"].some(
        (id) => typeof id !== "string" || !resources.some((r) => r.id === id && currentResource(r)),
      )
    )
      return fail();
  }
  return structuredClone(raw) as PlanCandidateOutput;
}
export function currentResource(resource: ReviewedResource, now = Date.now()) {
  try {
    const url = new URL(resource.url);
    return (
      resource.status === "reviewed" &&
      url.protocol === "https:" &&
      !/(^|\.)example\.(org|com|net)$/.test(url.hostname) &&
      resource.checkedAt !== null &&
      isContractInstant(resource.checkedAt) &&
      now - Date.parse(resource.checkedAt) >= 0
    );
  } catch {
    return false;
  }
}
export function validatePlan(value: unknown): value is Plan {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const plan = value as Plan;
    const text = (v: unknown, max = 4000): v is string =>
      typeof v === "string" && v.trim().length > 0 && v.length <= max;
    const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
    const list = (v: unknown, max = 100): v is unknown[] => Array.isArray(v) && v.length <= max;
    const context = plan.context;
    if (
      !text(plan.id, 200) ||
      !Number.isInteger(plan.version) ||
      plan.version < 1 ||
      !context ||
      !text(context.opportunityId, 200) ||
      !text(context.profileId, 200) ||
      !text(context.sourceRevision, 500) ||
      !Number.isInteger(context.profileVersion) ||
      context.profileVersion < 0 ||
      !Number.isInteger(context.submissionVersion) ||
      context.submissionVersion < 1
    )
      return false;
    if (
      !list(plan.goals, 100) ||
      plan.goals.some((g) => !g || !text(g.id, 200) || !text(g.statement)) ||
      new Set(plan.goals.map((g) => g.id)).size !== plan.goals.length ||
      !list(plan.tasks, 100) ||
      !list(plan.taskOrder, 100) ||
      plan.taskOrder.length !== plan.tasks.length ||
      new Set(plan.taskOrder).size !== plan.tasks.length ||
      new Set(plan.tasks.map((t) => t.id)).size !== plan.tasks.length
    )
      return false;
    if (!plan.taskOrder.every((id) => text(id, 200) && plan.tasks.some((t) => t.id === id)))
      return false;
    if (
      plan.tasks.some((task) => {
        const target = task.target;
        return (
          !text(task.id, 200) ||
          !text(task.title) ||
          !text(task.deliverable) ||
          !text(task.completionCriteria) ||
          !["not_started", "in_progress", "done"].includes(task.status) ||
          !["must", "should", "could"].includes(task.priority) ||
          !number(task.estimatedHours) ||
          task.estimatedHours > 168 ||
          !number(task.remainingEstimatedHours) ||
          task.remainingEstimatedHours > task.estimatedHours ||
          (task.status === "done" && task.remainingEstimatedHours !== 0) ||
          !list(task.resourceIds, 10) ||
          task.resourceIds.some((id) => !text(id, 200)) ||
          !list(task.artifactUrls, 8) ||
          task.artifactUrls.some((url) => !text(url, 2000)) ||
          !target ||
          (target.kind === "goal"
            ? !plan.goals.some((g) => g.id === target.goalId)
            : target.kind !== "requirement" || !text(target.requirementId, 200))
        );
      })
    )
      return false;
    const budget = plan.budget;
    return (
      !!budget &&
      isContractInstant(budget.evaluatedAt) &&
      (budget.hoursPerWeek === null ||
        (number(budget.hoursPerWeek) && budget.hoursPerWeek <= 168)) &&
      (budget.availableHours === null || number(budget.availableHours)) &&
      (budget.deadlineInstant === null || isContractInstant(budget.deadlineInstant)) &&
      budget.remainingEffortHours ===
        plan.tasks.reduce((sum, task) => sum + task.remainingEstimatedHours, 0) &&
      ["even_weekly_distribution", "untimed"].includes(budget.assumption) &&
      ["fits_reported_budget", "untimed", "infeasible", "no_remaining_gap"].includes(
        plan.feasibility,
      ) &&
      (budget.remainingEffortHours === 0
        ? plan.feasibility === "no_remaining_gap"
        : plan.feasibility !== "no_remaining_gap") &&
      list(plan.warnings, 100) &&
      plan.warnings.every((w) => text(w))
    );
  } catch {
    return false;
  }
}
export interface PreparationBundle {
  opportunity: Opportunity;
  profile: StudentProfile;
  submission: SubmissionState;
  context: AssessmentContext;
  resources: ReviewedResource[];
  plan: Plan | null;
  updatedAt: string | null;
}
