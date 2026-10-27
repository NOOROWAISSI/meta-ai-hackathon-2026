/**
 * Data layer. Replace these functions with fetch calls to an ASP.NET Core Web
 * API (e.g. GET /api/hackathons, POST /api/recommendations). AI provider
 * requests and credentials must stay on that server, never in the browser.
 */
import { DEMO_HACKATHONS } from "./demo-data";
import type { DemoState, Hackathon, Recommendation, UserProfile } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchHackathons(state: DemoState): Promise<Hackathon[]> {
  await wait(state === "loading" ? 1_000_000 : 450);
  if (state === "error") throw new Error("We couldn't load opportunities right now.");
  if (state === "empty") return [];
  return DEMO_HACKATHONS;
}

export async function fetchRecommendations(
  _list: Hackathon[],
  _profile: UserProfile,
  state: DemoState,
): Promise<Recommendation[]> {
  await wait(250);
  if (state === "ai-unavailable")
    throw new Error("AI recommendations are temporarily unavailable.");
  // Synthetic fixtures have no reviewed tag evidence. Personalization must wait
  // for reviewed tags and permitted, explicitly reported profile factors.
  return [];
}
