import type {
  AssessmentContext,
  Opportunity,
  Plan,
  PlanAdjustmentPreview,
  PlanCandidateOutput,
  ProgressState,
  ReviewedResource,
  SubmissionState,
  TaskStatus,
} from "../contract/types";
import type { UserProfile } from "../discover/types";
import { DEFAULT_PROFILE } from "../discover/demo-data";
import { initializeStore, transaction } from "../storage/database";
import { assessmentContext, emptySubmission, sameContext, toStudentProfile } from "./adapters";
import {
  budgetFor,
  confirmedBlocker,
  reliableDeadline,
  validateCandidate,
  validatePlan,
  type PreparationBundle,
} from "./logic";

interface Records {
  editor: UserProfile;
  opportunity: Opportunity;
  submission: SubmissionState;
  plan: Plan | undefined;
  resources: ReviewedResource[];
  meta: { updatedAt: string } | undefined;
  receipt: { planId: string; version: number } | undefined;
}
/** All conflict checks and writes share one IndexedDB read/write transaction. */
async function withRecords<T>(
  opportunityId: string,
  write: boolean,
  action: (records: Records, store: IDBObjectStore) => T,
  operationId?: string,
): Promise<T> {
  await initializeStore();
  return transaction<T>(write ? "readwrite" : "readonly", (store, finish, fail) => {
    const keys = [
      "nextstep.profile",
      `opportunity:${opportunityId}`,
      `submission:${opportunityId}`,
      `plan:${opportunityId}`,
      "resources",
      `receipt:${operationId ?? "none"}`,
    ];
    const values: unknown[] = [];
    let left = keys.length;
    keys.forEach((key, index) => {
      const request = store.get(key);
      request.onsuccess = () => {
        values[index] = request.result;
        if (--left === 0) {
          const run = (meta: Records["meta"]) => {
            try {
              if (!values[1])
                throw new Error(
                  "This opportunity is unavailable. Return to Discover to select one.",
                );
              finish(
                action(
                  {
                    editor: (values[0] as UserProfile) ?? DEFAULT_PROFILE,
                    opportunity: values[1] as Opportunity,
                    submission: (values[2] as SubmissionState) ?? emptySubmission(opportunityId),
                    plan: values[3] as Plan | undefined,
                    resources: (values[4] as ReviewedResource[]) ?? [],
                    meta,
                    receipt: values[5] as Records["receipt"],
                  },
                  store,
                ),
              );
            } catch (error) {
              fail(error instanceof Error ? error : new Error("Storage failed."));
            }
          };
          if (values[3]) {
            const metaRequest = store.get(`plan-meta:${(values[3] as Plan).id}`);
            metaRequest.onsuccess = () => run(metaRequest.result as Records["meta"]);
          } else run(undefined);
        }
      };
    });
  });
}
const current = (records: Records) =>
  assessmentContext(records.opportunity, toStudentProfile(records.editor), records.submission);
