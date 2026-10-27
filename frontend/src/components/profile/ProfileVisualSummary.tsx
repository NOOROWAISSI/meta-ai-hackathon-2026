import { ArrowUpRight, Clock3, Globe2, Sparkles, Target } from "lucide-react";
import { GOALS, type ProfileDraft } from "@/lib/profile/model";

export function ProfileVisualSummary({
  draft,
  onSection,
}: {
  draft: ProfileDraft;
  onSection: (section: number) => void;
}) {
  const goal =
    draft.goalChoice && draft.goalChoice !== "unknown"
      ? GOALS[draft.goalChoice]
      : draft.goals?.join(" · ") || "Your direction is still open.";
  const hours =
    draft.hoursInput.trim() &&
    Number.isFinite(Number(draft.hoursInput)) &&
    Number(draft.hoursInput) >= 0 &&
    Number(draft.hoursInput) <= 168
      ? draft.hoursInput
      : "—";
  const format = {
    online: "Online",
    onsite: "On-site",
    hybrid: "Hybrid",
    any: "Flexible",
    unknown: "Not provided",
  }[draft.preferredFormat ?? "unknown"];
  return (
    <>
      <div className="flex items-end justify-between gap-2">
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Your constellation</h2>
        <Sparkles className="size-5 text-[var(--galaxy-copper-ink)]" aria-hidden />
      </div>
      <section className="profile-interest-cloud" aria-label="Your interests">
        <span className="profile-cloud-orbit" aria-hidden />
        <span className="profile-cloud-spark" aria-hidden>
          ✦
        </span>
        {draft.interests.length ? (
          <div>
            {draft.interests.map((interest, index) => (
              <span key={interest} className={`profile-interest-label tint-${index % 4}`}>
                {interest}
              </span>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => onSection(1)}>
            <Sparkles className="size-5" aria-hidden />
            <span>Find your spark</span>
            <small>Add a few interests ↗</small>
          </button>
        )}
        <span className="profile-cloud-caption">
          {draft.interests.length
            ? "The topics that draw you in"
            : "Your interests will appear here"}
        </span>
      </section>
      <section className="profile-direction" aria-label="Your selected goal">
        <span className="profile-direction-icon">
          <Target className="size-4" aria-hidden />
        </span>
        <div>
          <p>Your direction</p>
          <strong>{goal}</strong>
        </div>
        <button type="button" onClick={() => onSection(1)} aria-label="Edit your goal">
          <ArrowUpRight className="size-4" aria-hidden />
        </button>
      </section>
      <section className="profile-skill-cloud" aria-label="Self-reported skills">
        <p>Self-reported skills</p>
        <div>
          {draft.skills.length ? (
            draft.skills.map((skill) => <span key={skill}># {skill}</span>)
          ) : (
            <button type="button" onClick={() => onSection(2)}>
              Add your skills +
            </button>
          )}
        </div>
      </section>
      <div className="profile-rhythm">
        <section aria-label="Weekly availability">
          <Clock3 className="size-4" aria-hidden />
          <strong>
            {hours}
            <small>{hours === "—" ? "Unknown" : "hours / week"}</small>
          </strong>
        </section>
        <section aria-label="Participation preference">
          <Globe2 className="size-5" aria-hidden />
          <strong>
            {format}
            <small>Participation format</small>
          </strong>
        </section>
      </div>
    </>
  );
}
