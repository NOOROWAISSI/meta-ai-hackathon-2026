import { useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { ProfileProject } from "@/lib/discover/types";
import type { ExperienceSuggestion, ProfileService } from "@/lib/profile/service";

export function ExperienceHelper({
  project,
  service,
  fail,
  onAccept,
}: {
  project: ProfileProject;
  service: ProfileService;
  fail: boolean;
  onAccept: (wording: string, skills: string[]) => void;
}) {
  const [result, setResult] = useState<ExperienceSuggestion | null>(null);
  const [proposed, setProposed] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const current = useRef(project);
  current.current = project;
  const request = useRef(0);
  const changed = !!result && source !== JSON.stringify(project);
  const suggest = async () => {
    const serial = ++request.current;
    const input = JSON.stringify(project);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const suggestion = await service.suggestExperience(structuredClone(project), fail);
      if (serial !== request.current) return;
      if (input !== JSON.stringify(current.current)) {
        setError("This project changed. Request a fresh suggestion from your current words.");
        return;
      }
      setResult(suggestion);
      setSource(input);
      setProposed(suggestion.proposed);
      setSkills([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo suggestion failed. Try again.");
    } finally {
      if (serial === request.current) setBusy(false);
    }
  };
  return (
    <div className="profile-experience-helper">
      <button
        type="button"
        className="detail-secondary"
        disabled={busy}
        onClick={() => void suggest()}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {busy
          ? "Preparing demo suggestion…"
          : error
            ? "Retry demo suggestion"
            : "Help describe my experience"}
      </button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Demo suggestion · uses only your words and listed technologies. No live AI call.
      </p>
      {busy && (
        <p role="status" className="mt-2 text-xs">
          Your original information is unchanged.
        </p>
      )}
      {error && (
        <p role="alert" className="profile-error">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-4 border-l-2 border-primary/30 pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Review before adding
          </p>
          <p className="mt-3 text-xs font-semibold">Original contribution</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {result.original || "Not provided"}
          </p>
          {result.clarification ? (
            <p role="status" className="mt-3 text-sm">
              {result.clarification}
            </p>
          ) : (
            <>
              <label
                className="mt-4 block text-xs font-semibold"
                htmlFor={`suggestion-${project.id}`}
              >
                Proposed wording · edit freely
              </label>
              <textarea
                id={`suggestion-${project.id}`}
                rows={3}
                className="mt-2"
                value={proposed}
                maxLength={2000}
                onChange={(e) => setProposed(e.target.value)}
              />
              {!!result.suggestedSkills.length && (
                <fieldset className="mt-3">
                  <legend className="text-xs font-semibold">
                    Technologies you entered · choose any to add as self-reported skills
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {result.suggestedSkills.map((skill) => (
                      <label key={skill} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={skills.includes(skill)}
                          onChange={(e) =>
                            setSkills(
                              e.target.checked
                                ? [...skills, skill]
                                : skills.filter((entry) => entry !== skill),
                            )
                          }
                        />
                        {skill}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {changed && (
                <p role="status" className="profile-error">
                  Project changed. Generate a new suggestion before accepting.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="detail-primary"
                  disabled={changed || !proposed.trim()}
                  onClick={() => {
                    if (source !== JSON.stringify(current.current)) return;
                    onAccept(proposed.trim(), skills);
                    setResult(null);
                  }}
                >
                  Accept into my draft
                </button>
                <button type="button" className="detail-secondary" onClick={() => setResult(null)}>
                  Dismiss suggestion
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Accepting changes only this draft. Save changes to confirm your profile.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
