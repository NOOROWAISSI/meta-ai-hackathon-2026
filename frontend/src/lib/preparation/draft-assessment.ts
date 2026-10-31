import type { Opportunity, Plan, PlanCandidateOutput, StudentProfile } from "../contract/types";
import { budgetFor, reliableDeadline, reviewedTimelineInstant } from "./logic";

type Uncertainty = "hours" | "deadline" | "build_start" | "retained" | "new_work";
export interface DraftWorkloadAssessment {
  newHours: number | null;
  retainedHours: number | null;
  totalHours: number | null;
  availableHours: number | null;
  shortfallHours: number | null;
  status: "overloaded" | "within_capacity" | "unknown";
  uncertainties: Uncertainty[];
  futureBuildStart: string | null;
  assumesStartNow: boolean;
}

/** Read-only, provisional view. Acceptance's server assessment remains authoritative. */
export function assessDraftWorkload(
  candidate: PlanCandidateOutput,
  plan: Plan | null,
  profile: StudentProfile,
  opportunity: Opportunity,
  now = new Date(),
): DraftWorkloadAssessment {
  // Same selection as application Retain and the existing browser-local draft preview.
  const retained =
    plan?.tasks.filter((t) => t.status !== "not_started" || t.artifactUrls.length > 0) ?? [];
  const newHours = candidate.tasks.every(
    (t) => Number.isFinite(t.estimatedHours) && t.estimatedHours > 0,
  )
    ? candidate.tasks.reduce((sum, t) => sum + t.estimatedHours, 0)
    : null;
  const retainedHours = retained.every(
    (t) =>
      t.status === "done" ||
      (Number.isFinite(t.remainingEstimatedHours) && t.remainingEstimatedHours >= 0),
  )
    ? retained.reduce((sum, t) => sum + (t.status === "done" ? 0 : t.remainingEstimatedHours), 0)
    : null;
  const totalHours = newHours !== null && retainedHours !== null ? newHours + retainedHours : null;
  const hours =
    profile.availableHoursPerWeek.state === "known" &&
    Number.isFinite(profile.availableHoursPerWeek.value) &&
    profile.availableHoursPerWeek.value >= 0 &&
    profile.availableHoursPerWeek.value <= 168
      ? profile.availableHoursPerWeek.value
      : null;
  const deadline = reliableDeadline(opportunity);
  const startEvents = opportunity.timelineEvents.filter((event) => event.kind === "build_start");
  const buildStart = reviewedTimelineInstant(opportunity, "build_start");
  const uncertainStart = startEvents.length > 0 && buildStart === null;
  const futureBuildStart = buildStart && Date.parse(buildStart) > now.getTime() ? buildStart : null;
  const effectiveNow = futureBuildStart ? new Date(futureBuildStart) : now;
  const tasks =
    totalHours === null
      ? []
      : [
          ...retained,
          ...candidate.tasks.map((task, index) => ({
            ...task,
            id: `preview-${index}`,
            status: "not_started" as const,
            remainingEstimatedHours: task.estimatedHours,
            artifactUrls: [],
          })),
        ];
  const { budget } = budgetFor(tasks, hours, uncertainStart ? null : deadline, effectiveNow);
  const availableHours = budget.availableHours;
  const uncertainties: Uncertainty[] = [];
  if (hours === null) uncertainties.push("hours");
  if (deadline === null) uncertainties.push("deadline");
  if (uncertainStart) uncertainties.push("build_start");
  if (retainedHours === null) uncertainties.push("retained");
  if (newHours === null) uncertainties.push("new_work");
  const shortfallHours =
    totalHours !== null && availableHours !== null
      ? Math.max(0, totalHours - availableHours)
      : null;
  return {
    newHours,
    retainedHours,
    totalHours,
    availableHours,
    shortfallHours,
    status:
      shortfallHours === null ? "unknown" : shortfallHours > 0 ? "overloaded" : "within_capacity",
    uncertainties,
    futureBuildStart,
    assumesStartNow: startEvents.length === 0,
  };
}
