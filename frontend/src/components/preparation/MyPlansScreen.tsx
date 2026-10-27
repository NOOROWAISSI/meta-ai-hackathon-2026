import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, Layers3, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/discover/AppShell";
import { preparationRepository } from "@/lib/preparation/repository";
import { budgetFor, FEASIBILITY_LABELS, type PreparationBundle } from "@/lib/preparation/logic";
import { sameContext } from "@/lib/preparation/adapters";
import { subscribeStore } from "@/lib/storage/database";
import { PreparationFlow } from "./PreparationFlow";
import { StorageRecovery } from "./StorageRecovery";
import { usePreparationZone } from "./usePreparationZone";
import { SamplePlanButton } from "./SamplePlanButton";

export function MyPlansScreen({ eventId }: { eventId?: string }) {
  return (
    <AppShell>
      {eventId ? <PreparationFlow key={eventId} opportunityId={eventId} /> : <ConfirmedPlanIndex />}
    </AppShell>
  );
}
function ConfirmedPlanIndex() {
  const { zone, formatInstant } = usePreparationZone();
  const [plans, setPlans] = useState<PreparationBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let serial = 0;
    const load = () => {
      const request = ++serial;
      void preparationRepository
        .list()
        .then((value) => {
          if (alive && request === serial) {
            setPlans(value);
            setLoading(false);
            setError("");
          }
        })
        .catch((failure: unknown) => {
          if (alive && request === serial) {
            setError(
              failure instanceof Error ? failure.message : "Stored plans could not be loaded.",
            );
            setLoading(false);
          }
        });
    };
    load();
    const unsubscribe = subscribeStore(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [attempt]);
  return (
    <div className="preparation-screen">
      <header className="prep-hero">
        <div>
          <p className="prep-eyebrow">
            <Layers3 className="size-4" aria-hidden />
            My Plans
          </p>
          <h1>A place for your next steps.</h1>
          <p className="prep-organizer">
            Only plans you have accepted and successfully saved appear here.
          </p>
        </div>
        <span className="prep-index-count" aria-label={`${plans.length} confirmed plans`}>
          {plans.length}
        </span>
      </header>
      <p className="prep-demo-notice">
        Browser-only demo - confirmed plans and self-reported task progress.
      </p>
      {import.meta.env.DEV && <SamplePlanButton />}
      {loading ? (
        <p role="status" className="prep-loading">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          Loading confirmed plans-
        </p>
      ) : error ? (
        <div role="alert" className="prep-error">
          <p>{error}</p>
          <button
            type="button"
            className="detail-primary mt-4"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry loading plans
          </button>
        </div>
      ) : !plans.length ? (
        <div className="prep-empty prep-empty-index">
          <Compass className="size-12 text-primary" aria-hidden />
          <h2>No preparation plans yet.</h2>
          <p>
            Choose a hackathon, review a preparation draft, and accept the steps you want to work
            on.
          </p>
          <Link to="/" search={{}} className="detail-primary">
            Explore hackathons
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="prep-plan-selector">
          {plans.map((bundle) => {
            const plan = bundle.plan!;
            const completed = plan.tasks.filter((task) => task.status === "done").length;
            const assessment = budgetFor(
              plan.tasks,
              plan.budget.hoursPerWeek,
              plan.budget.deadlineInstant,
            );
            return (
              <article className="prep-plan-summary" key={plan.id}>
                <div className="prep-plan-accent" aria-hidden>
                  {String(completed).padStart(2, "0")}
                  <span>/{plan.tasks.length}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="prep-eyebrow">{bundle.opportunity.organizer}</p>
                  <h2>{bundle.opportunity.title}</h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {completed} completed tasks - {assessment.budget.remainingEffortHours}h
                    remaining
                  </p>
                  <span className="prep-feasibility mt-3">
                    {FEASIBILITY_LABELS[assessment.feasibility]}
                  </span>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {plan.budget.deadlineInstant
                      ? `Target ${formatInstant(plan.budget.deadlineInstant)} (${zone})`
                      : "Deadline not confirmed"}
                  </p>
                  {!sameContext(plan.context, bundle.context) && (
                    <p className="mt-2 text-xs text-[var(--galaxy-copper-ink)]">
                      Context outdated - progress preserved
                    </p>
                  )}
                  <Link
                    to="/plans"
                    search={{ event: bundle.opportunity.id }}
                    className="detail-secondary mt-4"
                  >
                    Continue plan
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <StorageRecovery onReset={() => setAttempt((value) => value + 1)} />
    </div>
  );
}
