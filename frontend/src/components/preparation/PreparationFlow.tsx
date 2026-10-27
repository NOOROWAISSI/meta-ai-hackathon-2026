import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Flag,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useVisitState } from "@/components/VisitMemory";
import type {
  AssessmentContext,
  Plan,
  PlanAdjustmentPreview,
  PlanCandidateOutput,
  PreparationTask,
} from "@/lib/contract/types";
import {
  budgetFor,
  confirmedBlocker,
  FEASIBILITY_LABELS,
  reliableDeadline,
} from "@/lib/preparation/logic";
import { sameContext } from "@/lib/preparation/adapters";
import { preparationRepository } from "@/lib/preparation/repository";
import {
  mockPreparationService,
  preparationFeatures,
  type GenerationMode,
} from "@/lib/preparation/service";
import { profileService } from "@/lib/profile/service";
import { usePreparation } from "./usePreparation";
import { StorageRecovery } from "./StorageRecovery";
import { STATUS_LABELS, TaskDrawer } from "./TaskDrawer";
import { usePreparationZone } from "./usePreparationZone";
import { SamplePlanButton } from "./SamplePlanButton";

interface CandidateReview {
  output: PlanCandidateOutput;
  context: AssessmentContext;
  goalIds: string[];
  baseVersion: number | null;
  operationId: string;
}
type Fixture =
  | "normal"
  | "unknown-hours"
  | "zero-hours"
  | "conflicting-deadline"
  | "closed-window"
  | "infeasible"
  | "no-gap"
  | "hard-blocker";
const formatHours = (value: number | null) =>
  value === null ? "Not calculable" : `${Number(value.toFixed(1))}h`;
