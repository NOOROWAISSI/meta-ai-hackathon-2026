import { apiJson, accountDataChanged } from "@/lib/account/api";

export interface SourceReference {
  sourceId: string;
  chunkId: string;
  quote: string;
}
export interface ProfessionalSource {
  id: string;
  kind: "cv" | "linkedin" | "github";
  title: string;
  url: string | null;
  revision: string | null;
  importedAt: string;
  chunks: { id: string; locator: string; text: string }[];
  warnings: string[];
}
export interface ProposedFact {
  kind: "skill" | "project" | "experience" | "goal";
  value: string;
  basis: "source_statement" | "artifact_observation" | "inference";
  explanation: string;
  references: SourceReference[];
}
export interface EvidenceView {
  profileVersion: number;
  currentFacts?: {
    id: string;
    kind: string;
    value: string;
    contribution: string;
    references: SourceReference[];
    confirmedAt: string;
  }[];
  workspace: {
    version: number;
    sources: ProfessionalSource[];
    draft: {
      id: string;
      profileVersion: number;
      sourcesVersion: number;
      output: { facts: ProposedFact[]; questions: string[] };
    } | null;
    confirmed: {
      id: string;
      kind: string;
      value: string;
      contribution: string;
      references: SourceReference[];
      confirmedAt: string;
    }[];
  };
}
export interface InsightSection {
  title: string;
  explanation: string;
  evidenceIds: string[];
}
export interface InsightView {
  analysisVersion?: number;
  profileVersion: number;
  sourcesVersion: number;
  sourceRevision: string;
  language?: string;
  generatedAt?: string;
  outdated?: boolean;
  analysis: {
    recommendation?: {
      decision:
        "recommended" | "prepare_first" | "already_covered" | "not_aligned" | "needs_clarification";
      reason: string;
      benefit: string;
      nextStep: string;
      evidenceIds: string[];
    };
    summary: string;
    connections: InsightSection[];
    gaps: InsightSection[];
    questions: string[];
    preparationPriorities: string[];
  };
}
const base = "/profile/evidence";
export const evidenceService = {
  answer: async (
    id: string,
    view: EvidenceView,
    language: string,
    question: string,
    answer: string,
  ) => {
    const result = await apiJson<EvidenceView>(
      "/listings/" + encodeURIComponent(id) + "/comparison-answer",
      "POST",
      {
        profileVersion: view.profileVersion,
        sourcesVersion: view.workspace.version,
        language,
        question,
        answer,
      },
    );
    accountDataChanged();
    return result;
  },
  savedComparison: (id: string, language: string, signal?: AbortSignal) =>
    apiJson<InsightView | null>(
      "/listings/" +
        encodeURIComponent(id) +
        "/evidence-comparison?language=" +
        encodeURIComponent(language),
      "GET",
      undefined,
      signal,
    ),
  read: (signal?: AbortSignal) => apiJson<EvidenceView>(base, "GET", undefined, signal),
  mutate: async (path: string, body: unknown, method = "POST") => {
    const result = await apiJson<EvidenceView>(
      base + path,
      method,
      body,
      AbortSignal.timeout(100000),
    );
    accountDataChanged();
    return result;
  },
  upload: async (file: File, kind: string, profileVersion: number, sourcesVersion: number) => {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    body.set("profileVersion", String(profileVersion));
    body.set("sourcesVersion", String(sourcesVersion));
    const response = await fetch("/api" + base + "/upload", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-NextStep-Request": "1" },
      body,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(error?.message ?? "The upload failed. Your saved profile is unchanged.");
    }
    const result = (await response.json()) as EvidenceView;
    accountDataChanged();
    return result;
  },
  repositories: (account: string) =>
    apiJson<{ name: string; url: string; description: string }[]>(
      base + "/github?account=" + encodeURIComponent(account),
    ),
  compare: (id: string, view: EvidenceView, language: string) =>
    apiJson<InsightView>(
      "/listings/" + encodeURIComponent(id) + "/evidence-comparison",
      "POST",
      {
        profileVersion: view.profileVersion,
        sourcesVersion: view.workspace.version,
        consent: true,
        language,
      },
      AbortSignal.timeout(100000),
    ),
};

export function sourceLocation(source: ProfessionalSource | undefined, chunkId: string): string {
  return source?.chunks.find((c) => c.id === chunkId)?.locator ?? "Source removed";
}
