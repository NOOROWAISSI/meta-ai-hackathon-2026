import { useState } from "react";
import { CheckCircle2, FileCheck2, LoaderCircle, Save } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Plan, PreparationTask, TaskStatus } from "@/lib/contract/types";
import type { PreparationBundle } from "@/lib/preparation/logic";
import { apiJson, accountDataChanged } from "@/lib/account/api";
import { preparationFeatures } from "@/lib/preparation/service";
import { TaskResources } from "./Resources";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};
interface TaskProgressRequest {
  opportunityId: string;
  planId: string;
  baseVersion: number;
  taskId: string;
  status: TaskStatus;
  operationId: string;
  artifactUrls?: string[];
  fail?: boolean;
}
const preparationRepository = {
  async progress(input: TaskProgressRequest) {
    const result = await apiJson<Plan>(
      `/plans/${encodeURIComponent(input.opportunityId)}/tasks/${encodeURIComponent(input.taskId)}`,
      "PATCH",
      {
        expectedVersion: input.baseVersion,
        status: input.status,
        operationId: input.operationId,
        ...(input.artifactUrls ? { artifactUrls: input.artifactUrls } : {}),
      },
    );
    accountDataChanged();
    return result;
  },
};
export function TaskDrawer({
  task,
  plan,
  bundle,
  onClose,
  onSaved,
  failNextSave,
  onFailureUsed,
}: {
  task: PreparationTask;
  plan: Plan;
  bundle: PreparationBundle;
  onClose: () => void;
  onSaved: () => void;
  failNextSave: boolean;
  onFailureUsed: () => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [artifacts, setArtifacts] = useState(task.artifactUrls.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [failedRequest, setFailedRequest] = useState<
    Parameters<typeof preparationRepository.progress>[0] | null
  >(null);
  const target = task.target;
  const requirement =
    target.kind === "requirement"
      ? bundle.opportunity.requirements.find((r) => r.id === target.requirementId)
      : null;
  const goal = target.kind === "goal" ? plan.goals.find((g) => g.id === target.goalId) : null;
  const changed = status !== task.status || artifacts !== task.artifactUrls.join("\n");
  const save = async (retry = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const request =
      retry && failedRequest
        ? failedRequest
        : {
            opportunityId: plan.context.opportunityId,
            planId: plan.id,
            baseVersion: plan.version,
            taskId: task.id,
            status,
            operationId: crypto.randomUUID(),
            ...(preparationFeatures.artifacts
              ? {
                  artifactUrls: artifacts
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }
              : {}),
          };
    try {
      await preparationRepository.progress({ ...request, fail: failNextSave });
      setFailedRequest(null);
      setSaved(true);
      onSaved();
    } catch (failure) {
      setFailedRequest(request);
      setError(failure instanceof Error ? failure.message : "Progress was not saved.");
    } finally {
      if (failNextSave) onFailureUsed();
      setBusy(false);
    }
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (
          !open &&
          !busy &&
          ((!changed && !failedRequest) ||
            window.confirm(
              "Discard the unsaved task changes? Your confirmed progress will stay unchanged.",
            ))
        )
          onClose();
      }}
    >
      <SheetContent
        className="prep-drawer overflow-y-auto"
        aria-describedby="task-drawer-description"
      >
        <SheetHeader>
          <p className="prep-eyebrow">Your task · self-reported progress</p>
          <SheetTitle className="text-2xl">{task.title}</SheetTitle>
          <SheetDescription id="task-drawer-description">
            A focused step toward your accepted preparation goal.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className={`prep-priority priority-${task.priority}`}>{task.priority}</span>
            <span className="prep-status">{STATUS_LABELS[task.status]} · confirmed</span>
          </div>
          <section className="prep-task-target">
            <p className="prep-small-label">
              {target.kind === "goal" ? "Accepted personal goal" : "Linked requirement"}
            </p>
            <p className="mt-2 text-sm">
              {goal?.statement ??
                requirement?.statement ??
                "The linked target is unavailable in the current source revision. Your previous task remains visible."}
            </p>
            {requirement && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-primary">
                  Requirement source passage
                </summary>
                {requirement.sourceEvidenceIds.map((id) => {
                  const evidence = bundle.opportunity.sourceEvidence.find((e) => e.id === id);
                  return evidence ? (
                    <blockquote className="mt-3 border-l-2 border-primary/20 pl-3" key={id}>
                      <p>{evidence.passage ?? "Original passage not available."}</p>
                      <p className="mt-2 text-muted-foreground">
                        {evidence.status === "unverified"
                          ? "Fictional / unverified record"
                          : "Source snapshot"}{" "}
                        · {evidence.sourceSection}
                      </p>
                      <a
                        className="mt-2 block text-primary underline"
                        href={evidence.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View source
                      </a>
                    </blockquote>
                  ) : (
                    <p key={id}>Source passage unavailable.</p>
                  );
                })}
                {!requirement.sourceEvidenceIds.length && (
                  <p className="mt-2">No original source passage is available.</p>
                )}
              </details>
            )}
          </section>
          <section>
            <h3 className="prep-small-label">Deliverable</h3>
            <p className="mt-2 text-sm leading-relaxed">{task.deliverable}</p>
          </section>
          <section>
            <h3 className="prep-small-label">Complete when</h3>
            <p className="mt-2 text-sm leading-relaxed">{task.completionCriteria}</p>
          </section>
          <div className="prep-effort-pair">
            <span>
              <strong>{task.estimatedHours}h</strong>Original estimate
            </span>
            <span>
              <strong>{task.remainingEstimatedHours}h</strong>Confirmed remaining
            </span>
          </div>
          <section>
            <h3 className="mb-3 prep-small-label">Learning resources</h3>
            <TaskResources ids={task.resourceIds} catalog={bundle.resources} />
          </section>
          {preparationFeatures.artifacts && (
            <section>
              <label htmlFor="task-artifacts" className="prep-small-label">
                Artifact URLs (optional)
              </label>
              <textarea
                id="task-artifacts"
                rows={3}
                value={artifacts}
                onChange={(event) => {
                  setArtifacts(event.target.value);
                  setSaved(false);
                  setFailedRequest(null);
                  setError("");
                }}
                disabled={busy}
                placeholder="One http:// or https:// URL per line"
                className="prep-input mt-2"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                A linked artifact is not independent proof of authorship or competence.
              </p>
            </section>
          )}
          <fieldset disabled={busy}>
            <legend className="prep-small-label">Task status</legend>
            <div className="prep-status-choices">
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="task-status"
                    value={value}
                    checked={status === value}
                    onChange={() => {
                      setStatus(value);
                      setSaved(false);
                      setFailedRequest(null);
                    }}
                  />
                  {STATUS_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
          {status === "done" && (
            <p className="prep-resource-empty">
              <FileCheck2 className="size-4 shrink-0" aria-hidden />
              Done is your progress report. Remaining effort becomes zero after saving; eligibility
              and submission compliance do not change.
            </p>
          )}
          {error && (
            <div role="alert" className="prep-error">
              <p>{error}</p>
              <p className="mt-2 text-xs">
                Requested status: {STATUS_LABELS[status]} · unsaved. Confirmed status:{" "}
                {STATUS_LABELS[task.status]}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="detail-primary"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Retry save
                </button>
                <button
                  type="button"
                  className="detail-secondary"
                  disabled={busy}
                  onClick={() => {
                    setFailedRequest(null);
                    setError("");
                    onSaved();
                  }}
                >
                  Review latest plan
                </button>
              </div>
            </div>
          )}
          {saved && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-[var(--galaxy-teal-ink)]"
            >
              <CheckCircle2 className="size-4" aria-hidden />
              Progress saved and confirmed.
            </p>
          )}
          <button
            type="button"
            className="detail-primary w-full"
            disabled={busy || saved || (!changed && !failedRequest)}
            onClick={() => void save()}
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {busy ? "Saving progress…" : "Save task progress"}
          </button>
          {busy && (
            <p role="status" className="text-xs text-muted-foreground">
              Saving. The list still shows your last confirmed progress.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
