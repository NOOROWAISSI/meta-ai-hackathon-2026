import type { Hackathon, UserProfile } from "./types";

/** Demo opportunities — all fictional. Links are example.org placeholders. */
export const DEMO_HACKATHONS: Hackathon[] = [
  {
    id: "aurora-ai",
    title: "Aurora AI Builders Weekend",
    organizer: "Northlight Student Tech Society",
    initials: "NS",
    summary:
      "A 48-hour sprint to prototype helpful AI assistants for campus life, with mentor office hours and API credits for participants.",
    topics: ["AI", "APIs", "Education"],
    relatedSkills: ["Python", "APIs", "Prompt design"],
    mode: "online",
    location: null,
    registrationDeadline: "2026-11-06",
    eventStart: "2026-11-14",
    eventEnd: "2026-11-16",
    team: { kind: "team", min: 2, max: 4 },
    lastReviewed: "2026-10-20",
    sourceUrl: "https://example.org/aurora-ai",
    accent: "violet",
    uncertainties: ["Geographic participation rules need checking."],
  },
  {
    id: "tidewater-climate",
    title: "Tidewater Climate Data Jam",
    organizer: "Coastal Futures Lab",
    initials: "CF",
    summary:
      "Work with open coastal sensor datasets to visualize flooding risk and propose community-facing tools.",
    topics: ["Climate", "Data", "Visualization"],
    relatedSkills: ["Data analysis", "Python", "Design"],
    mode: "hybrid",
    location: "Harbor City Innovation Hub (fictional)",
    registrationDeadline: "2026-11-20",
    eventStart: "2026-12-04",
    eventEnd: "2026-12-06",
    team: { kind: "either", max: 5 },
    lastReviewed: "2026-10-18",
    sourceUrl: "https://example.org/tidewater",
    accent: "teal",
    uncertainties: [],
  },
  {
    id: "pulse-health",
    title: "Pulse HealthTech Challenge",
    organizer: "Meridian University Hospital (fictional)",
    initials: "MU",
    summary:
      "Design accessible digital tools that help patients prepare for appointments. Clinicians join as judges.",
    topics: ["Health", "Accessibility", "Web"],
    relatedSkills: ["React", "Design", "Accessibility"],
    mode: "onsite",
    location: "Meridian Campus, Building C (fictional)",
    registrationDeadline: "2026-11-02",
    eventStart: "2026-11-21",
    eventEnd: "2026-11-22",
    team: null,
    lastReviewed: "2026-10-10",
    sourceUrl: "https://example.org/pulse-health",
    accent: "coral",
    uncertainties: ["Team size rules were not listed.", "Travel support is unconfirmed."],
  },
  {
    id: "ledger-fintech",
    title: "Open Ledger FinTech Sprint",
    organizer: "Civic Money Collective",
    initials: "CM",
    summary:
      "Build transparent budgeting tools for student organizations using a sandboxed payments API.",
    topics: ["FinTech", "APIs", "Security"],
    relatedSkills: ["APIs", "JavaScript", "Security"],
    mode: "online",
    location: null,
    registrationDeadline: "2027-01-29",
    eventStart: "2027-02-12",
    eventEnd: "2027-02-14",
    team: { kind: "solo" },
    lastReviewed: "2026-10-22",
    sourceUrl: "https://example.org/open-ledger",
    accent: "amber",
    uncertainties: [],
  },
  {
    id: "orbit-games",
    title: "Orbit Creative Code & Games Jam",
    organizer: "Pixel Orbit Club",
    initials: "PO",
    summary:
      "A relaxed jam for interactive art, small games, and playful interfaces. Beginners strongly encouraged.",
    topics: ["Games", "Creative coding", "Web"],
    relatedSkills: ["JavaScript", "Design", "Unity"],
    mode: "hybrid",
    location: "Location to be announced",
    registrationDeadline: null,
    eventStart: "2027-03-05",
    eventEnd: null,
    team: { kind: "team", min: 1, max: 3 },
    lastReviewed: "2026-09-30",
    sourceUrl: "https://example.org/orbit-jam",
    accent: "sky",
    uncertainties: ["Registration deadline not yet published.", "Event end date not confirmed."],
  },
];

export const ALL_TOPICS = Array.from(new Set(DEMO_HACKATHONS.flatMap((h) => h.topics))).sort();

export const DEFAULT_PROFILE: UserProfile = {
  interests: [],
  skills: [],
  weeklyHours: null,
};

/** Mock interaction history used for the compact extra sections. */
export const DEMO_RECENT_SEARCHES = ["accessibility", "health"];
