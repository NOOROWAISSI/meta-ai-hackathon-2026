import { useEffect, useState } from "react";
import type { Opportunity, Plan, PlanCandidateOutput, StudentProfile } from "@/lib/contract/types";
import { assessDraftWorkload } from "@/lib/preparation/draft-assessment";

const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function hours(value: number | null) {
  return value === null
    ? "Unknown"
    : value > 0 && value < 0.01
      ? "<0.01h"
      : `${format.format(value)}h`;
}
const unknownMessages = {
  hours: "Your available weekly hours are unknown.",
  deadline: "A reviewed submission deadline is not available.",
  build_start: "The preparation start is not confirmed by unambiguous reviewed timing.",
  retained: "Some retained work has no usable remaining estimate.",
  new_work: "Some new work has no usable estimate.",
};

export function DraftFeasibility({
  candidate,
  plan,
  profile,
  opportunity,
  stale,
}: {
  candidate: PlanCandidateOutput;
  plan: Plan | null;
  profile: StudentProfile;
  opportunity: Opportunity;
  stale: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const assessment = assessDraftWorkload(candidate, plan, profile, opportunity, now);
  const metrics: Array<[string, number | null]> = [
    ["New tasks", assessment.newHours],
    ["Retained work remaining", assessment.retainedHours],
    ["Total estimated workload", assessment.totalHours],
    ["Available hours", assessment.availableHours],
  ];
  if (assessment.status === "overloaded")
    metrics.push(["Estimated shortfall", assessment.shortfallHours]);
  return (
    <aside
      aria-label="Time and workload preview"
      className="mt-4 rounded-2xl border border-border p-4"
    >
      <h3 className="font-semibold">Time and workload preview</h3>
      {stale ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Workload preview unavailable. Your plan or preparation details changed. Generate a fresh
          draft before relying on this assessment.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-semibold">{hours(value)}</dd>
              </div>
            ))}
          </dl>
          {assessment.status === "overloaded" ? (
            <p role="alert" className="prep-error mt-4">
              <strong>More work than available time.</strong> This draft needs about{" "}
              {hours(assessment.shortfallHours)} more than your reported time allows. Consider a
              smaller optional scope or more preparation time before accepting. Keep any required
              submission work in scope.
            </p>
          ) : assessment.status === "within_capacity" ? (
            <p className="mt-4 text-sm">
              Within estimated capacity. Allow room for learning and rework; completion is not
              guaranteed.
            </p>
          ) : (
            <div role="status" className="mt-4 text-sm">
              <p>Schedule fit is unknown.</p>
              {assessment.uncertainties.map((reason) => (
                <p key={reason}>{unknownMessages[reason]}</p>
              ))}
            </div>
          )}
          {assessment.status === "overloaded" && (
            <div className="mt-4 text-sm">
              <h4 className="font-semibold">Before committing to this workload</h4>
              <ol className="mt-2 list-decimal space-y-2 ps-5">
                <li>
                  Choose one demonstrable user flow as the minimum demo scope. Defer optional
                  features and polish; keep every mandatory requirement and retained task visible.
                </li>
                <li>
                  Review the critical path: prerequisites and unfamiliar skills, the core flow, then
                  required artifacts and any organizer submission steps. Include learning, testing
                  and confirmation time in fresh estimates.
                </li>
                <li>
                  Update your goal or reported availability in Profile, then discard this draft and
                  generate a new one for review. If required work still exceeds capacity, choose
                  more preparation time or reconsider this opportunity.
                </li>
              </ol>
              <p className="mt-2 text-muted-foreground">
                These are scope decisions, not a replacement plan or a claim that a smaller demo
                will fit. This draft's estimates remain unchanged.
              </p>
            </div>
          )}
          {assessment.futureBuildStart && (
            <p className="mt-3 text-xs text-muted-foreground">
              Available time starts at the reviewed build start:{" "}
              {new Date(assessment.futureBuildStart).toLocaleString()}.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Provisional preview, with availability spread evenly across the reviewed preparation
            window.
            {assessment.assumesStartNow &&
              " No reviewed build start is recorded, so this preview assumes preparation starts now."}{" "}
            The saved plan's assessment is confirmed when you accept. Original estimates and
            required work are kept.
          </p>
        </>
      )}
    </aside>
  );
}
