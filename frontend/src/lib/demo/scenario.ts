import type {
  Opportunity,
  Plan,
  PreparationTask,
  ProgressState,
  SubmissionState,
} from "../contract/types";
import { DEFAULT_PROFILE } from "../discover/demo-data";
import type { UserProfile } from "../discover/types";
import { assessmentContext, toStudentProfile } from "../preparation/adapters";
import { budgetFor, validatePlan } from "../preparation/logic";
import { initializeStore, transaction } from "../storage/database";

export const SCENARIO_KEY = "demo-scenario-backup";
interface Backup {
  entries: [IDBValidKey, unknown][];
  loadedAt: string;
}

/** Explicit, reversible synthetic scenario; never labels fixture sources as reviewed. */
export async function loadFullDemo() {
  await initializeStore();
  return transaction<void>("readwrite", (store, finish, fail) => {
    const entries: [IDBValidKey, unknown][] = [];
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      if (cursor.result) {
        entries.push([cursor.result.key, cursor.result.value]);
        cursor.result.continue();
        return;
      }
      try {
        if (entries.some(([key]) => key === SCENARIO_KEY)) {
          finish();
          return;
        }
        const records = new Map(entries);
        const at = new Date().toISOString();
        const original =
          (records.get("nextstep.profile") as UserProfile | undefined) ?? DEFAULT_PROFILE;
        const profile: UserProfile = {
          displayName: "Alex Morgan (Demo)",
          version: (original.version ?? 0) + 1,
          educationStatus: "university",
          fieldOfStudy: "Computer Science",
          studyLevel: "Third year",
          residence: "Prefer not to specify",
          interests: ["AI", "Web", "Data", "APIs"],
          skills: ["React", "TypeScript", "Python", "APIs", "Design"],
          skillNotes: {
            React: "Built the interface of a student project.",
            Python: "Used Python to clean a small practice dataset.",
            APIs: "Connected a project interface to mock API responses.",
          },
          goals: [
            "Prepare a campus assistant prototype and explain my personal contribution.",
            "Practice a student budgeting interface and walkthrough.",
            "Explore climate data and prepare a small visualization.",
          ],
          goalChoice: "prepare",
          goalDescription:
            "Prepare a campus assistant prototype and explain my personal contribution.",
          experience:
            "Fictional demo student: built small web projects with classmates and practiced Python data processing.",
          preferredFormat: "online",
          weeklyHours: 6,
          learningBudget: "free",
          learningLanguage: "English",
          entrantType: "solo",
          teamSize: null,
          constraints:
            "Demo preference: laptop only; check any equipment and team requirements with the organizer.",
          projects: [
            {
              id: "demo-campus",
              title: "Campus Companion",
              description: "Fictional student dashboard for campus activities.",
              contribution: "Designed the React screens and connected them to mock event data.",
              technologies: ["React", "TypeScript", "Tailwind CSS"],
              url: "",
            },
            {
              id: "demo-data",
              title: "Study Data Explorer",
              description: "Fictional practice dashboard for a small synthetic dataset.",
              contribution: "Cleaned the sample data in Python and prepared simple charts.",
              technologies: ["Python", "Data visualization"],
              url: "",
            },
          ],
          savedAt: at,
        };
        const canonical = toStudentProfile(profile);
        store.put({ entries, loadedAt: at } satisfies Backup, SCENARIO_KEY);
        // The original store is recoverable as one snapshot; no competing persistence is created.
        for (const [key] of entries) {
          if (typeof key === "string" && /^(plan:|plan-meta:|progress:|receipt:)/.test(key))
            store.delete(key);
        }
        store.put(profile, "nextstep.profile");
        store.put(["aurora-ai", "tidewater-climate", "ledger-fintech"], "nextstep.saved");
        for (const [index, opportunityId] of [
          "aurora-ai",
          "ledger-fintech",
          "tidewater-climate",
        ].entries()) {
          const opportunity = records.get(`opportunity:${opportunityId}`) as Opportunity;
          const submission = records.get(`submission:${opportunityId}`) as SubmissionState;
          if (!opportunity || !submission)
            throw new Error(
              "The fictional event records are unavailable. No demo data was changed.",
            );
          const goal = canonical.goals[index]!;
          const titles =
            index === 1
              ? [
                  "Sketch the budgeting interface",
                  "Build a mock transaction flow",
                  "Prepare the demo walkthrough",
                ]
              : index === 2
                ? ["Explore the synthetic climate data", "Sketch a data visualization"]
                : [
                    "Define the campus problem",
                    "Build the assistant interface",
                    "Check the submission questions",
                    "Rehearse the project walkthrough",
                  ];
          const tasks: PreparationTask[] = titles.map((title, taskIndex) => {
            const status =
              index === 1 || (index === 0 && taskIndex === 0)
                ? "done"
                : index === 0 && taskIndex === 1
                  ? "in_progress"
                  : "not_started";
            const estimatedHours = [1, 3, 1, 2][taskIndex] ?? 2;
            return {
              id: `demo-${opportunityId}-${taskIndex}`,
              title,
              target: { kind: "goal", goalId: goal.id },
              priority: taskIndex === titles.length - 1 ? "could" : "should",
              deliverable: `A small, clearly labelled practice artifact: ${title.toLowerCase()}.`,
              completionCriteria:
                "The practice artifact can be demonstrated, personal contributions are described, and unfinished or unknown items are listed explicitly.",
              estimatedHours,
              remainingEstimatedHours:
                status === "done" ? 0 : status === "in_progress" ? 2 : estimatedHours,
              status,
              resourceIds: [],
              artifactUrls: [],
            };
          });
          const plan: Plan = {
            id: `demo-plan-${opportunityId}`,
            version: 1,
            context: assessmentContext(opportunity, canonical, submission),
            goals: [goal],
            tasks,
            taskOrder: tasks.map((task) => task.id),
            ...budgetFor(tasks, profile.weeklyHours, null),
            warnings: [
              "Full fictional demo: profile, projects, goals, and task progress are sample data. This does not establish eligibility or submission compliance.",
              "Submission timing is not reliably confirmed; no submission schedule is promised.",
            ],
          };
          if (!validatePlan(plan))
            throw new Error("The sample plan failed validation. Existing data is preserved.");
          store.put(plan, `plan:${opportunityId}`);
          store.put(
            {
              planId: plan.id,
              confirmedPlanVersion: plan.version,
              saveState: "confirmed",
            } satisfies ProgressState,
            `progress:${plan.id}`,
          );
          store.put({ updatedAt: at }, `plan-meta:${plan.id}`);
        }
        finish();
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Demo setup failed."));
      }
    };
  });
}

export async function restoreBeforeDemo() {
  await initializeStore();
  return transaction<void>("readwrite", (store, finish, fail) => {
    const request = store.get(SCENARIO_KEY);
    request.onsuccess = () => {
      try {
        const backup = request.result as Backup | undefined;
        if (!backup) {
          finish();
          return;
        }
        if (!Array.isArray(backup.entries))
          throw new Error("The original-data backup is unavailable. Nothing was changed.");
        store.clear();
        for (const [key, value] of backup.entries) store.put(value, key);
        finish();
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Restore failed."));
      }
    };
  });
}
