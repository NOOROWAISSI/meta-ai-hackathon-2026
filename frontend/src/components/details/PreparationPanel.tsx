import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle, LoaderCircle, Save, ShieldAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createPreparationCandidate } from "@/lib/details/api";
import { analysisContext, reliableTargetDeadline } from "@/lib/details/logic";
import type { EventDetails, PreparationPlan } from "@/lib/details/types";
import type { UserProfile } from "@/lib/discover/types";
import { useLocalState } from "@/lib/discover/use-local-state";
import { DetailPanel } from "./DetailSections";

export function PreparationPanel({
  details,
  profile,
  blocked,
  outdated,
  onOther,
  onUpdate,
}: {
  details: EventDetails;
  profile: UserProfile;
  blocked: boolean;
  outdated: boolean;
  onOther: () => void;
  onUpdate: () => void;
}) {
  const [weeklyHours, setWeeklyHours] = useState(profile.weeklyHours?.toString() ?? "");
  const [freeOnly, setFreeOnly] = useState(true);
  const [budget, setBudget] = useState("0");
  const [storedPlan, persistPlan] = useLocalState<PreparationPlan | null>(
    `nextstep.plan.${details.event.id}`,
    null,
  );
  const [unsaved, setUnsaved] = useState<PreparationPlan | null>(null);
  const [formError, setFormError] = useState("");
  const context = analysisContext(details, profile);
  const currentContext = useRef(context);
  currentContext.current = context;
  const plan =
    storedPlan?.eventId === details.event.id && Array.isArray(storedPlan.tasks) ? storedPlan : null;
  const deadline = reliableTargetDeadline(details);
  const save = (candidate: PreparationPlan) => {
    if (candidate.context !== currentContext.current) {
      setFormError("Your event or profile changed. Create a fresh plan candidate before saving.");
      return;
    }
    if (!persistPlan(candidate)) {
      setUnsaved(candidate);
      setFormError(
        "The plan has not been saved. Browser storage is unavailable; your candidate is kept here for retry.",
      );
      return;
    }
    setUnsaved(null);
    setFormError("");
    toast.success("Demo plan saved in this browser");
  };
  const generation = useMutation({
    mutationFn: () =>
      createPreparationCandidate(
        details,
        profile,
        Number(weeklyHours),
        freeOnly,
        freeOnly ? 0 : Number(budget),
      ),
    onSuccess: save,
    onError: (error: Error) => setFormError(error.message),
  });

  if (blocked)
    return (
      <DetailPanel
        title="Resolve the participation blocker first"
        eyebrow="Preparation cannot bypass a rule"
      >
        <ShieldAlert className="mb-3 size-8 text-destructive" aria-hidden />
        <p className="text-sm leading-relaxed text-muted-foreground">
          A checked mandatory participation condition is not met in this explicitly simulated demo
          scenario. Practicing skills or completing tasks cannot remove that blocker. Review the
          condition, correct an inaccurate profile fact, or explore another opportunity.
        </p>
        <button type="button" onClick={onOther} className="detail-primary mt-5">
          Explore other opportunities <ArrowRight className="size-4" aria-hidden />
        </button>
      </DetailPanel>
    );

  return (
    <div className="space-y-5">
      {plan && (
        <DetailPanel title="Your next steps are ready" eyebrow="Confirmed local demo plan">
          {plan.context !== context && (
            <p role="status" className="mb-4 rounded-xl bg-warning p-3 text-sm text-warning-ink">
              This plan uses an older profile or source context. Review it before relying on it; a
              replacement will only overwrite it after saving succeeds.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Completed", plan.tasks.filter((task) => task.status === "done").length],
              ["Remaining", plan.tasks.filter((task) => task.status !== "done").length],
              [
                "Remaining effort",
                `${plan.tasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.hours, 0)}h`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-secondary/60 p-3">
                <p className="text-xl font-bold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Progress is user-reported task completion, separate from participation or submission
            compliance.
          </p>
          <Link to="/plans" search={{ event: details.event.id }} className="detail-primary mt-5">
            Continue my plan <ArrowRight className="size-4" aria-hidden />
          </Link>
        </DetailPanel>
      )}
      <DetailPanel
        title={plan ? "Review preparation settings" : "Make room for your next step"}
        eyebrow="Preparation preview"
      >
        <h3 id="prep-heading" tabIndex={-1} className="sr-only">
          Preparation options
        </h3>
        <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Target project deadline
          </p>
          <p className="mt-2 font-semibold">
            {deadline ? new Date(deadline).toISOString() : "Not specified"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {deadline
              ? "A reviewed deadline with an explicit offset is available."
              : "No reliable submission deadline or original time zone is available. This will be untimed preparation advice; the registration deadline is not used as a project deadline."}
          </p>
        </div>
        <form
          id="preparation-form"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError("");
            if (!weeklyHours.trim() || Number(weeklyHours) <= 0) {
              setFormError("Enter weekly available hours between 1 and 80.");
              return;
            }
            generation.mutate();
          }}
          className="space-y-5"
        >
          <div>
            <label htmlFor="prep-hours" className="text-sm font-semibold">
              Weekly available hours
            </label>
            <input
              id="prep-hours"
              type="number"
              min={1}
              max={80}
              step={1}
              required
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              aria-describedby="prep-hours-hint"
              className="mt-2 block w-full rounded-xl border border-input bg-card p-3 text-sm sm:w-40"
            />
            <p id="prep-hours-hint" className="mt-1 text-xs text-muted-foreground">
              A planning preference, not a promise that you can finish before an unknown deadline.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-semibold">Learning resource budget</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="resource-budget"
                checked={freeOnly}
                onChange={() => setFreeOnly(true)}
                className="accent-primary"
              />{" "}
              Free-only learning resources
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="resource-budget"
                checked={!freeOnly}
                onChange={() => setFreeOnly(false)}
                className="accent-primary"
              />{" "}
              Allow paid learning resources
            </label>
            {!freeOnly && (
              <div>
                <label htmlFor="paid-budget" className="text-xs text-muted-foreground">
                  Maximum learning budget (USD)
                </label>
                <input
                  id="paid-budget"
                  type="number"
                  min={0}
                  max={10000}
                  required
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="mt-2 block w-40 rounded-xl border border-input bg-card p-3 text-sm"
                />
              </div>
            )}
          </fieldset>
          <div className="rounded-2xl bg-secondary/50 p-4">
            <h4 className="text-sm font-semibold">Your preparation priorities</h4>
            <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
              {[
                "Verify participation conditions and the mandatory submission checklist.",
                details.deliverable ??
                  "Confirm the expected deliverable before choosing a project.",
                `Consider a small practice task using ${details.event.relatedSkills.slice(0, 2).join(" or ")}.`,
              ].map((priority, index) => (
                <li key={priority} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{priority}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Demo template priorities, not live AI output. No reviewed resource links are available,
            so none will be invented. Your resource preference will be saved with the plan.
          </p>
          {outdated && (
            <p role="status" className="rounded-xl bg-warning p-3 text-sm text-warning-ink">
              Analysis is outdated.{" "}
              <button type="button" onClick={onUpdate} className="font-semibold underline">
                Update analysis before creating a plan.
              </button>
            </p>
          )}
          {formError && (
            <p role="alert" className="rounded-xl bg-warning p-3 text-sm text-warning-ink">
              {formError}
            </p>
          )}
          {unsaved && (
            <button type="button" onClick={() => save(unsaved)} className="detail-primary">
              <Save className="size-4" aria-hidden /> Retry saving candidate
            </button>
          )}
          <button
            type="submit"
            disabled={generation.isPending || outdated}
            className="detail-primary w-full sm:w-auto"
          >
            {generation.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            {generation.isPending
              ? "Creating demo candidate…"
              : plan
                ? "Create replacement plan"
                : "Create my preparation plan"}
          </button>
        </form>
      </DetailPanel>
      <p className="flex items-start gap-2 px-2 text-xs leading-relaxed text-muted-foreground">
        <Circle className="mt-0.5 size-3 shrink-0" aria-hidden />
        The full task workspace belongs on the next screen. This screen previews and saves a plan;
        it does not certify eligibility or submission readiness.
      </p>
    </div>
  );
}
