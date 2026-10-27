import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserProfile } from "@/lib/discover/types";

const SUGGESTED_INTERESTS = [
  "AI",
  "Climate",
  "Health",
  "FinTech",
  "Games",
  "Accessibility",
  "Data",
  "Security",
  "Education",
];
const SUGGESTED_SKILLS = [
  "Python",
  "APIs",
  "JavaScript",
  "React",
  "Design",
  "Data analysis",
  "Security",
  "Unity",
];

function TagPicker({
  label,
  value,
  onChange,
  suggestions,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from(new Set([...suggestions, ...value])).map((t) => {
          const on = value.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t)}
              className="transition-soft rounded-full border border-input px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:border-primary/50"
            >
              {on && "✓ "}
              {t}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          aria-label={`Add custom ${label.toLowerCase()}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              if (!value.includes(draft.trim())) onChange([...value, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder="Add your own and press Enter"
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
      </div>
    </fieldset>
  );
}

export function ProfileDialog({
  open,
  onOpenChange,
  profile,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: UserProfile;
  onSave: (p: UserProfile) => boolean;
}) {
  const [p, setP] = useState(profile);
  useEffect(() => {
    if (open) setP(profile);
  }, [open, profile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-glass-border bg-popover/95 backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Your profile</DialogTitle>
          <DialogDescription>
            Demo only — saved in this browser to tune recommendations. Not connected to any live
            service.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (onSave(p)) onOpenChange(false);
          }}
        >
          <TagPicker
            label="Interests"
            value={p.interests}
            onChange={(interests) => setP({ ...p, interests })}
            suggestions={SUGGESTED_INTERESTS}
          />
          <TagPicker
            label="Skills"
            value={p.skills}
            onChange={(skills) => setP({ ...p, skills })}
            suggestions={SUGGESTED_SKILLS}
          />
          <TagPicker
            label="Goals"
            value={p.goals ?? []}
            onChange={(goals) => setP({ ...p, goals })}
            suggestions={["Build a prototype", "Learn a new skill", "Find collaborators"]}
          />
          <div>
            <label htmlFor="profile-experience" className="text-sm font-semibold">
              Relevant experience (optional)
            </label>
            <textarea
              id="profile-experience"
              maxLength={1500}
              value={p.experience ?? ""}
              onChange={(e) => setP({ ...p, experience: e.target.value })}
              placeholder="Describe a project or experience in your own words."
              className="mt-2 min-h-24 w-full rounded-xl border border-input bg-card p-3 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Self-reported experience; this does not verify competence or eligibility.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="entrant-type" className="text-sm font-semibold">
                How would you participate?
              </label>
              <select
                id="entrant-type"
                value={p.entrantType ?? "unknown"}
                onChange={(e) =>
                  setP({
                    ...p,
                    entrantType: e.target.value as NonNullable<UserProfile["entrantType"]>,
                  })
                }
                className="mt-2 w-full rounded-xl border border-input bg-card p-2 text-sm"
              >
                <option value="unknown">Not sure yet</option>
                <option value="solo">On my own</option>
                <option value="team">With a team</option>
              </select>
            </div>
            <div>
              <label htmlFor="profile-team-size" className="text-sm font-semibold">
                Team size, including you
              </label>
              <input
                id="profile-team-size"
                type="number"
                min={1}
                max={100}
                step={1}
                value={p.teamSize ?? ""}
                onChange={(e) =>
                  setP({ ...p, teamSize: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="mt-2 w-full rounded-xl border border-input bg-card p-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="hours" className="text-sm font-semibold">
              Weekly available hours
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="hours"
                type="number"
                min={0}
                max={80}
                value={p.weeklyHours ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    weeklyHours:
                      e.target.value === ""
                        ? null
                        : Math.max(0, Math.min(80, Number(e.target.value))),
                  })
                }
                className="w-28 rounded-xl border border-input bg-card px-3 py-2 text-sm"
              />
              {p.weeklyHours !== null && (
                <button
                  type="button"
                  onClick={() => setP({ ...p, weeklyHours: null })}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear hours"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="transition-soft rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-button active:scale-95"
            >
              Save profile
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
