import type { AgeConditions } from "@/lib/profile/age-conditions";
import type { ProfileDraft, ProfileErrors } from "@/lib/profile/model";
import { Field } from "./ProfileFields";
export function EventAgeFields({
  conditions,
  draft,
  update,
  errors,
}: {
  conditions?: AgeConditions | undefined;
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  errors: ProfileErrors;
}) {
  if (!conditions) return null;
  const country =
    draft.residence && draft.residence !== "Prefer not to specify" ? draft.residence : "";
  return (
    <section
      className="mt-5 space-y-4 rounded-2xl border border-primary/20 p-4"
      aria-label="Selected event age conditions"
    >
      <h3 className="font-semibold">Age conditions for this event</h3>
      <p className="text-xs leading-6 text-muted-foreground">
        Optional self-reports are saved in your profile for source-backed comparisons. No date of
        birth or document is collected; these answers do not confirm overall eligibility.
      </p>
      {conditions.minimumAge && (
        <Field
          label="Age in whole years (optional)"
          {...(errors["ageInput"] ? { error: errors["ageInput"] } : {})}
          hint="Leave blank for Not provided."
        >
          {(id, describedBy) => (
            <input
              id={id}
              type="number"
              min={0}
              max={130}
              step={1}
              value={draft.ageInput ?? ""}
              onChange={(e) => update({ ageInput: e.target.value })}
              aria-describedby={describedBy}
              aria-invalid={!!errors["ageInput"]}
              placeholder="Not provided"
            />
          )}
        </Field>
      )}
      {conditions.majority && (
        <Field
          label="Have you reached the legal age of majority in your country of residence?"
          hint={
            country
              ? `Self-reported for ${country}. Choose Not sure if you cannot confirm.`
              : "Select your residence above to answer. Nothing is inferred from your age."
          }
        >
          {(id, describedBy) => (
            <select
              id={id}
              disabled={!country}
              aria-describedby={describedBy}
              value={
                draft.majorityJurisdiction === country
                  ? (draft.majorityReached ?? "unknown")
                  : "unknown"
              }
              onChange={(e) =>
                update({
                  majorityReached: e.target.value as "yes" | "no" | "unknown",
                  majorityJurisdiction: country,
                })
              }
            >
              <option value="unknown">Not provided / Not sure</option>
              <option value="yes">Yes, I confirm</option>
              <option value="no">No</option>
            </select>
          )}
        </Field>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-primary">Published conditions and sources</summary>
        <ul className="mt-2 space-y-2">
          {conditions.sources.map((source, index) => (
            <li key={index}>
              {source.statement}{" "}
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                Original source
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