export function PreparationFlow({
  opportunityId,
  embedded = false,
  blocked = false,
  onOther,
}: {
  opportunityId: string;
  embedded?: boolean;
  blocked?: boolean;
  onOther?: () => void;
}) {
  const navigate = useNavigate();
  const { zone, formatInstant } = usePreparationZone();
  const { bundle, error, loading, reload } = usePreparation(opportunityId);
  const latestBundle = useRef(bundle);
  latestBundle.current = bundle;
  const [candidate, setCandidate] = useVisitState<CandidateReview | null>(
    `prep.candidate.${opportunityId}`,
    null,
  );
  const [selectedGoals, setSelectedGoals] = useVisitState<string[] | null>(
    `prep.goals.${opportunityId}`,
    null,
  );
  const [hoursInput, setHoursInput] = useVisitState(`prep.hours.${opportunityId}`, "");
  const [goalInput, setGoalInput] = useVisitState(`prep.goal-input.${opportunityId}`, "");
  const [hoursSkipped, setHoursSkipped] = useVisitState(
    `prep.hours-skipped.${opportunityId}`,
    false,
  );
  const [goalsSkipped, setGoalsSkipped] = useVisitState(
    `prep.goals-skipped.${opportunityId}`,
    false,
  );
  const [forceSetup, setForceSetup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>("normal");
  const [fixture, setFixture] = useState<Fixture>("normal");
  const [failNextSave, setFailNextSave] = useState(false);
  const [adjustment, setAdjustment] = useState<PlanAdjustmentPreview | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState("");
  const [failAdjustment, setFailAdjustment] = useState(false);
  const [conflictAdjustment, setConflictAdjustment] = useState(false);
  const mounted = useRef(true);
  const lock = useRef(false);
  const requestId = useRef(0);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current++;
    };
  }, []);
  const goalIds = (selectedGoals ?? bundle?.profile.goals.map((g) => g.id) ?? []).filter((id) =>
    bundle?.profile.goals.some((g) => g.id === id),
  );
  const contextKey = JSON.stringify([bundle?.context, goalIds, mode, fixture]);
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const plan = bundle?.plan ?? null;
  const stale = !!plan && !!bundle && !sameContext(plan.context, bundle.context);
  const candidateStale =
    !!candidate &&
    !!bundle &&
    (!sameContext(candidate.context, bundle.context) ||
      candidate.baseVersion !== (plan?.version ?? null));
  const previewOnly = fixture !== "normal" || mode === "no-gap";
  const actualHours = bundle?.profile.availableHoursPerWeek;
  const hours =
    fixture === "infeasible"
      ? 1
      : fixture === "unknown-hours"
        ? null
        : fixture === "zero-hours"
          ? 0
          : actualHours?.state === "known"
            ? actualHours.value
            : null;
  const actualDeadline = bundle ? reliableDeadline(bundle.opportunity) : null;
  const deadline =
    fixture === "closed-window"
      ? new Date(clock - 3600000).toISOString()
      : fixture === "infeasible"
        ? new Date(clock + 1800000).toISOString()
        : fixture === "conflicting-deadline"
          ? null
          : actualDeadline;
  const closed = !!deadline && Date.parse(deadline) <= clock;
  const blocker =
    blocked ||
    fixture === "hard-blocker" ||
    (!!bundle && !!confirmedBlocker(bundle.opportunity, bundle.profile));
  const workspaceDeadline = stale && fixture === "normal" ? plan!.budget.deadlineInstant : deadline;
  const timeAssessment = plan
    ? stale && fixture === "normal"
      ? { budget: plan.budget, feasibility: plan.feasibility }
      : budgetFor(
          plan.tasks,
          fixture === "zero-hours"
            ? 0
            : fixture === "unknown-hours"
              ? null
              : fixture === "infeasible"
                ? 1
                : plan.budget.hoursPerWeek,
          workspaceDeadline,
          new Date(clock),
        )
    : null;
  const ordered =
    plan?.taskOrder.map((id) => plan.tasks.find((task) => task.id === id)!).filter(Boolean) ?? [];
  const completed = ordered.filter((task) => task.status === "done").length;
  const needHours = hours === null && !hoursSkipped;
  const needGoals = !goalIds.length && !goalsSkipped;
  const generate = async () => {
    if (!bundle || lock.current || blocker || closed || hours === 0 || needHours || needGoals)
      return;
    lock.current = true;
    setGenerating(true);
    setGenerationError("");
    setSaveError("");
    setMessage("");
    const serial = ++requestId.current;
    const key = contextRef.current;
    const selectedProfile = {
      ...bundle.profile,
      goals: bundle.profile.goals.filter((g) => goalIds.includes(g.id)),
    };
    try {
      const output = await mockPreparationService.generate(
        {
          expectedSourceRevision: bundle.opportunity.sourceRevision,
          profile: selectedProfile,
          submission: bundle.submission,
          ...(plan ? { previousPlan: plan } : {}),
        },
        bundle.opportunity,
        bundle.resources,
        mode,
      );
      if (!mounted.current || serial !== requestId.current) return;
      if (key !== contextRef.current) {
        setGenerationError(
          "Your context or choices changed. The older response was ignored; generate a fresh draft.",
        );
        return;
      }
      setCandidate({
        output,
        context: bundle.context,
        goalIds: [...goalIds],
        baseVersion: plan?.version ?? null,
        operationId: crypto.randomUUID(),
      });
    } catch (failure) {
      if (mounted.current && serial === requestId.current)
        setGenerationError(
          failure instanceof Error ? failure.message : "Generation failed. Retry when ready.",
        );
    } finally {
      lock.current = false;
      if (mounted.current && serial === requestId.current) setGenerating(false);
    }
  };
  const accept = async () => {
    if (!candidate || saving || candidateStale || previewOnly) return;
    setSaving(true);
    setSaveError("");
    try {
      await preparationRepository.accept({
        opportunityId,
        context: candidate.context,
        candidate: candidate.output,
        goalIds: candidate.goalIds,
        baseVersion: candidate.baseVersion,
        operationId: candidate.operationId,
        fail: failNextSave,
      });
      if (!mounted.current) return;
      setCandidate(null);
      setForceSetup(false);
      setMessage("Plan accepted and saved in this browser.");
      await reload();
      if (embedded) void navigate({ to: "/plans", search: { event: opportunityId } });
    } catch (failure) {
      if (mounted.current)
        setSaveError(
          failure instanceof Error
            ? failure.message
            : "Plan not saved. Your draft is kept for retry.",
        );
    } finally {
      if (mounted.current) {
        setSaving(false);
        setFailNextSave(false);
      }
    }
  };
  const confirmPreferences = async () => {
    if (confirming) return;
    setConfirming(true);
    setProfileError("");
    try {
      const editor = await profileService.load();
      const text = hoursInput.trim();
      const nextHours = text === "" ? editor.weeklyHours : Number(text);
      if (text && (!Number.isFinite(nextHours) || nextHours! < 0 || nextHours! > 168))
        throw new Error("Enter hours from 0 to 168, or choose Not sure.");
      const goal = goalInput.trim();
      if (!text && !goal) throw new Error("Enter a value to confirm, or choose Skip / Not sure.");
      await profileService.save(
        {
          ...editor,
          weeklyHours: nextHours,
          ...(goal
            ? {
                goals: [...(editor.goals ?? []), goal],
                goalDescription: [...(editor.goals ?? []), goal].join("; "),
                goalChoice: "unknown" as const,
              }
            : {}),
        },
        editor,
      );
      if (!mounted.current) return;
      setHoursInput("");
      setGoalInput("");
      setSelectedGoals(null);
      setMessage("Preparation preferences confirmed in your profile.");
      await reload();
    } catch (failure) {
      if (mounted.current)
        setProfileError(
          failure instanceof Error
            ? failure.message
            : "Preferences not saved. Your inputs are kept.",
        );
    } finally {
      if (mounted.current) setConfirming(false);
    }
  };
  const previewAdjustment = async () => {
    if (!bundle || adjusting) return;
    setAdjusting(true);
    setAdjustError("");
    try {
      const result = await mockPreparationService.adjustment(bundle, failAdjustment);
      if (
        mounted.current &&
        latestBundle.current &&
        sameContext(result.context, latestBundle.current.context) &&
        result.baseVersion === latestBundle.current.plan?.version
      )
        setAdjustment(result);
      else if (mounted.current)
        setAdjustError(
          "Context changed while reviewing. The old adjustment response was ignored; request a new preview.",
        );
    } catch (failure) {
      setAdjustError(failure instanceof Error ? failure.message : "Adjustment failed.");
    } finally {
      setAdjusting(false);
    }
  };
  const acceptAdjustment = async () => {
    if (!adjustment || saving) return;
    setSaving(true);
    setAdjustError("");
    try {
      await preparationRepository.adjust(
        opportunityId,
        conflictAdjustment
          ? { ...adjustment, baseVersion: Math.max(0, adjustment.baseVersion - 1) }
          : adjustment,
        failNextSave,
      );
      setAdjustment(null);
      setMessage("Remaining-plan review saved. Completed work is unchanged.");
      await reload();
    } catch (failure) {
      setAdjustError(failure instanceof Error ? failure.message : "Adjustment was not saved.");
    } finally {
      setSaving(false);
      setFailNextSave(false);
      setConflictAdjustment(false);
    }
  };
  if (loading)
    return (
      <div role="status" className="prep-loading">
        <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden />
        Loading confirmed preparation data…
      </div>
    );
  if (!bundle)
    return (
      <div className="space-y-5">
        <div role="alert" className="prep-error">
          <h2 className="font-semibold">Preparation data is unavailable</h2>
          <p className="mt-2 text-sm">{error || "No selected opportunity was found."}</p>
          <button type="button" onClick={() => void reload()} className="detail-primary mt-4">
            Retry loading
          </button>
          <Link to="/" search={{}} className="detail-secondary mt-4 ml-2">
            Explore hackathons
          </Link>
        </div>
        <StorageRecovery onReset={() => void reload()} />
      </div>
    );
  const candidateTasks = candidate?.output.tasks ?? [];
  const retainedTasks =
    plan?.tasks.filter((task) => task.status !== "not_started" || task.artifactUrls.length) ?? [];
  const candidateAssessment = budgetFor(
    [
      ...retainedTasks,
      ...candidateTasks.map((task, index) => ({
        ...task,
        id: String(index),
        remainingEstimatedHours: task.estimatedHours,
        status: "not_started" as const,
        artifactUrls: [],
      })),
    ],
    hours,
    deadline,
    new Date(clock),
  );
  const title =
    plan && !forceSetup && !candidate ? "One focused step at a time." : "Make your next move.";
  const showWorkspace = !!plan && !forceSetup && !candidate;
  return (
    <div className={`preparation-screen ${embedded ? "prep-embedded" : ""}`}>
      {!embedded && (
        <div className="prep-navigation-row">
          <Link to="/" search={{ event: opportunityId }} className="prep-back">
            <ArrowLeft className="size-4" aria-hidden />
            Back to event details
          </Link>
          <Link to="/plans" search={{}} className="prep-back">
            All my plans
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
      <header className="prep-hero">
        <div>
          <p className="prep-eyebrow">
            <Sparkles className="size-3.5" aria-hidden />
            Preparation & progress
          </p>
          {embedded ? (
            <h2 id="prep-heading" tabIndex={-1}>
              {title}
            </h2>
          ) : (
            <h1 id="prep-heading" tabIndex={-1}>
              {title}
            </h1>
          )}
          <p className="prep-event-title">{bundle.opportunity.title}</p>
          <p className="prep-organizer">By {bundle.opportunity.organizer}</p>
        </div>
        <div className="prep-hero-mark" aria-hidden>
          <Target />
          <span>{showWorkspace ? `${completed}/${ordered.length}` : "NEXT"}</span>
        </div>
      </header>
      <p className="prep-demo-notice">
        Demo generation · browser-only storage · task completion is self-reported.
      </p>
      {error && (
        <div role="alert" className="prep-error">
          <p>{error} Your previous confirmed snapshot remains visible.</p>
          <button type="button" className="mt-2 text-xs underline" onClick={() => void reload()}>
            Retry loading current data
          </button>
        </div>
      )}
      {import.meta.env.DEV && (
        <details className="prep-dev-controls">
          <summary>Development fixture controls</summary>
          <SamplePlanButton />
          <div>
            <label>
              Scenario
              <select
                value={fixture}
                onChange={(event) => {
                  setFixture(event.target.value as Fixture);
                  if (event.target.value === "no-gap") setMode("no-gap");
                  else if (mode === "no-gap") setMode("normal");
                }}
                disabled={generating || saving}
              >
                {[
                  "normal",
                  "unknown-hours",
                  "zero-hours",
                  "conflicting-deadline",
                  "closed-window",
                  "infeasible",
                  "no-gap",
                  "hard-blocker",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Mock generator
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as GenerationMode)}
                disabled={generating || saving}
              >
                {["normal", "timeout", "failure", "invalid-output", "no-gap"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={failNextSave}
                onChange={(event) => setFailNextSave(event.target.checked)}
              />
              Fail next storage operation
            </label>
            {preparationFeatures.adjustment && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={failAdjustment}
                    onChange={(event) => setFailAdjustment(event.target.checked)}
                  />
                  Fail adjustment preview
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={conflictAdjustment}
                    onChange={(event) => setConflictAdjustment(event.target.checked)}
                  />
                  Simulate adjustment version conflict
                </label>
              </>
            )}
          </div>
          <p>
            Simulated deadline/capacity states are preview-only and never change published records.
          </p>
        </details>
      )}
      {previewOnly && (
        <p role="status" className="prep-warning">
          Fixture preview · not published event information. Return to Normal to accept a real demo
          plan.
        </p>
      )}
      {message && (
        <p role="status" className="prep-confirmed">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}
      {stale && (
        <div role="status" className="prep-warning">
          <strong>Plan context is outdated.</strong> Your confirmed tasks and completed work are
          kept.
          <details>
            <summary>What changed?</summary>
            <p>
              Compare profile version {plan!.context.profileVersion} →{" "}
              {bundle.context.profileVersion}, source {plan!.context.sourceRevision} →{" "}
              {bundle.context.sourceRevision}, and submission version{" "}
              {plan!.context.submissionVersion} → {bundle.context.submissionVersion}.
            </p>
          </details>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary underline"
            onClick={() => {
              setForceSetup(true);
              setCandidate(null);
            }}
          >
            Review current preparation
          </button>
        </div>
      )}
      {showWorkspace && timeAssessment ? (
        <>
          <section className="prep-dashboard">
            <div
              className="prep-task-progress"
              aria-label={`Task progress: ${completed} of ${ordered.length} tasks completed`}
            >
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="48" pathLength="100" className="prep-progress-track" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  pathLength="100"
                  className="prep-progress-fill"
                  strokeDasharray={`${ordered.length ? (completed / ordered.length) * 100 : 0} 100`}
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div>
                <strong>
                  {ordered.length ? Math.round((completed / ordered.length) * 100) : 0}
                  <small>%</small>
                </strong>
                <span>Task progress</span>
              </div>
              <p>
                {completed} / {ordered.length} completed tasks
              </p>
            </div>
            <div className="prep-budget-summary">
              <span className={`prep-feasibility feasibility-${timeAssessment.feasibility}`}>
                {FEASIBILITY_LABELS[timeAssessment.feasibility]}
              </span>
              <div className="prep-budget-numbers">
                <p>
                  <strong>{formatHours(timeAssessment.budget.remainingEffortHours)}</strong>
                  <span>Remaining effort</span>
                </p>
                <p>
                  <strong>{formatHours(timeAssessment.budget.availableHours)}</strong>
                  <span>Available preparation time</span>
                </p>
              </div>
              <div className="prep-schedule-strip">
                <span>
                  <Clock3 className="size-3.5" aria-hidden />
                  {plan!.budget.hoursPerWeek === null
                    ? "Weekly hours unknown"
                    : `${plan!.budget.hoursPerWeek}h / week`}
                </span>
                <span>
                  {workspaceDeadline
                    ? `${formatInstant(workspaceDeadline)} (${zone})`
                    : "Deadline not confirmed"}
                </span>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Last saved{" "}
                {bundle.updatedAt
                  ? new Date(bundle.updatedAt).toLocaleString()
                  : "before storage migration"}{" "}
                · Plan version {plan!.version}
              </p>
              <details className="prep-reasoning">
                <summary>Time assessment & limitations</summary>
                <p>
                  {workspaceDeadline
                    ? `Original deadline: ${workspaceDeadline}. Available time assumes even weekly distribution ${stale ? "at the saved assessment" : "from now"}; it is not a guarantee of completion.`
                    : "No reliable submission deadline or time zone is available. This plan provides untimed guidance."}
                </p>
                {plan!.warnings.map((warning, index) => (
                  <p key={index}>{warning}</p>
                ))}
              </details>
            </div>
          </section>
          {closed && (
            <p role="status" className="prep-warning">
              The confirmed submission window is closed. Your existing progress remains available as
              history, without a promise to meet that deadline.
            </p>
          )}
          <div className="prep-list-heading">
            <h2>
              Your next steps <span>{ordered.length}</span>
            </h2>
            <button
              type="button"
              onClick={() => setForceSetup(true)}
              className="prep-inline-action"
            >
              Review preparation
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
          {!ordered.length && (
            <div className="prep-empty">
              <CheckCircle2 className="size-9 text-[var(--galaxy-teal-ink)]" aria-hidden />
              <h3>No remaining preparation tasks.</h3>
              <p>
                {plan!.warnings[0] ??
                  "No tasks were proposed. This is not an eligibility or submission-compliance decision."}
              </p>
            </div>
          )}
          <div className="prep-task-list">
            {ordered.map((task, index) => {
              const target = task.target;
              const reason =
                target.kind === "goal"
                  ? plan!.goals.find((goal) => goal.id === target.goalId)?.statement
                  : bundle.opportunity.requirements.find(
                      (requirement) => requirement.id === target.requirementId,
                    )?.statement;
              return (
                <article className={`prep-task-card task-${task.status}`} key={task.id}>
                  <div className="prep-task-index" aria-hidden>
                    {task.status === "done" ? (
                      <Check className="size-5" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </div>
                  <div className="prep-task-content">
                    <div className="prep-task-tags">
                      <span className={`prep-priority priority-${task.priority}`}>
                        {task.priority}
                      </span>
                      <span className="prep-status">{STATUS_LABELS[task.status]}</span>
                    </div>
                    <h3>{task.title}</h3>
                    <p className="prep-task-deliverable">{task.deliverable}</p>
                    <p className="prep-task-reason">
                      <Flag className="size-3 shrink-0" aria-hidden />
                      {reason ?? "Target details need review in the current context."}
                    </p>
                    <div className="prep-task-bottom">
                      <span>
                        {task.remainingEstimatedHours}h remaining · {task.estimatedHours}h original
                      </span>
                      <span>
                        {task.resourceIds.length
                          ? `${task.resourceIds.length} attached resources`
                          : "No reviewed resources"}
                      </span>
                      <button type="button" onClick={() => setTaskId(task.id)}>
                        View task
                        <ArrowUpRightIcon />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {preparationFeatures.adjustment && (
            <section className="prep-adjustment">
              <button
                type="button"
                className="detail-secondary"
                disabled={adjusting || !ordered.some((task) => task.status !== "done")}
                onClick={() => void previewAdjustment()}
              >
                {adjusting ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-4" aria-hidden />
                )}
                Adjust remaining work
              </button>
              {adjustError && (
                <p role="alert" className="prep-error">
                  {adjustError}
                  <button
                    type="button"
                    className="mt-2 block underline"
                    onClick={() => void previewAdjustment()}
                  >
                    Retry / request new preview
                  </button>
                </p>
              )}
              {adjustment && (
                <div className="prep-adjustment-preview">
                  <h3>Remaining-work review · preview only</h3>
                  <p>{adjustment.explanation}</p>
                  <p>
                    {adjustment.preservedCompletedTaskIds.length} completed tasks preserved · base
                    version {adjustment.baseVersion}
                  </p>
                  <div className="mt-3 space-y-2">
                    {adjustment.unfinishedTaskOrder.map((id) => {
                      const task = plan!.tasks.find((task) => task.id === id)!;
                      const change = adjustment.proposedChanges.find(
                        (change) => change.taskId === id,
                      );
                      return (
                        <p key={id}>
                          {task.title}: {task.remainingEstimatedHours}h →{" "}
                          {change?.proposedRemainingEstimatedHours ?? task.remainingEstimatedHours}h
                          {change ? ` · ${change.reason}` : " · no justified estimate change"}
                        </p>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="detail-primary"
                      disabled={saving}
                      onClick={() => void acceptAdjustment()}
                    >
                      Accept changes
                    </button>
                    <button
                      type="button"
                      className="detail-secondary"
                      disabled={saving}
                      onClick={() => {
                        setAdjustment(null);
                        setAdjustError("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          {plan && (
            <button
              type="button"
              onClick={() => {
                setForceSetup(false);
                setCandidate(null);
              }}
              className="prep-back"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Continue confirmed plan
            </button>
          )}
          {blocker ? (
            <section className="prep-blocker">
              <ShieldAlert className="size-8" aria-hidden />
              <h2>Review the participation blocker first</h2>
              <p>
                A confirmed hard participation condition is not met
                {fixture === "hard-blocker" ? " in this simulated preview" : ""}. Preparation cannot
                remove it.
              </p>
              <button
                type="button"
                className="detail-primary"
                onClick={() => (onOther ? onOther() : void navigate({ to: "/", search: {} }))}
              >
                Explore other opportunities
              </button>
            </section>
          ) : candidate ? (
            <section className="prep-candidate">
              <div className="prep-candidate-heading">
                <div>
                  <p className="prep-eyebrow">Draft · not accepted</p>
                  <h2>Your preparation priorities</h2>
                </div>
                <strong>
                  {formatHours(candidateAssessment.budget.remainingEffortHours)}
                  <span>estimated total</span>
                </strong>
              </div>
              {candidateStale && (
                <p role="status" className="prep-warning">
                  Draft context or plan version is outdated. Its contents are kept for reference.
                  Generate a fresh draft before accepting.
                </p>
              )}
              <p className="prep-feasibility">
                {FEASIBILITY_LABELS[candidateAssessment.feasibility]}
              </p>
              {!!retainedTasks.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {retainedTasks.filter((task) => task.status === "done").length} completed and{" "}
                  {retainedTasks.filter((task) => task.status !== "done").length}{" "}
                  started/artifact-linked tasks will be retained unchanged. Their remaining effort
                  is included above.
                </p>
              )}
              <div className="prep-candidate-tasks">
                {candidateTasks.map((task, index) => {
                  const target = task.target;
                  return (
                    <article key={index}>
                      <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <p className={`prep-priority priority-${task.priority}`}>
                          {task.priority} · {task.estimatedHours}h
                        </p>
                        <h3>{task.title}</h3>
                        <p>{task.deliverable}</p>
                        <details>
                          <summary>Completion criteria & target</summary>
                          <p>{task.completionCriteria}</p>
                          <p>
                            {target.kind === "goal"
                              ? bundle.profile.goals.find((goal) => goal.id === target.goalId)
                                  ?.statement
                              : bundle.opportunity.requirements.find(
                                  (requirement) => requirement.id === target.requirementId,
                                )?.statement}
                          </p>
                          <p>
                            {task.resourceIds.length
                              ? "Resources will be resolved against the reviewed catalog."
                              : "No reviewed resource links attached."}
                          </p>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!candidateTasks.length && (
                <p className="prep-empty">No tasks were proposed. {candidate.output.explanation}</p>
              )}
              <details className="prep-reasoning">
                <summary>Why these tasks & important limits</summary>
                <p>{candidate.output.explanation}</p>
                {!deadline && (
                  <p>Untimed guidance. No confirmed submission schedule is promised.</p>
                )}
                {plan && (
                  <p>
                    Acceptance replaces unstarted work, retaining started/completed tasks and tasks
                    with existing artifacts unchanged.
                  </p>
                )}
              </details>
              {saveError && (
                <div role="alert" className="prep-error">
                  <p>{saveError}</p>
                  <button
                    type="button"
                    className="mt-2 font-semibold underline"
                    disabled={saving || candidateStale || previewOnly}
                    onClick={() => void accept()}
                  >
                    Retry accepting plan
                  </button>
                </div>
              )}
              <div className="prep-candidate-actions">
                <button
                  type="button"
                  className="detail-primary"
                  disabled={saving || candidateStale || previewOnly || closed || hours === 0}
                  onClick={() => void accept()}
                >
                  {saving ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  {saving ? "Confirming storage…" : "Accept plan"}
                </button>
                <button
                  type="button"
                  className="detail-secondary"
                  disabled={saving}
                  onClick={() => {
                    setCandidate(null);
                    setSaveError("");
                  }}
                >
                  Discard draft
                </button>
                {candidateStale && (
                  <button
                    type="button"
                    className="detail-secondary"
                    disabled={generating}
                    onClick={() => {
                      setCandidate(null);
                      void generate();
                    }}
                  >
                    Generate fresh draft
                  </button>
                )}
              </div>
              {saving && (
                <p role="status" className="mt-3 text-xs text-muted-foreground">
                  Saving. Your prior confirmed plan remains intact until this transaction succeeds.
                </p>
              )}
            </section>
          ) : (
            <section className="prep-setup">
              <div className="prep-setup-overview">
                <div>
                  <p className="prep-small-label">Target submission deadline</p>
                  <strong>{deadline ? formatInstant(deadline) : "Deadline not confirmed"}</strong>
                  <span>
                    {deadline
                      ? `${zone} · original ${deadline}`
                      : "Untimed guidance · no submission schedule promised"}
                  </span>
                </div>
                <div>
                  <p className="prep-small-label">Weekly preparation hours</p>
                  <strong>{hours === null ? "Unknown" : `${hours}h`}</strong>
                  <Link
                    to="/profile"
                    search={{ event: opportunityId, returnTo: "plans" }}
                    className="prep-inline-action"
                  >
                    Edit my profile
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
              {closed && (
                <p role="alert" className="prep-warning">
                  The confirmed submission window is closed. Generation is unavailable for a
                  prospective submission plan. You can review public details or explore other
                  opportunities.
                </p>
              )}
              {hours === 0 && (
                <p role="alert" className="prep-warning">
                  You reported zero preparation hours. Keep that value, or edit your profile before
                  generating positive-workload tasks. No achievable schedule will be invented.
                </p>
              )}
              <fieldset className="prep-goals" disabled={generating || saving}>
                <legend>Accepted preparation goals</legend>
                {bundle.profile.goals.map((goal) => (
                  <label key={goal.id}>
                    <input
                      type="checkbox"
                      checked={goalIds.includes(goal.id)}
                      onChange={(event) =>
                        setSelectedGoals(
                          event.target.checked
                            ? [...goalIds, goal.id]
                            : goalIds.filter((id) => id !== goal.id),
                        )
                      }
                    />
                    <span>{goal.statement}</span>
                  </label>
                ))}
                {!bundle.profile.goals.length && <p>No preparation goal is confirmed yet.</p>}
              </fieldset>
              {(hours === null || !bundle.profile.goals.length) && (
                <div className="prep-clarification">
                  <h3>Only the missing pieces</h3>
                  {hours === null && (
                    <div>
                      <label htmlFor={`prep-hours-${opportunityId}`}>Weekly hours (optional)</label>
                      <input
                        id={`prep-hours-${opportunityId}`}
                        type="number"
                        min={0}
                        max={168}
                        step="any"
                        className="prep-input"
                        value={hoursInput}
                        onChange={(event) => setHoursInput(event.target.value)}
                        placeholder="Not sure yet"
                        disabled={confirming || generating}
                      />
                      <button
                        type="button"
                        onClick={() => setHoursSkipped(true)}
                        className="prep-inline-action"
                      >
                        {hoursSkipped ? "Unknown hours acknowledged" : "Skip / Not sure"}
                      </button>
                    </div>
                  )}
                  {!bundle.profile.goals.length && (
                    <div>
                      <label htmlFor={`prep-goal-${opportunityId}`}>
                        What would you like to prepare? (optional)
                      </label>
                      <input
                        id={`prep-goal-${opportunityId}`}
                        className="prep-input"
                        value={goalInput}
                        onChange={(event) => setGoalInput(event.target.value)}
                        maxLength={400}
                        placeholder="Describe one personal goal"
                        disabled={confirming || generating}
                      />
                      <button
                        type="button"
                        onClick={() => setGoalsSkipped(true)}
                        className="prep-inline-action"
                      >
                        {goalsSkipped ? "No goal confirmed yet" : "Not sure yet"}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="detail-secondary"
                    disabled={confirming || generating || (!hoursInput.trim() && !goalInput.trim())}
                    onClick={() => void confirmPreferences()}
                  >
                    {confirming ? "Confirming…" : "Confirm these profile facts"}
                  </button>
                  {profileError && (
                    <p role="alert" className="prep-error">
                      {profileError}
                    </p>
                  )}
                </div>
              )}
              <details className="prep-reasoning" open={false}>
                <summary>Important information to clarify</summary>
                <p>
                  Participation coverage, mandatory submission items, and original submission timing
                  are unverified in these fictional records. Missing profile facts remain unknown.
                </p>
                <p>
                  Preparation capacity is separate from eligibility and submission compliance.
                  Completed tasks do not satisfy organizer requirements automatically.
                </p>
              </details>
              {generationError && (
                <p role="alert" className="prep-error">
                  {generationError}
                </p>
              )}
              <button
                type="button"
                className="detail-primary prep-generate"
                disabled={
                  generating ||
                  confirming ||
                  needHours ||
                  needGoals ||
                  closed ||
                  hours === 0 ||
                  blocker
                }
                onClick={() => void generate()}
              >
                {generating ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {generating
                  ? "Preparing your demo draft…"
                  : generationError
                    ? "Retry generation"
                    : "Generate preparation draft"}
              </button>
              {generating && (
                <p role="status" className="mt-3 text-xs text-muted-foreground">
                  Organizing your confirmed goals into proposed tasks. No plan is being overwritten.
                </p>
              )}
            </section>
          )}
        </>
      )}
      {taskId && plan && plan.tasks.find((task) => task.id === taskId) && (
        <TaskDrawer
          key={taskId}
          task={plan.tasks.find((task) => task.id === taskId)!}
          plan={plan}
          bundle={bundle}
          onClose={() => setTaskId(null)}
          onSaved={() => void reload()}
          failNextSave={failNextSave}
          onFailureUsed={() => setFailNextSave(false)}
        />
      )}
      <StorageRecovery
        onReset={() => {
          setCandidate(null);
          setTaskId(null);
          setAdjustment(null);
          void reload();
        }}
      />
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight className="size-3.5" aria-hidden />;
}
