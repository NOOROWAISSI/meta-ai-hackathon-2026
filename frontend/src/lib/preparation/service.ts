import type {
  ApiError,
  Opportunity,
  PlanAdjustmentPreview,
  PlanCandidateOutput,
  PlanCandidateRequest,
  ReviewedResource,
} from "../contract/types";
import {
  confirmedBlocker,
  currentResource,
  reliableDeadline,
  validateCandidate,
  type PreparationBundle,
} from "./logic";

export type GenerationMode = "normal" | "timeout" | "failure" | "invalid-output" | "no-gap";
export class PreparationError extends Error implements ApiError {
  requestId = crypto.randomUUID();
  constructor(
    public code: ApiError["code"],
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "PreparationError";
  }
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Replace with an ASP.NET Core adapter. No browser provider SDK, credential, or live-model claim. */
export interface PreparationService {
  generate(
    request: PlanCandidateRequest,
    opportunity: Opportunity,
    resources: ReviewedResource[],
    mode?: GenerationMode,
  ): Promise<PlanCandidateOutput>;
  adjustment(bundle: PreparationBundle, fail?: boolean): Promise<PlanAdjustmentPreview>;
}
export const mockPreparationService: PreparationService = {
  async generate(request, opportunity, resources, mode = "normal") {
    if (confirmedBlocker(opportunity, request.profile))
      throw new PreparationError(
        "invalid_input",
        "A confirmed participation blocker cannot be bypassed by preparation.",
        false,
      );
    const deadline = reliableDeadline(opportunity);
    if (deadline && Date.parse(deadline) <= Date.now())
      throw new PreparationError(
        "invalid_input",
        "The confirmed submission window is closed.",
        false,
      );
    await wait(mode === "timeout" ? 1000 : 650);
    if (mode === "timeout")
      throw new PreparationError(
        "timeout",
        "Demo generation timed out. Your inputs are kept. Retry when ready.",
        true,
      );
    if (mode === "failure")
      throw new PreparationError(
        "provider_unavailable",
        "Demo generator is unavailable. Nothing has been accepted. Retry when ready.",
        true,
      );
    if (request.expectedSourceRevision !== opportunity.sourceRevision)
      throw new PreparationError(
        "version_conflict",
        "Source context changed. Reload before generating.",
        false,
      );
    if (
      request.profile.availableHoursPerWeek.state === "known" &&
      request.profile.availableHoursPerWeek.value === 0
    )
      throw new PreparationError(
        "invalid_input",
        "No preparation capacity is reported. Keep zero or update your hours before planning positive work.",
        false,
      );
    const tasks: PlanCandidateOutput["tasks"] = [];
    const previous = request.previousPlan;
    if (
      mode === "normal" &&
      previous &&
      request.profile.goals.every((goal) =>
        previous.goals.some((accepted) => accepted.id === goal.id),
      ) &&
      previous.context.opportunityId === opportunity.id &&
      previous.context.sourceRevision === opportunity.sourceRevision &&
      previous.context.profileId === request.profile.id &&
      previous.context.profileVersion === request.profile.version &&
      previous.context.submissionVersion === request.submission.version
    ) {
      const selectedGoals = new Set(request.profile.goals.map((goal) => goal.id));
      const unfinished = previous.taskOrder
        .map((id) => previous.tasks.find((task) => task.id === id)!)
        .filter(
          (task) =>
            task.status === "not_started" &&
            !task.artifactUrls.length &&
            (task.target.kind === "requirement" || selectedGoals.has(task.target.goalId)),
        );
      const output: PlanCandidateOutput = {
        tasks: unfinished.slice(0, 6).map((task) => ({
          title: task.title,
          target: task.target,
          priority: task.priority,
          deliverable: task.deliverable,
          completionCriteria: task.completionCriteria,
          estimatedHours: task.remainingEstimatedHours,
          resourceIds: task.resourceIds.filter((id) =>
            resources.some((resource) => resource.id === id && currentResource(resource)),
          ),
        })),
        explanation: unfinished.length
          ? "The current accepted plan already addresses these goals. This preview keeps the unstarted work; started/completed tasks and artifacts are retained by the application. No duplicate tasks have been padded."
          : "No new tasks are proposed for these accepted goals. Existing started/completed work is retained, and no additional gap is specified by the available facts. This is not an eligibility or submission-compliance verdict.",
      };
      return validateCandidate(output, request.profile, opportunity, resources);
    }
    for (const goal of request.profile.goals.slice(0, 3)) {
      const generic =
        /^(prepare for an upcoming opportunity|find an opportunity i can pursue now)/i.test(
          goal.statement,
        );
      tasks.push({
        title: generic
          ? "Collect the open event questions"
          : `Outline your next step: ${goal.statement.slice(0, 240)}${goal.statement.length > 240 ? "…" : ""}`,
        target: { kind: "goal", goalId: goal.id },
        priority: "should",
        deliverable: generic
          ? "A dated note of participation conditions, submission items, and timing that still need verification."
          : "A short outline identifying the intended outcome, one small next action, and the open questions.",
        completionCriteria: generic
          ? "Each open question is answered with a source or explicitly remains unknown. This task does not establish eligibility."
          : "Your outline states what you want to achieve and separates confirmed facts from unanswered questions.",
        estimatedHours: 1,
        resourceIds: [],
      });
    }
    const practiceGoal =
      request.profile.goals.find((goal) =>
        /prototype|project|build|walkthrough/i.test(goal.statement),
      ) ?? request.profile.goals.find((goal) => /prepare/i.test(goal.statement));
    if (
      practiceGoal &&
      request.profile.goals.slice(0, 3).some((goal) => goal.id === practiceGoal.id)
    )
      tasks.push({
        title: "Prepare a small example and walkthrough",
        target: { kind: "goal", goalId: practiceGoal.id },
        priority: "could",
        deliverable: "A small practice example or walkthrough draft relevant to your stated goal.",
        completionCriteria:
          "Explain the main idea, demonstrate your own contribution, and name what still needs work.",
        estimatedHours: 2,
        resourceIds: [],
      });
    const raw: unknown =
      mode === "invalid-output"
        ? {
            tasks: [{ title: "Invalid demo", id: "model-generated-id", estimatedHours: -1 }],
            explanation: "Invalid-output simulation.",
          }
        : {
            tasks: mode === "no-gap" ? [] : tasks,
            explanation:
              mode === "no-gap"
                ? "State preview: no remaining preparation gap is identified in this simulated candidate. This is not an eligibility or submission verdict."
                : tasks.length
                  ? "Mock template based only on your confirmed goals. Resource lists are empty because no current reviewed catalog entries are available. No deadline or organizer condition has been invented."
                  : "No accepted preparation goals are available. Add a goal or skip planning for now; no tasks have been padded.",
          };
    return validateCandidate(raw, request.profile, opportunity, resources);
  },
  async adjustment(bundle, fail = false) {
    await wait(500);
    if (fail) throw new Error("Demo adjustment failed. Your last confirmed plan is unchanged.");
    const plan = bundle.plan;
    if (!plan) throw new Error("No confirmed plan to adjust.");
    const unfinished = plan.taskOrder.filter(
      (id) => plan.tasks.find((t) => t.id === id)!.status !== "done",
    );
    return {
      originalPlanId: plan.id,
      baseVersion: plan.version,
      context: bundle.context,
      unfinishedTaskOrder: unfinished,
      proposedChanges: [],
      preservedCompletedTaskIds: plan.taskOrder.filter((id) => !unfinished.includes(id)),
      explanation:
        "Conservative demo review: no justified estimate change can be inferred from the available facts. Unfinished work is retained; accepting refreshes its context and time assessment. Completed work and artifact links stay unchanged.",
    };
  },
};
export const preparationFeatures = {
  adjustment: import.meta.env["VITE_ENABLE_PLAN_ADJUSTMENT"] === "true",
  artifacts: import.meta.env["VITE_ENABLE_TASK_ARTIFACTS"] === "true",
};
