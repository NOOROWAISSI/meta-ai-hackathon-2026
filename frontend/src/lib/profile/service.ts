import type { ProfileProject, UserProfile } from "../discover/types";

export interface ExperienceSuggestion {
  projectId: string;
  original: string;
  proposed: string;
  suggestedSkills: string[];
  clarification: string | null;
}

/** Future ASP.NET Core boundary. Never put a Meta key or model SDK in this module. */
export interface ProfileService {
  kind?: "server" | "demo";
  suggestionsAvailable?: boolean;
  load(): Promise<UserProfile>;
  save(profile: UserProfile, previous: UserProfile, fail?: boolean): Promise<UserProfile>;
  suggestExperience(project: ProfileProject, fail?: boolean): Promise<ExperienceSuggestion>;
  normalizeSkills(skills: string[]): Promise<string[]>;
}
export { serverProfileService as profileService } from "./server";