function assertContext(records: Records, expected: AssessmentContext) {
  if (!sameContext(current(records), expected))
    throw new Error(
      "Context changed. Your confirmed plan is preserved. Reload the current facts and generate a new preview.",
    );
}
function commit(store: IDBObjectStore, plan: Plan) {
  if (!validatePlan(plan)) throw new Error("The plan update was invalid. Nothing was saved.");
  store.put(plan, `plan:${plan.context.opportunityId}`);
  const progress: ProgressState = {
    planId: plan.id,
    confirmedPlanVersion: plan.version,
    saveState: "confirmed",
  };
  store.put(progress, `progress:${plan.id}`);
  store.put({ updatedAt: new Date().toISOString() }, `plan-meta:${plan.id}`);
}
function localPlanDisplay(plan: Plan): Plan {
  return {
    ...plan,
    goals: plan.goals.map((goal, index) => ({ ...goal, statement: `Saved goal ${index + 1}` })),
    tasks: plan.tasks.map((task, index) => ({
      ...task,
      title: `Historical task ${index + 1}`,
      deliverable: "The earlier description has not been verified.",
      completionCriteria: "Review this task before relying on its description.",
    })),
    warnings: [
      "Local plan: earlier descriptions have not been verified. Review this history before relying on it; saved progress is unchanged.",
      "Task progress does not establish eligibility or submission evidence.",
    ],
  };
}
export const preparationRepository = {
  /** Explicit demo action. Never replaces a plan or changes the student's profile. */
  async loadSamplePlan(): Promise<Plan> {
    for (const opportunityId of [
      "aurora-ai",
      "tidewater-climate",
      "pulse-health",
      "ledger-fintech",
      "orbit-games",
    ]) {
      const result = await withRecords(opportunityId, true, (records, store) => {
        if (records.plan) return null;
        const goal = {
          id: "demo-prototype-goal",
          statement: "Demo goal: prepare a small hackathon prototype and walkthrough.",
        };
        const examples = [
          {
            title: "Shape the project idea",
            deliverable:
              "A one-page outline of the problem, intended users, and a small prototype scope.",
            completionCriteria:
              "The outline identifies one problem and one feature to demonstrate.",
            estimatedHours: 1,
            status: "done" as const,
          },
          {
            title: "Build one working interaction",
            deliverable:
              "A small prototype demonstrating the main interaction with fictional data.",
            completionCriteria:
              "The main interaction can be demonstrated from start to finish; limitations are listed.",
            estimatedHours: 3,
            status: "in_progress" as const,
          },
          {
            title: "Check the submission questions",
            deliverable:
              "A checklist separating confirmed submission information from questions for the organizer.",
            completionCriteria:
              "Unknown items are explicitly marked; no unpublished requirement is assumed.",
            estimatedHours: 1,
            status: "not_started" as const,
          },
          {
            title: "Rehearse a short project walkthrough",
            deliverable:
              "A short demo outline explaining the problem, prototype, and personal contribution.",
            completionCriteria:
              "The walkthrough describes only implemented work and clearly identifies incomplete parts.",
            estimatedHours: 2,
            status: "not_started" as const,
          },
        ];
        const tasks: Plan["tasks"] = examples.map((example, index) => ({
          ...example,
          id: crypto.randomUUID(),
          target: { kind: "goal", goalId: goal.id },
          priority: index === 3 ? "could" : "should",
          remainingEstimatedHours:
            example.status === "done"
              ? 0
              : example.status === "in_progress"
                ? 2
                : example.estimatedHours,
          resourceIds: [],
          artifactUrls: [],
        }));
        const profile = toStudentProfile(records.editor);
        const plan: Plan = {
          id: `sample-${crypto.randomUUID()}`,
          version: 1,
          context: current(records),
          goals: [goal],
          tasks,
          taskOrder: tasks.map((task) => task.id),
          ...budgetFor(
            tasks,
            profile.availableHoursPerWeek.state === "known"
              ? profile.availableHoursPerWeek.value
              : null,
            null,
          ),
          warnings: [
            "Fictional sample plan loaded for visual exploration. Its goal and progress are sample data, not statements about your experience. No organizer requirements or reviewed resources are invented.",
          ],
        };
        commit(store, plan);
        return localPlanDisplay(plan);
      });
      if (result) return result;
    }
    throw new Error(
      "All demo events already have plans. Continue an existing plan; nothing was replaced.",
    );
  },
  async load(opportunityId: string): Promise<PreparationBundle> {
    return withRecords(opportunityId, false, (records) => {
      if (records.plan && !validatePlan(records.plan))
        throw new Error(
          "Stored plan needs recovery. Export your backup or reset demo storage in Storage & recovery.",
        );
      const profile = toStudentProfile(records.editor);
      return {
        opportunity: records.opportunity,
        profile,
        submission: records.submission,
        context: current(records),
        resources: records.resources,
        plan: records.plan ? localPlanDisplay(records.plan) : null,
        updatedAt: records.meta?.updatedAt ?? null,
      };
    });
  },
  async list(): Promise<PreparationBundle[]> {
    await initializeStore();
    const ids = await transaction<string[]>("readonly", (store, finish) => {
      const result: string[] = [];
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (String(cursor.key).startsWith("plan:")) result.push(String(cursor.key).slice(5));
          cursor.continue();
        } else finish(result);
      };
    });
    return Promise.all(ids.map((id) => preparationRepository.load(id)));
  },
  async accept(input: {
    opportunityId: string;
    context: AssessmentContext;
    candidate: PlanCandidateOutput;
    goalIds: string[];
    baseVersion: number | null;
    operationId: string;
    fail?: boolean;
  }): Promise<Plan> {
    if (input.fail)
      throw new Error("Demo storage failure. Your candidate is still here. Retry acceptance.");
    return withRecords(
      input.opportunityId,
      true,
      (records, store) => {
        if (records.receipt && records.plan?.id === records.receipt.planId)
          return localPlanDisplay(records.plan);
        assertContext(records, input.context);
        if ((records.plan?.version ?? null) !== input.baseVersion) {
          if (records.plan && records.plan.id === `plan-${input.operationId}`)
            return localPlanDisplay(records.plan);
          throw new Error(
            "Plan version changed in another tab. Keep the confirmed plan and generate a new candidate.",
          );
        }
        const profile = toStudentProfile(records.editor);
        if (confirmedBlocker(records.opportunity, profile))
          throw new Error(
            "A confirmed participation condition is not met. Preparation cannot bypass it.",
          );
        const goals = profile.goals.filter((g) => input.goalIds.includes(g.id));
        if (goals.length !== new Set(input.goalIds).size)
          throw new Error("An accepted goal changed. Generate a fresh draft.");
        const output = validateCandidate(
          input.candidate,
          { ...profile, goals },
          records.opportunity,
          records.resources,
        );
        const deadline = reliableDeadline(records.opportunity);
        if (deadline && Date.parse(deadline) <= Date.now())
          throw new Error(
            "The confirmed submission window has closed. A prospective submission plan cannot be accepted.",
          );
        if (
          profile.availableHoursPerWeek.state === "known" &&
          profile.availableHoursPerWeek.value === 0 &&
          output.tasks.length
        )
          throw new Error("Zero preparation hours cannot support positive-workload tasks.");
        const retained =
          records.plan?.tasks.filter((t) => t.status !== "not_started" || t.artifactUrls.length) ??
          [];
        const tasks = [
          ...structuredClone(retained),
          ...output.tasks.map((task) => ({
            ...task,
            id: crypto.randomUUID(),
            remainingEstimatedHours: task.estimatedHours,
            status: "not_started" as const,
            artifactUrls: [],
          })),
        ];
        const allGoals = [...goals];
        for (const goal of records.plan?.goals ?? []) {
          if (!allGoals.some((g) => g.id === goal.id)) allGoals.push(goal);
        }
        const plan: Plan = {
          id: records.plan?.id ?? `plan-${input.operationId}`,
          version: (records.plan?.version ?? 0) + 1,
          context: input.context,
          goals: allGoals,
          tasks,
          taskOrder: tasks.map((t) => t.id),
          ...budgetFor(
            tasks,
            profile.availableHoursPerWeek.state === "known"
              ? profile.availableHoursPerWeek.value
              : null,
            deadline,
          ),
          warnings: [
            output.explanation,
            ...(!deadline ? ["Submission deadline is not confirmed; guidance is untimed."] : []),
            ...(retained.length
              ? ["Started/completed work and tasks with artifact links are retained unchanged."]
              : []),
          ],
        };
        if (records.plan) {
          const previousPlan = records.plan;
          const key = `historical-plan-backup:${input.opportunityId}`;
          const backup = store.get(key);
          backup.onsuccess = () => {
            if (backup.result === undefined) store.put(previousPlan, key);
          };
        }
        commit(store, plan);
        store.put({ planId: plan.id, version: plan.version }, `receipt:${input.operationId}`);
        return localPlanDisplay(plan);
      },
      input.operationId,
    );
  },
  async progress(input: {
    opportunityId: string;
    planId: string;
    baseVersion: number;
    taskId: string;
    status: TaskStatus;
    operationId: string;
    artifactUrls?: string[];
    fail?: boolean;
  }): Promise<Plan> {
    if (input.fail) throw new Error("Progress not saved. Your requested change is kept for Retry.");
    await initializeStore();
    return transaction<Plan>("readwrite", (store, finish, fail) => {
      const receipt = store.get(`receipt:${input.operationId}`);
      receipt.onsuccess = () => {
        const request = store.get(`plan:${input.opportunityId}`);
        request.onsuccess = () => {
          try {
            const plan = request.result as Plan | undefined;
            if (!plan || plan.id !== input.planId || !validatePlan(plan))
              throw new Error(
                "This confirmed plan is unavailable. Reload before changing progress.",
              );
            if (receipt.result) {
              finish(localPlanDisplay(plan));
              return;
            }
            if (plan.version !== input.baseVersion)
              throw new Error(
                "Plan version changed in another tab. Your requested status is not saved. Review the current plan, then retry deliberately.",
              );
            if (
              !["not_started", "in_progress", "done"].includes(input.status) ||
              !plan.tasks.some((t) => t.id === input.taskId)
            )
              throw new Error("Invalid task update.");
            const artifacts = input.artifactUrls;
            if (
              artifacts &&
              (artifacts.length > 8 ||
                artifacts.some((url) => {
                  try {
                    const value = new URL(url);
                    return !["https:", "http:"].includes(value.protocol) || url.length > 2000;
                  } catch {
                    return true;
                  }
                }))
            )
              throw new Error("Use complete http:// or https:// artifact URLs, one per line.");
            const tasks = plan.tasks.map((task) =>
              task.id !== input.taskId
                ? task
                : {
                    ...task,
                    status: input.status,
                    remainingEstimatedHours:
                      input.status === "done"
                        ? 0
                        : task.remainingEstimatedHours || task.estimatedHours,
                    ...(artifacts ? { artifactUrls: artifacts } : {}),
                  },
            );
            const next: Plan = {
              ...plan,
              version: plan.version + 1,
              tasks,
              ...budgetFor(tasks, plan.budget.hoursPerWeek, plan.budget.deadlineInstant),
            };
            commit(store, next);
            store.put({ planId: plan.id, version: next.version }, `receipt:${input.operationId}`);
            finish(localPlanDisplay(next));
          } catch (error) {
            fail(error instanceof Error ? error : new Error("Progress was not saved."));
          }
        };
      };
    });
  },
  async adjust(
    opportunityId: string,
    preview: PlanAdjustmentPreview,
    failPreview = false,
  ): Promise<Plan> {
    if (failPreview)
      throw new Error("Adjustment could not be saved. Your previous confirmed plan is intact.");
    return withRecords(opportunityId, true, (records, store) => {
      const plan = records.plan;
      assertContext(records, preview.context);
      if (!plan || plan.id !== preview.originalPlanId || plan.version !== preview.baseVersion)
        throw new Error(
          "Adjustment version conflict. Generate a new preview from the current plan.",
        );
      const unfinished = plan.taskOrder.filter(
        (id) => plan.tasks.find((t) => t.id === id)!.status !== "done",
      );
      const completed = plan.taskOrder.filter((id) => !unfinished.includes(id));
      if (
        JSON.stringify(unfinished) !== JSON.stringify(preview.unfinishedTaskOrder) ||
        JSON.stringify(completed) !== JSON.stringify(preview.preservedCompletedTaskIds) ||
        preview.proposedChanges.some(
          (c) =>
            !unfinished.includes(c.taskId) ||
            !Number.isFinite(c.proposedRemainingEstimatedHours) ||
            c.proposedRemainingEstimatedHours <= 0 ||
            c.proposedRemainingEstimatedHours >
              plan.tasks.find((t) => t.id === c.taskId)!.estimatedHours,
        ) ||
        new Set(preview.proposedChanges.map((c) => c.taskId)).size !==
          preview.proposedChanges.length
      )
        throw new Error("Adjustment context or unfinished work changed. Request a new preview.");
      const tasks = plan.tasks.map((task) => {
        const change = preview.proposedChanges.find((c) => c.taskId === task.id);
        return change
          ? { ...task, remainingEstimatedHours: change.proposedRemainingEstimatedHours }
          : task;
      });
      const profile = toStudentProfile(records.editor);
      const next: Plan = {
        ...plan,
        version: plan.version + 1,
        context: preview.context,
        tasks,
        ...budgetFor(
          tasks,
          profile.availableHoursPerWeek.state === "known"
            ? profile.availableHoursPerWeek.value
            : null,
          reliableDeadline(records.opportunity),
        ),
      };
      commit(store, next);
      return localPlanDisplay(next);
    });
  },
};
