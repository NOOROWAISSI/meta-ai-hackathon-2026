import { useId, type ReactNode } from "react";
import { ArrowUpRight, Clock3, type LucideIcon } from "lucide-react";
import type { ProfileDraft, ProfileErrors } from "@/lib/profile/model";
import { TextField } from "./ProfileFields";

export function SectionHeading({
  id,
  number,
  eyebrow,
  title,
  children,
}: {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="background-heading">
        <div>
          <p className="background-kicker">{eyebrow}</p>
          <h2 id={id}>{title}</h2>
        </div>
        <span aria-hidden>
          {number}
          <span>YOUR NEXT STEP ↗</span>
        </span>
      </div>
      <p className="background-intro">{children}</p>
    </>
  );
}

export function ChoiceRail({
  legend,
  value,
  options,
  onChange,
  unknownLabel = "Not provided",
  unknownValue = "unknown",
  className = "",
}: {
  legend: string;
  value: string;
  options: { value: string; label: string; short?: string; icon: LucideIcon }[];
  onChange: (value: string) => void;
  unknownLabel?: string;
  unknownValue?: string;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={`profile-choice-rail ${className}`}>
      <legend>{legend}</legend>
      <div className="profile-choice-options">
        {options.map(({ value: option, label, short, icon: Icon }, index) => (
          <label key={option} className={value === option ? "is-selected" : ""}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              aria-label={label}
            />
            <span className="profile-choice-symbol">
              <Icon className="size-5" aria-hidden />
              <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
            </span>
            <strong>{short || label}</strong>
            {short && <span className="profile-choice-caption">{label}</span>}
            <ArrowUpRight className="profile-choice-arrow size-3.5" aria-hidden />
          </label>
        ))}
      </div>
      <label className="profile-choice-unknown">
        <input
          type="radio"
          name={name}
          value={unknownValue}
          checked={!value || value === unknownValue}
          onChange={() => onChange(unknownValue)}
        />
        {unknownLabel}
      </label>
    </fieldset>
  );
}

export function WeeklyRhythm({
  draft,
  update,
  errors,
}: {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  errors: ProfileErrors;
}) {
  const known =
    draft.hoursInput.trim() !== "" &&
    Number.isFinite(Number(draft.hoursInput)) &&
    Number(draft.hoursInput) >= 0 &&
    Number(draft.hoursInput) <= 168;
  return (
    <div className="profile-weekly-rhythm">
      <div className="profile-hours-art" aria-hidden>
        <Clock3 className="size-5" />
        <strong>{known ? draft.hoursInput : "—"}</strong>
        <span>{known ? "hours / week" : "Availability unknown"}</span>
        <svg className="profile-hours-orbit" viewBox="0 0 150 45" aria-hidden="true">
          <path
            d="M3 35C28 35 35 8 64 8s29 28 60 20l22-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 5"
          />
          <circle cx="64" cy="8" r="4" fill="currentColor" />
          <circle cx="124" cy="28" r="3" fill="var(--galaxy-copper-ink)" />
        </svg>
      </div>
      <div className="profile-weekly-fields">
        <TextField
          name="hoursInput"
          label="Weekly preparation hours"
          hint="Zero is valid. Blank stays unknown."
          type="number"
          min={0}
          max={168}
          step="any"
          draft={draft}
          update={update}
          errors={errors}
        />
        <div className="profile-hour-presets" aria-label="Optional weekly hour shortcuts">
          {[0, 2, 5, 10].map((hours) => (
            <button
              key={hours}
              type="button"
              aria-pressed={draft.hoursInput === String(hours)}
              onClick={() => update({ hoursInput: String(hours) })}
            >
              {hours}h
            </button>
          ))}
          <button
            type="button"
            aria-pressed={!draft.hoursInput}
            onClick={() => update({ hoursInput: "" })}
          >
            Unknown
          </button>
        </div>
        <p className="profile-rhythm-disclaimer">
          Your preparation time, separate from participation requirements.
        </p>
      </div>
    </div>
  );
}
