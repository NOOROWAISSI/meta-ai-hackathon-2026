import type {
  AnalysisResult,
  Opportunity,
  OpportunityPreference,
  Plan,
  PlanCandidateOutput,
  ReviewedResource,
  StudentProfile,
  SubmissionState,
  TaskStatus,
} from "@/lib/contract/types";
export class AccountApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export function accountDataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("nextstep:account-data"));
}
export async function apiResponse(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "X-NextStep-Request": "1",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal:
      signal ??
      AbortSignal.timeout(method === "POST" && path.includes("plan-candidates") ? 90000 : 20000),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;
    if (response.status === 401) window.dispatchEvent(new Event("nextstep:session-expired"));
    throw new AccountApiError(
      error?.message ??
        "The account service could not complete this request. Your last confirmed data is preserved.",
      response.status,
      error?.code ?? "service_unavailable",
    );
  }
  return response;
}
export async function apiJson<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return (await apiResponse(path, method, body, signal)).json() as Promise<T>;
}
export interface ProfileEnvelope {
  profile: StudentProfile;
  editor: Partial<import("@/lib/discover/types").UserProfile>;
  displayName: string;
}
export type AccountPreference = OpportunityPreference & { savedAt: string | null };
export const accountApi = {
  profile: () => apiJson<StudentProfile>("/profile"),
  profileEditor: () => apiJson<ProfileEnvelope>("/profile/editor"),
  async saveEditor(
    previous: StudentProfile,
    profile: StudentProfile,
    editor: Partial<import("@/lib/discover/types").UserProfile>,
  ) {
    const result = await apiJson<ProfileEnvelope>("/profile/editor", "PUT", {
      expectedVersion: previous.version,
      profile,
      editor,
    });
    accountDataChanged();
    return result;
  },
  preferences: () => apiJson<AccountPreference[]>("/preferences/snapshot"),
  async preference(
    id: string,
    change: Partial<Pick<OpportunityPreference, "saved" | "notInterested">>,
    expectedAccountId: string,
  ) {
    const result = await apiJson<AccountPreference>(
      `/preferences/${encodeURIComponent(id)}`,
      "PATCH",
      { ...change, expectedAccountId },
    );
    accountDataChanged();
    return result;
  },
  opportunities: () => apiJson<Opportunity[]>("/opportunities"),
  opportunity: (id: string) => apiJson<Opportunity>(`/opportunities/${encodeURIComponent(id)}`),
  submission: (id: string) => apiJson<SubmissionState>(`/submissions/${encodeURIComponent(id)}`),
  resources: (id: string) =>
    apiJson<ReviewedResource[]>(`/opportunities/${encodeURIComponent(id)}/resources`),
  plans: () => apiJson<Plan[]>("/plans"),
  async generate(
    opportunity: Opportunity,
    profile: StudentProfile,
    submission: SubmissionState,
    previousPlan: Plan | null,
  ) {
    const response = await apiResponse(
      `/opportunities/${encodeURIComponent(opportunity.id)}/plan-candidates`,
      "POST",
      {
        expectedSourceRevision: opportunity.sourceRevision,
        profile,
        submission,
        ...(previousPlan ? { previousPlan } : {}),
      },
    );
    const candidateId = response.headers.get("X-Candidate-Id");
    if (!candidateId)
      throw new Error("The server did not return a candidate identifier. No plan was accepted.");
    return { candidateId, output: (await response.json()) as PlanCandidateOutput };
  },
  async accept(
    id: string,
    candidateId: string,
    expectedPlanVersion: number | null,
    operationId: string,
  ) {
    const result = await apiJson<Plan>(`/plans/${encodeURIComponent(id)}/accept`, "POST", {
      candidateId,
      expectedPlanVersion,
      operationId,
    });
    accountDataChanged();
    return result;
  },
  async progress(plan: Plan, taskId: string, status: TaskStatus, operationId: string) {
    const result = await apiJson<Plan>(
      `/plans/${encodeURIComponent(plan.context.opportunityId)}/tasks/${encodeURIComponent(taskId)}`,
      "PATCH",
      { expectedVersion: plan.version, status, operationId },
    );
    accountDataChanged();
    return result;
  },
  analyze: (opportunity: Opportunity, profile: StudentProfile, submission: SubmissionState) =>
    apiJson<AnalysisResult>(
      `/opportunities/${encodeURIComponent(opportunity.id)}/analysis`,
      "POST",
      { expectedSourceRevision: opportunity.sourceRevision, profile, submission },
    ),
  async discard(id: string) {
    await apiResponse(`/candidates/${encodeURIComponent(id)}`, "DELETE");
  },
};
