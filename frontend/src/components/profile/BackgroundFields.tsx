import {
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  MapPin,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useId } from "react";
import type { ProfileDraft, ProfileErrors } from "@/lib/profile/model";
import { Field, TextField } from "./ProfileFields";

const EDUCATION = [
  { value: "university", label: "University student", icon: BookOpen },
  { value: "graduate", label: "Graduate", icon: GraduationCap },
  { value: "other", label: "Other", icon: BriefcaseBusiness },
] as const;
const COUNTRIES =
  "PS JO LB SY EG IQ SA AE QA KW BH OM YE TR US GB CA DE FR IT ES NL SE NO DK FI AU IN PK ID MY SG JP KR CN BR ZA MA DZ TN LY SD SO KE NG GH NZ IE AT BE CH GR PT PL CZ UA MX AR CL CO PE BD LK NP TH VN PH IR AF AM GE CY IS LU MT RO HU HR RS BA ME MK AL EE LV LT MD SK SI BG RU KZ UZ AZ KG TJ TM MN IL".split(
    " ",
  );
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function BackgroundFields({
  draft,
  update,
  errors,
  eventTitle,
}: {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  errors: ProfileErrors;
  eventTitle?: string;
}) {
  const id = useId();
  const education = draft.educationStatus || "unknown";
  return (
    <div className="background-canvas">
      <div className="background-heading">
        <div>
          <p className="background-kicker">A few pieces of your story</p>
          <h2 id="profile-background-title">Your background</h2>
        </div>
        <span aria-hidden>
          01<span>ABOUT YOU ↗</span>
        </span>
      </div>
      <p className="background-intro">Share what feels right. Everything here is optional.</p>

      <div className="background-name">
        <UserRound className="size-5" aria-hidden />
        <Field label="Display name (optional)">
          {(fieldId) => (
            <input
              id={fieldId}
              value={draft.displayName ?? ""}
              onChange={(event) => update({ displayName: event.target.value })}
              maxLength={80}
              autoComplete="nickname"
              placeholder="What should we call you?"
            />
          )}
        </Field>
        <PencilLine className="size-4" aria-hidden />
      </div>

      <fieldset className="background-education">
        <legend>Education status</legend>
        <p className="background-small">Which chapter are you in?</p>
        <div className="background-education-choices">
          {EDUCATION.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={`background-education-choice ${education === value ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name={`${id}-education`}
                value={value}
                checked={education === value}
                onChange={() => update({ educationStatus: value })}
              />
              <span className="background-education-icon">
                <Icon className="size-6" aria-hidden />
                <span className="background-radio-mark" aria-hidden />
              </span>
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="background-education-privacy">
          <label>
            <input
              type="radio"
              name={`${id}-education`}
              value="unknown"
              checked={education === "unknown"}
              onChange={() => update({ educationStatus: "unknown" })}
            />
            Not provided
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-education`}
              value="prefer-not"
              checked={education === "prefer-not"}
              onChange={() => update({ educationStatus: "prefer-not" })}
            />
            Prefer not to specify
          </label>
        </div>
      </fieldset>

      <div className="background-study">
        <div className="background-study-marker" aria-hidden>
          <GraduationCap className="size-5" />
        </div>
        <div className="background-study-fields">
          <TextField
            name="fieldOfStudy"
            label="Field of study"
            draft={draft}
            update={update}
            errors={errors}
          />
          <span className="background-study-connector" aria-hidden>
            ↗
          </span>
          <TextField
            name="studyLevel"
            label="Study level / year (optional)"
            draft={draft}
            update={update}
            errors={errors}
          />
        </div>
      </div>

      <div className="background-location">
        <div className="background-location-marker" aria-hidden>
          <MapPin className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Field
            label="Country of residence"
            hint="Current residence, not nationality. Blank stays unknown."
          >
            {(fieldId, describedBy) => (
              <>
                <input
                  id={fieldId}
                  list={`${id}-countries`}
                  value={draft.residence ?? ""}
                  onChange={(event) => update({ residence: event.target.value })}
                  aria-describedby={describedBy}
                  placeholder="Not provided"
                  maxLength={80}
                />
                <datalist id={`${id}-countries`}>
                  <option value="Prefer not to specify" />
                  {COUNTRIES.map((code) => (
                    <option key={code} value={countryNames.of(code)} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <button
            type="button"
            onClick={() => update({ residence: "Prefer not to specify" })}
            className="background-private-choice"
          >
            Prefer not to specify ↗
          </button>
        </div>
      </div>

      <details className="background-privacy-note">
        <summary>
          <ShieldCheck className="size-4" aria-hidden />
          Your privacy & age information
        </summary>
        <p>
          Age: not provided.{" "}
          {eventTitle
            ? "This demo event has no reviewed published age condition, so age is not requested."
            : "We only ask for the minimum age information when a selected event has a reviewed published condition."}{" "}
          Nothing is inferred from your name, language, or location.
        </p>
      </details>
    </div>
  );
}
