import type { Filters, Hackathon, Recommendation, TimingChip, UserProfile } from "./types";

const DAY = 86_400_000;

export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso + "T23:59:59").getTime() - now.getTime()) / DAY);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Not published";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventDates(h: Hackathon): string {
  if (!h.eventStart) return "Dates not published";
  if (!h.eventEnd) return `${formatDate(h.eventStart)} · end TBC`;
  return `${formatDate(h.eventStart)} – ${formatDate(h.eventEnd)}`;
}

export function teamLabel(h: Hackathon): string | null {
  const t = h.team;
  if (!t) return null;
  if (t.kind === "solo") return "Solo only";
  const range = t.min && t.max ? `${t.min}–${t.max}` : t.max ? `up to ${t.max}` : "";
  if (t.kind === "team") return `Teams ${range}`.trim();
  return `Solo or teams ${range}`.trim();
}

export function isProfileComplete(p: UserProfile): boolean {
  return p.interests.length > 0 && p.skills.length > 0 && p.weeklyHours !== null;
}

/** "Pursue now" = registration closes within 45 days. "Later" = further out or unknown. */
export function timingOf(h: Hackathon, now = new Date()): "now" | "later" {
  const d = daysUntil(h.registrationDeadline, now);
  return d !== null && d >= 0 && d <= 45 ? "now" : "later";
}

export function matchesQuery(h: Hackathon, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [h.title, h.organizer, h.summary, ...h.topics].some((v) => v.toLowerCase().includes(s));
}

export function applyFilters(
  list: Hackathon[],
  f: Filters,
  query: string,
  timing: TimingChip,
  now = new Date(),
) {
  return list.filter((h) => {
    if (!matchesQuery(h, query)) return false;
    if (f.topics.length && !f.topics.some((t) => h.topics.includes(t))) return false;
    if (f.modes.length && !f.modes.includes(h.mode)) return false;
    if (f.deadline !== "any") {
      const d = daysUntil(h.registrationDeadline, now);
      if (d === null || d < 0 || d > Number(f.deadline)) return false;
    }
    if (f.participation !== "any") {
      if (!h.team) return false;
      if (f.participation === "solo" && h.team.kind === "team" && (h.team.min ?? 2) > 1)
        return false;
      if (f.participation === "team" && h.team.kind === "solo") return false;
    }
    if (timing && timingOf(h, now) !== timing) return false;
    return true;
  });
}

export function activeFilterCount(f: Filters): number {
  return (
    f.topics.length +
    f.modes.length +
    (f.deadline !== "any" ? 1 : 0) +
    (f.participation !== "any" ? 1 : 0)
  );
}

const ci = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Demo recommendation engine. Stands in for a server-side AI call; it only
 * measures topical relevance and never decides eligibility.
 */
export function recommend(list: Hackathon[], p: UserProfile): Recommendation[] {
  return list
    .map((h) => {
      const interests = p.interests.filter((i) => h.topics.some((t) => ci(t, i)));
      const skills = p.skills.filter((s) => h.relatedSkills.some((r) => ci(r, s)));
      const relevance = interests.length * 2 + skills.length;
      let reason = "";
      if (interests.length && skills.length) {
        reason = `Your interest in ${interests.join(" and ")} and experience with ${skills.join(" and ")} relate to this event's theme.`;
      } else if (interests.length) {
        reason = `This event focuses on ${interests.join(" and ")}, which you listed as an interest.`;
      } else if (skills.length) {
        reason = `Your experience with ${skills.join(" and ")} is relevant to the kind of work here.`;
      }
      return { hackathonId: h.id, relevance, reason };
    })
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
}
