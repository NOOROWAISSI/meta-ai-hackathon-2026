import type { EventDetails } from "@/lib/details/types";
import type { UserProfile } from "@/lib/discover/types";
import { PreparationFlow } from "@/components/preparation/PreparationFlow";

/** The Details tab and dedicated workspace share one candidate/acceptance flow. */
export function PreparationPanel({
  details,
  blocked,
  onOther,
}: {
  details: EventDetails;
  profile: UserProfile;
  blocked: boolean;
  outdated: boolean;
  onOther: () => void;
  onUpdate: () => void;
}) {
  return (
    <PreparationFlow
      key={details.event.id}
      opportunityId={details.event.id}
      embedded
      blocked={blocked}
      onOther={onOther}
    />
  );
}
