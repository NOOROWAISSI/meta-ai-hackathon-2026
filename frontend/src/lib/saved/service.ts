import type { Hackathon, ParticipationMode, UserProfile } from "../discover/types";
import { DEFAULT_PROFILE } from "../discover/demo-data";
import { fetchHackathons } from "../discover/api";
import { initializeStore, transaction } from "../storage/database";
import { preparationRepository } from "../preparation/repository";
import type { AnalysisSnapshot } from "../details/types";
import { analysisContext } from "../details/logic";
import { buildEventDetails } from "../details/records";

export interface SavedSnapshot {
  ids: string[];
  savedAt: Record<string, string>;
  profile: UserProfile;
  catalog: Hackathon[];
  plannedIds: string[];
}
export interface RemovalReceipt {
  id: string;
  index: number;
  savedAt?: string;
}
export type SavedSort = "deadline" | "recent";
export type SavedFormat = "all" | ParticipationMode;

/** Replaceable browser service. No analysis/model request is made when Saved opens. */
export const savedService = {
  async load(): Promise<SavedSnapshot> {
    await initializeStore();
    const [records, catalog, plans] = await Promise.all([
      transaction<{ ids: string[]; savedAt: Record<string, string>; profile: UserProfile }>(
        "readonly",
        (store, finish) => {
          const ids = store.get("nextstep.saved");
          const times = store.get("nextstep.savedAt");
          const profile = store.get("nextstep.profile");
          let remaining = 3;
          const done = () => {
            if (--remaining === 0)
              finish({
                ids: ids.result ?? [],
                savedAt: times.result ?? {},
                profile: profile.result ?? DEFAULT_PROFILE,
              });
          };
          ids.onsuccess = done;
          times.onsuccess = done;
          profile.onsuccess = done;
        },
      ),
      fetchHackathons("normal"),
      preparationRepository.list(),
    ]);
    return {
      ...records,
      catalog,
      plannedIds: plans.filter((bundle) => !!bundle.plan).map((bundle) => bundle.opportunity.id),
    };
  },
  async remove(id: string): Promise<RemovalReceipt> {
    await initializeStore();
    return transaction<RemovalReceipt>("readwrite", (store, finish) => {
      const ids = store.get("nextstep.saved");
      const times = store.get("nextstep.savedAt");
      let left = 2;
      const apply = () => {
        if (--left) return;
        const current = (ids.result ?? []) as string[];
        const savedAt = (times.result as Record<string, string> | undefined)?.[id];
        store.put(
          current.filter((value) => value !== id),
          "nextstep.saved",
        );
        finish({ id, index: current.indexOf(id), ...(savedAt ? { savedAt } : {}) });
      };
      ids.onsuccess = apply;
      times.onsuccess = apply;
    });
  },
  async undo(receipt: RemovalReceipt): Promise<void> {
    await initializeStore();
    return transaction<void>("readwrite", (store, finish) => {
      const ids = store.get("nextstep.saved");
      const times = store.get("nextstep.savedAt");
      let left = 2;
      const apply = () => {
        if (--left) return;
        const current = [...((ids.result ?? []) as string[])];
        if (!current.includes(receipt.id) && receipt.index >= 0) {
          current.splice(Math.min(receipt.index, current.length), 0, receipt.id);
          store.put(current, "nextstep.saved");
          const timestamps = { ...((times.result ?? {}) as Record<string, string>) };
          if (receipt.savedAt) timestamps[receipt.id] = receipt.savedAt;
          else delete timestamps[receipt.id];
          store.put(timestamps, "nextstep.savedAt");
        }
        finish();
      };
      ids.onsuccess = apply;
      times.onsuccess = apply;
    });
  },
};

export function savedResults(
  snapshot: SavedSnapshot,
  query: string,
  format: SavedFormat,
  sort: SavedSort,
) {
  const term = query.trim().toLowerCase();
  const order = new Map(snapshot.ids.map((id, index) => [id, index]));
  const date = (value: string | null) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  const instant = (id: string) => {
    const value = snapshot.savedAt[id];
    return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  };
  return snapshot.catalog
    .filter(
      (event) =>
        order.has(event.id) &&
        (format === "all" || event.mode === format) &&
        (!term || `${event.title} ${event.organizer}`.toLowerCase().includes(term)),
    )
    .sort((a, b) => {
      if (sort === "deadline") {
        const first = date(a.registrationDeadline);
        const second = date(b.registrationDeadline);
        if (first !== second)
          return first === null ? 1 : second === null ? -1 : first.localeCompare(second);
      } else {
        const first = instant(a.id);
        const second = instant(b.id);
        if (first !== second) return first === null ? 1 : second === null ? -1 : second - first;
      }
      return (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0);
    });
}

/** Displays existing comparison results only; this is not a new eligibility evaluator. */
export function savedAnalysis(
  event: Hackathon,
  profile: UserProfile,
  snapshot: AnalysisSnapshot | null,
) {
  if (!snapshot) return null;
  const details = buildEventDetails(event.id);
  const outdated = !details || snapshot.context !== analysisContext(details, profile);
  const interestOverlap = profile.interests.some((interest) =>
    event.topics.some((topic) => topic.toLowerCase() === interest.toLowerCase()),
  );
  const skillOverlap = profile.skills.some((skill) =>
    event.relatedSkills.some((related) => related.toLowerCase() === skill.toLowerCase()),
  );
  const reason =
    !outdated && (interestOverlap || skillOverlap)
      ? snapshot.sections.find(
          (section) =>
            section.title === (interestOverlap ? "Interests & goals" : "Existing experience"),
        )?.text
      : undefined;
  const participation = snapshot.matches.filter(
    (match) => match.requirement.lane === "participation",
  );
  const counts = new Map<string, number>();
  for (const match of participation) counts.set(match.status, (counts.get(match.status) ?? 0) + 1);
  return {
    outdated,
    reason,
    status: participation.length
      ? [...counts].map(([status, count]) => `${count} ${status.toLowerCase()}`).join(" · ")
      : "No participation checks recorded",
  };
}
