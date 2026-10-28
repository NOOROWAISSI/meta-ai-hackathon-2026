import { z } from "zod";
import type { StudentProfile, Recommendation } from "@/lib/contract/types";
import type { ListingSummary } from "./service";

export type AccountProfileFacts = Pick<
  StudentProfile,
  "id" | "version" | "background" | "interests" | "skills" | "goals" | "availableHoursPerWeek"
>;
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
  availableHoursPerWeek: z.discriminatedUnion("state", [
    z.object({
      state: z.literal("known"),
      value: z.number().finite().min(0).max(168),
      reportedAt: z.string(),
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
}
export interface MetaBriefingService {
  available: boolean;
  explain(
    input: { context: BriefingContext; listing: ListingSummary },
    signal: AbortSignal,
  ): Promise<MetaBriefing>;
}
// No guessed endpoint, browser Meta call, or template labelled as live AI.
export const metaBriefingService: MetaBriefingService = {
  available: false,
  async explain() {
    throw new Error("The Meta briefing adapter is awaiting backend integration.");
  },
};
export function briefingContext(
  item: ListingSummary,
  profile: AccountProfileFacts,
  language: "ar" | "en",
): BriefingContext {
  return {
    opportunityId: item.id,
    profileId: profile.id,
    profileVersion: profile.version,
    language,
    sourceRevision: JSON.stringify(item),
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
