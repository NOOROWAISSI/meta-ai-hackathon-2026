import type { Hackathon, UserProfile } from "../discover/types";

export type DetailsState =
  | "normal"
  | "loading"
  | "unavailable"
  | "source-unavailable"
  | "stale"
  | "conflicting-dates"
  | "incomplete-profile"
  | "ai-error"
  | "hard-blocker";
export type FitStatus = "Supported" | "Not met" | "Unknown" | "Source conflict" | "Not applicable";
export type Lane = "participation" | "submission" | "access" | "preparation";
export interface Requirement {
  id: string;
  lane: Lane;
  statement: string;
  mandatory: boolean;
  rule: "team-min" | "team-max" | "solo-only" | "skill" | "unknown";
  value?: number | string;
  passage: string | null;
  sourceUrl: string;
  sourceStatus: "unverified" | "stale" | "conflicting" | "reviewed-demo";
  conflictingPassage?: string;
}
export interface FitMatch {
  requirement: Requirement;
  status: FitStatus;
  explanation: string;
  profileEvidence: string;
  nextAction: string | null;
}
export interface Milestone {
  id: string;
  title: string;
  date: string;
  originalZone: string | null;
  conflictingDate?: string;
}
export interface EventDetails {
  event: Hackathon;
  revision: string;
  sourceState: "unverified" | "stale" | "unavailable" | "conflicting" | "reviewed-demo";
  listingHost: string | null;
  rulesUrl: string | null;
  startInstant: string | null;
  originalZone: string | null;
  registrationOpens: string | null;
  submissionDeadline: string | null;
  resultsDate: string | null;
  entryCost: string | null;
  duration: string | null;
  participants: string | null;
  deliverable: string | null;
  technologies: string | null;
  judging: string | null;
  benefits: string[];
  timeline: Milestone[];
  requirements: Requirement[];
}
export interface AnalysisSnapshot {
  context: string;
  profile: UserProfile;
  matches: FitMatch[];
  sections: { title: string; text: string }[];
  generatedAt: string;
}
export interface OpportunityAnswer {
  context: string;
  question: string;
  answer: string;
  sourceLabel: string;
  sourceUrl: string;
}
export interface PreparationPlan {
  eventId: string;
  title: string;
  context: string;
  createdAt: string;
  weeklyHours: number;
  freeOnly: boolean;
  budget: number;
  deadline: string | null;
  tasks: {
    id: string;
    title: string;
    deliverable: string;
    completionCriteria: string;
    hours: number;
    status: "not_started" | "in_progress" | "done";
  }[];
}
