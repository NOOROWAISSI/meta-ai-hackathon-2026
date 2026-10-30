import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ListChecks,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/discover/AppShell";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  accountApi,
  apiJson,
  accountDataChanged,
  type SubmissionCoverageView,
} from "@/lib/account/api";
import type {
  Opportunity,
  Plan,
  PlanCandidateOutput,
  SubmissionState,
  StudentProfile,
  AnalysisResult,
} from "@/lib/contract/types";
import { realCatalogService } from "@/lib/catalog/service";
import {
  FEASIBILITY_LABELS,
  reliableDeadline,
  type PreparationBundle,
} from "@/lib/preparation/logic";
import { assessmentContext, sameContext } from "@/lib/preparation/adapters";
import { TaskDrawer, STATUS_LABELS } from "@/components/preparation/TaskDrawer";
import { TaskResources } from "@/components/preparation/Resources";
import { DraftFeasibility } from "@/components/preparation/DraftFeasibility";

interface Candidate {
  candidateId: string;
  output: PlanCandidateOutput;
  context: PreparationBundle["context"];
  baseVersion: number | null;
  operationId: string;
}
interface AccountPreparationBundle extends PreparationBundle {
  analysis: AnalysisResult;
}
export function AccountPlans({ eventId }: { eventId?: string }) {
  const auth = useAuth();
  return (
    <AppShell>
      {eventId ? (
        <AccountPreparation key={`${auth?.user?.id}:${eventId}`} opportunityId={eventId} />
      ) : (
        <AccountPlanIndex />
      )}
    </AppShell>
  );
}
function AccountPlanIndex() {
  const auth = useAuth();
  const profile = useQuery({
    queryKey: ["account", auth?.user?.id, "profile"],
    queryFn: accountApi.profile,
    retry: false,
  });
  const opportunities = useQuery({
    queryKey: ["canonical-opportunities"],
    queryFn: accountApi.opportunities,
    staleTime: 300000,
  });
  const plans = useQuery({
    queryKey: ["account", auth?.user?.id, "plans"],
    queryFn: accountApi.plans,
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ["real-listings"],
    queryFn: realCatalogService.listings,
    staleTime: 300000,
  });
  return (
    <div className="preparation-screen space-y-6">
      <header className="prep-hero">
        <div>
          <p className="prep-eyebrow">
            <ListChecks className="size-4" aria-hidden />
            My Plans
          </p>
          <h1>Your next steps, saved.</h1>
          <p className="prep-organizer">
            Confirmed plans and self-reported progress from your account.
          </p>
        </div>
        <span className="prep-index-count">{plans.data?.length ?? "—"}</span>
      </header>
      {plans.isPending ? (
        <p role="status" className="prep-loading">
          Loading confirmed plans…
        </p>
      ) : plans.isError ? (
        <div role="alert" className="prep-error">
          <p>{plans.error.message}</p>
          <button
            type="button"
            className="detail-secondary mt-3"
            onClick={() => void plans.refetch()}
          >
            Retry
          </button>
        </div>
      ) : !plans.data.length ? (
        <div className="prep-empty">
          <ListChecks className="size-10 text-primary" aria-hidden />
          <h2>No preparation plans yet.</h2>
          <p>
            Choose a reviewed hackathon and generate a draft. Nothing is added until you accept it.
          </p>
          <Link to="/" search={{}} className="detail-primary">
            Explore opportunities
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {plans.data.map((plan) => {
            const done = plan.tasks.filter((t) => t.status === "done").length;
            return (
              <article key={plan.id} className="glass rounded-3xl p-6">
                <p className="prep-eyebrow">{FEASIBILITY_LABELS[plan.feasibility]}</p>
                <h2 className="mt-3 text-xl font-bold">
                  {catalog.data?.find((o) => o.id === plan.context.opportunityId)?.title ??
                    plan.context.opportunityId}
                </h2>
                <p className="mt-4 text-sm text-muted-foreground">
                  {done} / {plan.tasks.length} tasks completed · {plan.budget.remainingEffortHours}h
                  remaining
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {plan.budget.deadlineInstant
                    ? new Date(plan.budget.deadlineInstant).toLocaleString()
                    : "Deadline not confirmed"}
                </p>
                {((profile.data &&
                  (profile.data.id !== plan.context.profileId ||
                    profile.data.version !== plan.context.profileVersion)) ||
                  opportunities.data?.some(
                    (o) =>
                      o.id === plan.context.opportunityId &&
                      o.sourceRevision !== plan.context.sourceRevision,
                  )) && (
                  <p className="mt-3 text-xs font-semibold text-[var(--galaxy-copper-ink)]">
                    Context outdated · progress preserved.
                  </p>
                )}
                <Link
                  to="/plans"
                  search={{ event: plan.context.opportunityId }}
                  className="detail-primary mt-5"
                >
                  Continue plan
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function AccountPreparation({ opportunityId }: { opportunityId: string }) {
  const auth = useAuth();
  const query = useQueryClient();
  const key = ["account", auth?.user?.id, "preparation", opportunityId];
  const data = useQuery({
    queryKey: key,
    retry: false,
    queryFn: async (): Promise<AccountPreparationBundle> => {
      const [opportunity, profile, submission, plans, resources] = await Promise.all([
        accountApi.opportunity(opportunityId),
        accountApi.profile(),
        accountApi.submission(opportunityId),
        accountApi.plans(),
        accountApi.resources(opportunityId),
      ]);
      const analysis = await accountApi.analyze(opportunity, profile, submission);
      return {
        analysis,
        opportunity,
        profile,
        submission,
        context: analysis.context,
        resources,
        plan: plans.find((plan) => plan.context.opportunityId === opportunityId) ?? null,
        updatedAt: null,
      };
    },
  });
  const bundle = data.data;
  const plan = bundle?.plan;
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const coverage = useQuery({
    queryKey: [
      "account",
      auth?.user?.id,
      "submission-coverage",
      opportunityId,
      bundle?.context,
      plan?.version,
      candidate?.candidateId,
    ],
    queryFn: () => accountApi.submissionCoverage(opportunityId, candidate?.candidateId),
    enabled: !!bundle,
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [hours, setHours] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [newDraft, setNewDraft] = useState(false);
  const lock = useRef(false);
  const live = useRef(true);
  const latest = useRef(bundle);
  latest.current = bundle;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const reload = () => {
    void query.invalidateQueries({ queryKey: ["account", auth?.user?.id] });
    void data.refetch();
  };
  const back = (
    <Link to="/" search={{ opportunity: opportunityId }} className="prep-back">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      Back to opportunity
    </Link>
  );
  if (data.isPending)
    return (
      <p role="status" className="prep-loading">
        Loading your account preparation data…
      </p>
    );
  if (!bundle)
    return (
      <div className="space-y-5">
        {back}
        <div role="alert" className="prep-error">
          <p>{data.error?.message ?? "Preparation data is unavailable."}</p>
          <button
            type="button"
            className="detail-secondary mt-3"
            onClick={() => void data.refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  const deadline = reliableDeadline(bundle.opportunity);
  const closed = !!deadline && Date.parse(deadline) <= Date.now();
  const capacity = bundle.profile.availableHoursPerWeek;
  const blocked = bundle.analysis.participationSummary === "does_not_meet_confirmed_requirement";
  const stale = !!plan && !sameContext(plan.context, bundle.context);
  const candidateStale =
    !!candidate &&
    (!sameContext(candidate.context, bundle.context) ||
      candidate.baseVersion !== (plan?.version ?? null));
  const tasks =
    plan?.taskOrder.map((id) => plan.tasks.find((t) => t.id === id)!).filter(Boolean) ?? [];
  const done = tasks.filter((t) => t.status === "done").length;
  const selectedTask = tasks.find((t) => t.id === taskId);
  async function generate() {
    if (lock.current || !bundle || blocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const context = bundle.context;
    const version = bundle.plan?.version ?? null;
    try {
      const draft = await accountApi.generate(
        bundle.opportunity,
        bundle.profile,
        bundle.submission,
        bundle.plan,
      );
      if (!live.current) return;
      const current = latest.current;
      if (
        !current ||
        !sameContext(context, current.context) ||
        version !== (current.plan?.version ?? null)
      )
        throw new Error(
          "Your account context changed. The older response was ignored; request a new draft.",
        );
      setCandidate({ ...draft, context, baseVersion: version, operationId: crypto.randomUUID() });
    } catch (failure) {
      if (live.current)
        setError(
          failure instanceof Error ? failure.message : "Generation failed. No plan was accepted.",
        );
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function accept() {
    if (
      !bundle ||
      !candidate ||
      accepting ||
      candidateStale ||
      !coverage.isSuccess ||
      coverage.isFetching ||
      coverage.data.candidateId !== candidate.candidateId ||
      !sameContext(coverage.data.context, bundle.context)
    )
      return;
    setAccepting(true);
    setError("");
    try {
      await accountApi.accept(
        opportunityId,
        candidate.candidateId,
        candidate.baseVersion,
        candidate.operationId,
      );
      if (!live.current) return;
      setCandidate(null);
      setNewDraft(false);
      setNotice("Plan accepted and confirmed in your account.");
      reload();
    } catch (failure) {
      if (live.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Acceptance failed. Your draft is preserved.",
        );
    } finally {
      if (live.current) setAccepting(false);
    }
  }
  async function saveSetup() {
    if (savingSetup) return;
    setSavingSetup(true);
    setError("");
    try {
      const snapshot = await accountApi.profileEditor();
      const value =
        hours.trim() === ""
          ? snapshot.profile.availableHoursPerWeek
          : { state: "known" as const, value: Number(hours), reportedAt: new Date().toISOString() };
      if (
        value.state === "known" &&
        (!Number.isFinite(value.value) || value.value < 0 || value.value > 168)
      )
        throw new Error("Enter 0–168 hours, or leave availability unknown.");
      const profile: StudentProfile = {
        ...snapshot.profile,
        availableHoursPerWeek: value,
        goals: goal.trim()
          ? [...snapshot.profile.goals, { id: crypto.randomUUID(), statement: goal.trim() }]
          : snapshot.profile.goals,
      };
      await accountApi.saveEditor(snapshot.profile, profile, snapshot.editor);
      setGoal("");
      setHours("");
      setNotice("Preparation preferences confirmed in your account.");
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your changes were not saved.");
    } finally {
      setSavingSetup(false);
    }
  }
  return (
    <div className="preparation-screen space-y-6">
      {back}
      <header className="prep-hero">
        <div>
          <p className="prep-eyebrow">
            <Sparkles className="size-4" aria-hidden />
            Preparation & progress
          </p>
          <h1>{bundle.opportunity.title}</h1>
          <p className="prep-organizer">{bundle.opportunity.organizer}</p>
        </div>
        <span className="prep-index-count">{plan ? `${done}/${tasks.length}` : "01"}</span>
      </header>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Clock3 className="size-4" aria-hidden />
          {capacity.state === "known"
            ? `${capacity.value}h per week`
            : "Weekly availability unknown"}
        </span>
        <span>
          ·{" "}
          {deadline
            ? `Submission: ${new Date(deadline).toLocaleString()}`
            : "Submission deadline not confirmed · untimed guidance"}
        </span>
      </div>
      {data.isError && (
        <p role="alert" className="prep-error">
          Refresh failed. Last confirmed data remains visible.{" "}
          <button type="button" className="underline" onClick={() => void data.refetch()}>
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center gap-2 text-sm text-[var(--galaxy-teal-ink)]">
          <CheckCircle2 className="size-4" aria-hidden />
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="prep-error">
          <p>{error}</p>
          <button type="button" className="detail-secondary mt-3" onClick={reload}>
            Reload current account data
          </button>
        </div>
      )}
      {stale && (
        <p role="status" className="prep-error">
          Profile, submission or source context changed. Your confirmed progress is preserved.
          Review current details before requesting a new draft.
        </p>
      )}
      {blocked && (
        <p role="alert" className="prep-error">
          A confirmed participation condition is not met. Preparation cannot bypass it.{" "}
          <Link to="/" search={{}} className="underline">
            Explore other opportunities
          </Link>
        </p>
      )}
      {plan && !newDraft && !candidate ? (
        <>
          <section className="glass rounded-3xl p-6">
            <p className="prep-eyebrow">{FEASIBILITY_LABELS[plan.feasibility]}</p>
            <div className="mt-5 grid grid-cols-2 gap-5">
              <div>
                <p className="text-3xl font-bold">
                  {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Task progress</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{plan.budget.remainingEffortHours}h</p>
                <p className="mt-1 text-xs text-muted-foreground">Remaining estimated effort</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
              />
            </div>
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer">Plan context and limitations</summary>
              <ul className="mt-3 list-disc space-y-2 ps-5 text-muted-foreground">
                {plan.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              <p className="mt-3">
                Plan version {plan.version}. Budget evaluated{" "}
                {new Date(plan.budget.evaluatedAt).toLocaleString()}.
              </p>
            </details>
          </section>
          {!tasks.length && (
            <p className="prep-empty">No remaining preparation tasks in this plan.</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <article key={task.id} className="glass rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="prep-priority">{task.priority}</span>
                  <span className="prep-status">{STATUS_LABELS[task.status]}</span>
                </div>
                <h2 className="mt-4 text-lg font-bold">{task.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.deliverable}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {task.estimatedHours}h original · {task.remainingEstimatedHours}h remaining
                </p>
                <TaskResources ids={task.resourceIds} catalog={bundle.resources} />
                <button
                  type="button"
                  className="detail-secondary mt-4"
                  onClick={() => setTaskId(task.id)}
                >
                  View task
                </button>
              </article>
            ))}
          </div>
          <button type="button" className="detail-secondary" onClick={() => setNewDraft(true)}>
            Review a new preparation draft
          </button>
        </>
      ) : candidate ? (
        <section className="glass rounded-3xl p-6">
          <p className="prep-eyebrow">Draft · not an accepted plan</p>
          <h2 className="mt-3 text-2xl font-bold">Review your preparation draft.</h2>
          <DraftFeasibility
            candidate={candidate.output}
            plan={plan ?? null}
            profile={bundle.profile}
            opportunity={bundle.opportunity}
            stale={candidateStale}
          />
          <p className="mt-3 text-sm leading-7">{candidate.output.explanation}</p>
          <div className="mt-6 divide-y divide-border">
            {candidate.output.tasks.map((task, index) => (
              <div key={index} className="py-4">
                <span className="prep-priority">{task.priority}</span>
                <h3 className="mt-2 font-semibold">{task.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{task.deliverable}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Complete when: {task.completionCriteria} · {task.estimatedHours}h
                </p>
              </div>
            ))}
          </div>
          {candidateStale && (
            <p role="alert" className="prep-error mt-4">
              This draft is outdated. The previous confirmed plan is unchanged; generate a fresh
              draft.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                accepting ||
                candidateStale ||
                !coverage.isSuccess ||
                coverage.isFetching ||
                coverage.data.candidateId !== candidate.candidateId ||
                !sameContext(coverage.data.context, bundle.context)
              }
              className="detail-primary"
              onClick={() => void accept()}
            >
              {accepting ? "Confirming storage…" : "Accept plan"}
            </button>
            <button
              type="button"
              disabled={accepting}
              className="detail-secondary"
              onClick={async () => {
                try {
                  await accountApi.discard(candidate.candidateId);
                  setCandidate(null);
                } catch (failure) {
                  setError(
                    failure instanceof Error ? failure.message : "Discard failed. Draft retained.",
                  );
                }
              }}
            >
              Discard draft
            </button>
          </div>
        </section>
      ) : (
        <section className="glass rounded-3xl p-6">
          <h2 className="text-2xl font-bold">Prepare with a realistic starting point.</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Your confirmed goals and availability are sent through the application backend. A
            missing Meta configuration is an error, never a template plan.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/profile"
              search={{ event: opportunityId, returnTo: "plans" }}
              className="detail-secondary"
            >
              Edit my profile
            </Link>
            {plan && (
              <button type="button" className="detail-secondary" onClick={() => setNewDraft(false)}>
                Continue confirmed plan
              </button>
            )}
          </div>
          <ul className="mt-5 list-disc space-y-2 ps-5 text-sm">
            {bundle.profile.goals.map((g) => (
              <li key={g.id}>{g.statement}</li>
            ))}
          </ul>
          <details
            className="mt-5 rounded-2xl border border-border p-4"
            open={!bundle.profile.goals.length || capacity.state === "unknown"}
          >
            <summary className="cursor-pointer font-semibold">
              Confirm availability or add a goal
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Weekly hours (optional)
                <input
                  className="prep-input mt-2 w-full"
                  type="number"
                  min={0}
                  max={168}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </label>
              <label className="text-sm">
                An accepted preparation goal
                <input
                  className="prep-input mt-2 w-full"
                  maxLength={1000}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={savingSetup || (!hours.trim() && !goal.trim())}
              className="detail-secondary mt-4"
              onClick={() => void saveSetup()}
            >
              {savingSetup ? "Saving…" : "Confirm in my profile"}
            </button>
          </details>
          {capacity.state === "known" && capacity.value === 0 && (
            <p className="prep-error mt-5">
              Zero preparation hours cannot support positive-workload preparation. You can keep zero
              and explore other opportunities.
            </p>
          )}
          {closed && (
            <p className="prep-error mt-5">
              The confirmed submission window has closed. A prospective plan cannot promise this
              deadline.
            </p>
          )}
          <button
            type="button"
            className="detail-primary mt-6"
            disabled={
              busy ||
              blocked ||
              closed ||
              (capacity.state === "known" && capacity.value === 0) ||
              !bundle.profile.goals.length
            }
            onClick={() => void generate()}
          >
            {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {busy ? "Generating through the backend…" : "Generate preparation draft"}
          </button>
        </section>
      )}
      <SubmissionChecklist
        opportunity={bundle.opportunity}
        submission={bundle.submission}
        analysis={bundle.analysis}
        coverage={coverage}
        plan={plan ?? null}
        onSaved={reload}
      />
      {selectedTask && plan && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          plan={plan}
          bundle={bundle}
          onClose={() => setTaskId(null)}
          onSaved={reload}
          failNextSave={false}
          onFailureUsed={() => {}}
        />
      )}
    </div>
  );
}
function SubmissionChecklist({
  opportunity,
  submission,
  plan,
  onSaved,
  analysis,
  coverage,
}: {
  opportunity: Opportunity;
  submission: SubmissionState;
  plan: Plan | null;
  onSaved: () => void;
  analysis: AnalysisResult;
  coverage: UseQueryResult<SubmissionCoverageView, Error>;
}) {
  const requirements = opportunity.requirements.filter(
    (r) =>
      r.lane === "submission" &&
      r.isMandatory &&
      analysis.matches.find((match) => match.requirementId === r.id)?.status !== "not_applicable",
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function update(requirementId: string, state: "unknown" | "missing" | "reported_present") {
    setPending(requirementId);
    setError("");
    try {
      const existing = submission.items.find((item) => item.requirementId === requirementId);
      const item: SubmissionState["items"][number] = {
        requirementId,
        state,
        criterionResults: {
          ...existing?.criterionResults,
          presence:
            state === "reported_present"
              ? "reported_met"
              : state === "missing"
                ? "reported_not_met"
                : "unknown",
        },
        evidenceLevel: "self_report",
        ...(existing?.artifactUrl ? { artifactUrl: existing.artifactUrl } : {}),
      };
      await apiJson(`/submissions/${encodeURIComponent(opportunity.id)}`, "PUT", {
        expectedVersion: submission.version,
        submission: {
          ...submission,
          items: [...submission.items.filter((i) => i.requirementId !== requirementId), item],
        },
      });
      accountDataChanged();
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Submission evidence was not saved.");
    } finally {
      setPending(null);
    }
  }
  return (
    <section className="border-t border-border pt-6">
      <h2 className="text-xl font-bold">Submission checklist · separate from learning</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        Task completion never confirms these items. Reported presence is not independent
        verification or proof that all artifact conditions are met.
      </p>
      {coverage.isFetching && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Checking task representation against current submission evidence…
        </p>
      )}
      {coverage.isError && (
        <p role="alert" className="prep-error mt-3">
          Coverage could not be confirmed. The accepted plan and evidence are unchanged.{" "}
          <button type="button" className="underline" onClick={() => void coverage.refetch()}>
            Retry coverage
          </button>
        </p>
      )}
      {coverage.data && !coverage.isError && (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Source coverage: {coverage.data.report.sourceCoverage}</span>
          <span>
            {coverage.data.report.unrepresentedRequirementIds.length} reviewed outstanding actions
            without a task
          </span>
          <span>
            {coverage.data.unresolvedRequirementIds.length} source/applicability checks unresolved
          </span>
          {coverage.data.planOutdated && <span>Plan context outdated · progress preserved</span>}
          <p className="w-full">
            Representation is not fulfillment. Unknown evidence is unresolved, not a confirmed
            failure. Even zero uncovered actions does not establish successful submission.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="prep-error mt-3">
          {error}
        </p>
      )}
      {!requirements.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No mandatory submission items are captured in this source snapshot. This does not
          establish that none exist.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border">
          {requirements.map((r) => {
            const evidence = submission.items.find((i) => i.requirementId === r.id);
            const tasks =
              plan?.tasks.filter(
                (task) => task.target.kind === "requirement" && task.target.requirementId === r.id,
              ) ?? [];
            return (
              <div key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="font-semibold">{r.statement}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current check:{" "}
                      {analysis.matches
                        .find((match) => match.requirementId === r.id)
                        ?.status.replaceAll("_", " ") ?? "unknown"}{" "}
                      · source: {r.sourceStatus}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {coverage.isError || coverage.isFetching
                        ? "Refreshing task representation…"
                        : coverage.data?.unresolvedRequirementIds.includes(r.id)
                          ? "Source or applicability unresolved; kept visible outside the reviewed reconciliation set."
                          : coverage.data?.report.unrepresentedRequirementIds.includes(r.id)
                            ? "Outstanding organizer action not represented by plan tasks."
                            : coverage.data?.report.candidateRequirementIds.includes(r.id)
                              ? "Represented in the proposed draft; submission evidence must still be checked."
                              : coverage.data?.report.retainedRequirementIds.includes(r.id)
                                ? "Represented by confirmed or explicitly retained work; task status is not submission evidence."
                                : tasks.length
                                  ? `Plan coverage: ${tasks.map((task) => task.title).join(" · ")}. Evidence must still be checked separately.`
                                  : "Not covered by a preparation task. Keep this organizer action visible."}
                    </p>
                  </div>
                  <label className="text-xs">
                    Your reported evidence
                    <select
                      className="prep-input mt-2 block"
                      value={evidence?.state ?? "unknown"}
                      disabled={pending !== null}
                      onChange={(e) =>
                        void update(
                          r.id,
                          e.target.value as "unknown" | "missing" | "reported_present",
                        )
                      }
                    >
                      <option value="unknown">Unknown</option>
                      <option value="missing">Missing</option>
                      <option value="reported_present">Reported present</option>
                    </select>
                  </label>
                </div>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer">Original requirement source</summary>
                  {r.sourceEvidenceIds.map((id) => {
                    const source = opportunity.sourceEvidence.find((s) => s.id === id);
                    return source ? (
                      <blockquote
                        key={id}
                        className="mt-3 border-s-2 border-primary/30 ps-3 leading-6"
                      >
                        {source.passage ?? "Passage unavailable."}
                        <a
                          href={source.sourceUrl}
                          className="ms-2 text-primary underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Source
                        </a>
                      </blockquote>
                    ) : null;
                  })}
                </details>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
