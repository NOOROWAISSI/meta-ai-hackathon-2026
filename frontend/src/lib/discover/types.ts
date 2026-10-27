export type ParticipationMode = "online" | "onsite" | "hybrid";
export type Accent = "violet" | "teal" | "coral" | "amber" | "sky";

export interface TeamRules {
  kind: "solo" | "team" | "either";
  min?: number;
  max?: number;
}

export interface Hackathon {
  id: string;
  title: string;
  organizer: string;
  initials: string;
  summary: string;
  topics: string[];
  /** Skills that relate to the theme; used for demo recommendation reasons. */
  relatedSkills: string[];
  mode: ParticipationMode;
  location: string | null;
  registrationDeadline: string | null; // ISO date
  eventStart: string | null;
  eventEnd: string | null;
  team: TeamRules | null;
  lastReviewed: string;
  sourceUrl: string; // placeholder example.org link
  accent: Accent;
  /** Readable cautions where information is missing or unverified. */
  uncertainties: string[];
}

export interface UserProfile {
  interests: string[];
  skills: string[];
  weeklyHours: number | null;
  goals?: string[];
  experience?: string;
  entrantType?: "unknown" | "solo" | "team";
  teamSize?: number | null;
  version?: number;
}

export interface Recommendation {
  hackathonId: string;
  relevance: number; // internal ordering only, never displayed
  reason: string;
}

export type DeadlineFilter = "any" | "7" | "30" | "90";
export type ParticipationFilter = "any" | "solo" | "team";
export type TimingChip = "now" | "later" | null;

export interface Filters {
  topics: string[];
  modes: ParticipationMode[];
  deadline: DeadlineFilter;
  participation: ParticipationFilter;
}

export type DemoState =
  "normal" | "loading" | "empty" | "error" | "ai-unavailable" | "incomplete-profile";
