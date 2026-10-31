import { z } from "zod";
import { isContractInstant } from "../contract/time";
import type { StudentProfile, Recommendation } from "@/lib/contract/types";
import type { ListingSummary } from "./service";
import { apiJson, accountDataChanged } from "@/lib/account/api";

export type AccountProfileFacts = Pick<
  StudentProfile,
  "id" | "version" | "background" | "interests" | "skills" | "goals" | "availableHoursPerWeek"
> & { clarificationAnswers?: StudentProfile["clarificationAnswers"] };
const profileSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  background: z.string(),
  interests: z.array(z.string()),
  skills: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      state: z.enum(["reported_has", "reported_lacks", "unknown"]),
    }),
  ),
  goals: z.array(z.object({ id: z.string(), statement: z.string() })),
  clarificationAnswers: z
    .array(
      z.object({
        questionId: z.string(),
        answer: z.string(),
        answeredAt: z.string().refine(isContractInstant),
      }),
    )
    .default([]),
  availableHoursPerWeek: z.discriminatedUnion("state", [
    z.object({
      state: z.literal("known"),
      value: z.number().finite().min(0).max(168),
      reportedAt: z.string().refine(isContractInstant),
    }),
    z.object({ state: z.literal("unknown"), reason: z.string().optional() }),
  ]),
});
export async function loadAccountProfile(signal?: AbortSignal): Promise<AccountProfileFacts> {
  const response = await fetch("/api/profile", {
    credentials: "same-origin",
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error("The saved account profile could not be loaded.");
  const profile = profileSchema.parse(await response.json());
  const hours = profile.availableHoursPerWeek;
  return {
    ...profile,
    availableHoursPerWeek:
      hours.state === "known"
        ? hours
        : { state: "unknown", ...(hours.reason !== undefined ? { reason: hours.reason } : {}) },
  };
}
export const matchedInterests = (item: ListingSummary, profile: AccountProfileFacts) =>
  profile.interests.filter((interest) =>
    item.topics.some((topic) => topic.trim().toLowerCase() === interest.trim().toLowerCase()),
  );

/** Proposed display-only boundary for Rofi; it does not replace eligibility/analysis DTOs. */
export interface BriefingContext extends Pick<
  Recommendation,
  "opportunityId" | "profileVersion" | "sourceRevision"
> {
  profileId: string;
  language: "ar" | "en";
}
export interface MetaBriefing {
  context: BriefingContext;
  overview: string;
  personalRelevance: string;
  preparationPriorities: string[];
  questionsToClarify: string[];
  sources?: Array<{ label: string; url: string }> | undefined;
  generatedAt?: string | undefined;
  startingPoint?: BriefingStartingPoint | null | undefined;
}
export interface BriefingStartingPoint {
  questionId: string;
  challenge: string;
  question: string;
  answer: "not_yet" | "guided" | "independent" | "not_sure" | null;
  label: string;
  explanation: string;
  nextAction: string;
  options: Array<{ value: "not_yet" | "guided" | "independent" | "not_sure"; label: string }>;
  evidence: Array<{ kind: string; label: string; text: string }>;
}
export async function saveBriefingStartingPoint(
  context: BriefingContext,
  questionId: string,
  answer: string,
) {
  const profile = await apiJson<StudentProfile>(
    `/listings/${encodeURIComponent(context.opportunityId)}/starting-point`,
    "PUT",
    { context, questionId, answer },
  );
  accountDataChanged();
  return profile;
}
export interface MetaBriefingService {
  available: boolean;
  explain(
    input: { context: BriefingContext; listing: ListingSummary },
    signal: AbortSignal,
  ): Promise<MetaBriefing>;
}
// Authenticated application endpoint; provider requests/credentials remain server-side.
export const metaBriefingService: MetaBriefingService = {
  available: true,
  async explain(input, signal) {
    return apiJson<MetaBriefing>(
      `/listings/${encodeURIComponent(input.context.opportunityId)}/briefing`,
      "POST",
      { context: input.context },
      signal,
    );
  },
};
export function briefingContext(
  item: ListingSummary,
  profile: AccountProfileFacts,
  language: "ar" | "en",
  planningSourceRevision: string | null = null,
): BriefingContext {
  return {
    opportunityId: item.id,
    profileId: profile.id,
    profileVersion: profile.version,
    language,
    sourceRevision: JSON.stringify({ listing: item, planningSourceRevision }),
  };
}
export function validateBriefing(input: unknown, expected: BriefingContext): MetaBriefing {
  const text = z.string().min(1).max(12000);
  const value = z
    .object({
      context: z
        .object({
          opportunityId: z.string(),
          profileId: z.string(),
          profileVersion: z.number().int(),
          sourceRevision: z.string(),
          language: z.enum(["ar", "en"]),
        })
        .strict(),
      overview: text,
      personalRelevance: text,
      preparationPriorities: z.array(text).max(20),
      questionsToClarify: z.array(text).max(20),
      sources: z
        .array(z.object({ label: z.string(), url: z.string().url() }))
        .max(30)
        .optional(),
      generatedAt: z.string().refine(isContractInstant).optional(),
      startingPoint: z
        .object({
          questionId: z.string(),
          challenge: text,
          question: text,
          answer: z.enum(["not_yet", "guided", "independent", "not_sure"]).nullable(),
          label: text,
          explanation: text,
          nextAction: text,
          options: z
            .array(
              z.object({
                value: z.enum(["not_yet", "guided", "independent", "not_sure"]),
                label: text,
              }),
            )
            .max(4),
          evidence: z.array(z.object({ kind: z.string(), label: text, text })).max(20),
        })
        .nullable()
        .optional(),
    })
    .strict()
    .parse(input);
  if (
    value.context.opportunityId !== expected.opportunityId ||
    value.context.profileId !== expected.profileId ||
    value.context.profileVersion !== expected.profileVersion ||
    value.context.sourceRevision !== expected.sourceRevision ||
    value.context.language !== expected.language
  )
    throw new Error("The explanation belongs to an older context. Please retry.");
  return value;
}
