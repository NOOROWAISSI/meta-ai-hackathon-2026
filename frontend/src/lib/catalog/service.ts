import { z } from "zod";
import { isContractInstant } from "../contract/time";
import type { Opportunity } from "@/lib/contract/types";

const listingSchema = z.object({
  id: z.string(),
  kind: z.enum(["hackathon", "course", "competition", "workshop"]),
  title: z.string(),
  organizer: z.string(),
  format: z.enum(["online", "in_person", "hybrid", "unknown"]),
  officialUrl: z.string().url(),
  summary: z.string(),
  topics: z.array(z.string()),
  scope: z.enum(["palestine", "global_online"]),
  registrationDeadline: z.string().refine(isContractInstant).nullable(),
  registrationState: z.enum(["open", "closed", "not_specified"]),
  costStatus: z.enum(["free", "paid", "unknown"]),
  lastReviewedAt: z.string().refine(isContractInstant).nullable(),
  sourceStatus: z.enum(["reviewed", "needs_verification"]),
  sourcePassage: z.string().nullable(),
  verificationNote: z.string(),
  firstSeenAt: z.string().refine(isContractInstant).nullable().optional(),
  lastCheckedAt: z.string().refine(isContractInstant).nullable().optional(),
  sourcePageUrl: z.string().url().nullable().optional(),
  eventEndAt: z.string().refine(isContractInstant).nullable().optional(),
  availabilityState: z.enum(["unknown", "ended", "cancelled"]).optional(),
  sourceFreshness: z.enum(["not_checked", "current", "stale"]).optional(),
});
/** Discovery-only extension; courses never inherit hackathon eligibility rules. */
export type ListingSummary = Pick<
  Opportunity,
  "id" | "title" | "organizer" | "format" | "officialUrl" | "costStatus" | "lastReviewedAt"
> &
  Omit<z.infer<typeof listingSchema>, keyof Opportunity>;
const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  region: z.enum(["palestine", "global_online", "mixed"]),
  channel: z.enum(["instagram", "official_website"]),
  collection: z.enum(["manual_review", "public_html"]),
  verificationUrl: z.string().url().nullable(),
  note: z.string(),
});
export type SourceRegistration = z.infer<typeof sourceSchema>;
async function get(path: string) {
  const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Real opportunities could not be loaded. Please retry.");
  return response.json() as Promise<unknown>;
}
export const realCatalogService = {
  async listings(): Promise<ListingSummary[]> {
    return z.array(listingSchema).parse(await get("/api/listings"));
  },
  async sources() {
    return z.array(sourceSchema).parse(await get("/api/sources"));
  },
  async collectionStatus() {
    return z
      .object({
        enabled: z.boolean(),
        intervalHours: z.number().int().positive(),
        lastAttemptAt: z.string().refine(isContractInstant).nullable(),
        pendingReviewCount: z.number().int().nonnegative(),
        automaticallyDiscoveredCount: z.number().int().nonnegative(),
        sources: z
          .array(
            z.object({
              sourceId: z.string(),
              lastAttemptAt: z.string().refine(isContractInstant),
              outcome: z.string(),
              candidateCount: z.number().int().nonnegative(),
            }),
          )
          .optional(),
      })
      .parse(await get("/api/sources/status"));
  },
};
