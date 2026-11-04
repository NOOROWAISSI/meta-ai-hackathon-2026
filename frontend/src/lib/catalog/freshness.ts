import type { CampusActivity, ListingSummary } from "./service";
export function campusState(post: CampusActivity) {
  if (
    post.availability === "ended" ||
    post.postType === "recap" ||
    post.registrationState === "closed"
  )
    return "archived";
  return post.discoveryState ?? "needs_recheck";
}
export function listingState(listing: ListingSummary) {
  if (
    listing.availabilityState === "ended" ||
    listing.availabilityState === "cancelled" ||
    listing.registrationState === "closed"
  )
    return "archived";
  return listing.discoveryState ?? "current";
}
