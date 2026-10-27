import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { analysisContext } from "@/lib/details/logic";
import { buildEventDetails } from "@/lib/details/records";
import type { PreparationPlan } from "@/lib/details/types";
import { DEFAULT_PROFILE, DEMO_HACKATHONS } from "@/lib/discover/demo-data";
import type { UserProfile } from "@/lib/discover/types";
import { useLocalState } from "@/lib/discover/use-local-state";
import { AppShell } from "@/components/discover/AppShell";
import { DetailPanel } from "./DetailSections";

/** The task workspace stays on the separate My Plans screen. */
export function PlanWorkspace({ eventId }: { eventId?: string }) {
  const [savedPlan, setPlan] = useLocalState<PreparationPlan | null>(
    `nextstep.plan.${eventId ?? "none"}`,
    null,
  );
  const [profile] = useLocalState<UserProfile>("nextstep.profile", DEFAULT_PROFILE);
  const [index, setIndex] = useState<PreparationPlan[]>([]);
  useEffect(() => {
    const plans: PreparationPlan[] = [];
    for (const event of DEMO_HACKATHONS) {
      try {
        const raw = localStorage.getItem(`nextstep.plan.${event.id}`);
        if (raw) {
          const candidate = JSON.parse(raw) as PreparationPlan;
          if (candidate.eventId === event.id && Array.isArray(candidate.tasks))
            plans.push(candidate);
        }
      } catch {
        /* A malformed local item must not hide other plans. */
      }
    }
    setIndex(plans);
  }, [eventId]);
  const plan =
    savedPlan && savedPlan.eventId === eventId && Array.isArray(savedPlan.tasks) ? savedPlan : null;
  const details = eventId ? buildEventDetails(eventId) : null;
  const outdated = !!plan && !!details && plan.context !== analysisContext(details, profile);
  const updateTask = (id: string, status: PreparationPlan["tasks"][number]["status"]) => {
    if (!plan) return;
    if (
      !setPlan({
        ...plan,
        tasks: plan.tasks.map((task) => (task.id === id ? { ...task, status } : task)),
      })
    )
      toast.error("Progress not saved", {
        description:
          "Browser storage is unavailable. Your confirmed task status has been preserved.",
      });
    else toast.success("Progress saved in this browser");
  };
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="discovery-hero rounded-3xl border border-primary/15 p-6 sm:p-8">
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <ListChecks className="size-4" aria-hidden /> My Plans
          </span>
          <h1 className="text-3xl font-bold tracking-tight">
            {plan ? "One step at a time." : "Your preparation workspace"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {plan?.title ?? "Plans you confirm in event details appear here."}
          </p>
        </header>
        {eventId ? (
          plan ? (
            <>
              <Link to="/" search={{ event: eventId }} className="detail-secondary">
                <ArrowLeft className="size-4" aria-hidden /> Back to event details
              </Link>
              {outdated && (
                <p role="status" className="rounded-2xl bg-warning p-4 text-sm text-warning-ink">
                  This plan has an older source or profile context. Revisit event details and update
                  the analysis before relying on it.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "Completed",
                    `${plan.tasks.filter((task) => task.status === "done").length} / ${plan.tasks.length}`,
                  ],
                  [
                    "Remaining effort",
                    `${plan.tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.hours, 0)} hours`,
                  ],
                  ["Deadline", plan.deadline ?? "Untimed · not specified"],
                ].map(([label, value]) => (
                  <div key={label} className="glass rounded-2xl p-5">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Confirmed local demo plan · {plan.weeklyHours} hours/week ·{" "}
                {plan.freeOnly ? "Free-only resources" : `Learning budget: ${plan.budget} USD`}.
                Task completion is a self-report, not eligibility, skill certification, or
                submission acceptance.
              </p>
              <div className="space-y-4">
                {plan.tasks.map((task, index) => (
                  <DetailPanel
                    key={task.id}
                    title={`${index + 1}. ${task.title}`}
                    eyebrow={`${task.hours} estimated hours · ${task.status.replaceAll("_", " ")}`}
                  >
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Deliverable: </strong>
                      {task.deliverable}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Complete when: </strong>
                      {task.completionCriteria}
                    </p>
                    <label className="mt-5 flex flex-wrap items-center gap-3 text-sm font-medium">
                      Task status
                      <select
                        aria-label={`Status for ${task.title}`}
                        value={task.status}
                        onChange={(e) => updateTask(task.id, e.target.value as typeof task.status)}
                        className="rounded-xl border border-input bg-card px-3 py-2"
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done (self-reported)</option>
                      </select>
                      {task.status === "done" && (
                        <CheckCircle2 className="size-5 text-primary" aria-label="Reported done" />
                      )}
                    </label>
                  </DetailPanel>
                ))}
              </div>
            </>
          ) : (
            <DetailPanel title="No confirmed plan for this event">
              <p className="text-sm text-muted-foreground">
                Create and save a plan from the event's Preparation tab first.
              </p>
              <Link to="/" search={{ event: eventId }} className="detail-primary mt-4">
                Open event details <ArrowRight className="size-4" aria-hidden />
              </Link>
            </DetailPanel>
          )
        ) : (
          <DetailPanel title="Your confirmed plans">
            {index.length ? (
              <div className="space-y-3">
                {index.map((item) => (
                  <Link
                    key={item.eventId}
                    to="/plans"
                    search={{ event: item.eventId }}
                    className="glass flex items-center justify-between gap-3 rounded-2xl p-4 text-sm font-semibold"
                  >
                    {item.title}
                    <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
                  </Link>
                ))}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No preparation plan has been saved yet.
                </p>
                <Link to="/" search={{}} className="detail-primary mt-4">
                  Discover opportunities <ArrowRight className="size-4" aria-hidden />
                </Link>
              </>
            )}
          </DetailPanel>
        )}
      </div>
    </AppShell>
  );
}
