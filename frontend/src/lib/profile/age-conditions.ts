import type { Opportunity } from "@/lib/contract/types";
import { isContractInstant } from "@/lib/contract/time";
export interface AgeConditions {
  minimumAge: boolean;
  majority: boolean;
  sources: Array<{ statement: string; url: string }>;
}
export function ageConditions(event?: Opportunity): AgeConditions | undefined {
  if (!event || event.informationFreshness === "stale") return;
  const rules = event.requirements.filter(
    (rule) =>
      rule.lane === "participation" &&
      rule.sourceStatus === "reviewed" &&
      ["minimum_age", "majority"].includes(rule.evaluation.key) &&
      rule.sourceEvidenceIds.length > 0 &&
      rule.sourceEvidenceIds.every((id) =>
        event.sourceEvidence.some(
          (e) =>
            e.id === id &&
            e.status === "reviewed" &&
            e.passage?.trim() &&
            isContractInstant(e.checkedAt),
        ),
      ),
  );
  if (!rules.length) return;
  return {
    minimumAge: rules.some((rule) => rule.evaluation.key === "minimum_age"),
    majority: rules.some((rule) => rule.evaluation.key === "majority"),
    sources: rules.map((rule) => ({
      statement: rule.statement,
      url: event.sourceEvidence.find((e) => e.id === rule.sourceEvidenceIds[0])!.sourceUrl,
    })),
  };
}
