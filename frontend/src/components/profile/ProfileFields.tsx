import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import type { ProfileDraft, ProfileErrors } from "@/lib/profile/model";

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  id?: string;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="profile-field">
      <label htmlFor={fieldId}>{label}</label>
      {hint && (
        <p id={`${fieldId}-hint`} className="profile-helper">
          {hint}
        </p>
      )}
      {children(
        fieldId,
        [hint ? `${fieldId}-hint` : "", error ? `${fieldId}-error` : ""]
          .filter(Boolean)
          .join(" ") || undefined,
      )}
      {error && (
        <p id={`${fieldId}-error`} className="profile-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  draft,
  update,
  errors,
  hint,
  type = "text",
  multiline = false,
  ...limits
}: {
  name: keyof ProfileDraft;
  label: string;
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  errors: ProfileErrors;
  hint?: string;
  type?: string;
  multiline?: boolean;
  min?: number;
  max?: number;
  step?: string;
  maxLength?: number;
}) {
  const value = typeof draft[name] === "string" ? (draft[name] as string) : "";
  return (
    <Field
      label={label}
      {...(hint ? { hint } : {})}
      {...(errors[name] ? { error: errors[name] } : {})}
    >
      {(id, describedBy) =>
        multiline ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => update({ [name]: e.target.value })}
            aria-describedby={describedBy}
            aria-invalid={!!errors[name]}
            rows={3}
            maxLength={limits.maxLength ?? 2000}
          />
        ) : (
          <input
            id={id}
            type={type}
            value={value}
            onChange={(e) => update({ [name]: e.target.value })}
            aria-describedby={describedBy}
            aria-invalid={!!errors[name]}
            maxLength={limits.maxLength ?? 160}
            {...limits}
          />
        )
      }
    </Field>
  );
}

export function SelectField({
  name,
  label,
  draft,
  update,
  options,
  hint,
  errors = {},
}: {
  name: keyof ProfileDraft;
  label: string;
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  options: readonly (readonly [string, string])[];
  hint?: string;
  errors?: ProfileErrors;
}) {
  return (
    <Field
      label={label}
      {...(hint ? { hint } : {})}
      {...(errors[name] ? { error: errors[name] } : {})}
    >
      {(id, describedBy) => (
        <select
          id={id}
          value={typeof draft[name] === "string" ? (draft[name] as string) : ""}
          onChange={(e) => update({ [name]: e.target.value })}
          aria-describedby={describedBy}
          aria-invalid={!!errors[name]}
        >
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function TagEditor({
  label,
  selected,
  suggestions,
  onChange,
  searchable = false,
  onPendingChange,
}: {
  label: string;
  selected: string[];
  suggestions: readonly string[];
  onChange: (tags: string[]) => void;
  searchable?: boolean;
  onPendingChange?: (value: string) => void;
}) {
  const [input, setInput] = useState("");
  const id = useId();
  const pendingCallback = useRef(onPendingChange);
  pendingCallback.current = onPendingChange;
  useEffect(() => () => pendingCallback.current?.(""), []);
  const add = (tag: string) => {
    const clean = tag.trim();
    if (clean && !selected.some((entry) => entry.toLowerCase() === clean.toLowerCase()))
      onChange([...selected, clean]);
    setInput("");
    onPendingChange?.("");
  };
  const available = suggestions.filter(
    (entry) =>
      !selected.some((tag) => tag.toLowerCase() === entry.toLowerCase()) &&
      (!searchable || entry.toLowerCase().includes(input.toLowerCase())),
  );
  return (
    <fieldset className="profile-tags">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="mb-3 flex flex-wrap gap-2" aria-label={`Selected ${label.toLowerCase()}`}>
        {selected.map((tag) => (
          <span key={tag} className="profile-selected-tag">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(selected.filter((entry) => entry !== tag))}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        {!selected.length && (
          <span className="text-xs text-muted-foreground">
            Nothing reported yet. You can leave this blank.
          </span>
        )}
      </div>
      <label htmlFor={id} className="profile-helper">
        {searchable ? "Search skills or add your own" : "Add another interest"}
      </label>
      <div className="mt-1 flex items-center gap-2">
        {searchable && <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <input
          id={id}
          value={input}
          maxLength={70}
          onChange={(e) => {
            setInput(e.target.value);
            onPendingChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={searchable ? "Try Python, React, or your own skill" : "Your tech interest"}
        />
        <button
          type="button"
          className="detail-secondary"
          disabled={!input.trim()}
          aria-label={`Add ${label.toLowerCase()}`}
          onClick={() => add(input)}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {available.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => add(tag)}
            className="profile-suggested-tag"
          >
            + {tag}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
