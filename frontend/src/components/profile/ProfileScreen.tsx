import { useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/discover/AppShell";
import { useVisitState } from "@/components/VisitMemory";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EMPTY_PROFILE as DEFAULT_PROFILE } from "@/lib/profile/defaults";
import type { UserProfile } from "@/lib/discover/types";
import type { AnalysisSnapshot } from "@/lib/details/types";
import {
  confirmedProfile,
  profileAnalysisFacts,
  profileCompletion,
  toDraft,
  validateDraft,
  type ProfileDraft,
  type ProfileErrors,
} from "@/lib/profile/model";
import { profileService, type ProfileService } from "@/lib/profile/service";
import { ProfileSections, SECTIONS } from "./ProfileSections";
import { ProfileIdentity } from "./ProfileIdentity";
import { ProfileVisualSummary } from "./ProfileVisualSummary";

const ICONS = [GraduationCap, Compass, BookOpen, Clock3];

export function ProfileScreen({
  eventId,
  service = profileService,
  returnToPlans = false,
  contextEvent,
}: {
  eventId?: string;
  service?: ProfileService;
  returnToPlans?: boolean;
  contextEvent?: { id: string; title: string };
}) {
  const navigate = useNavigate();
  const event = contextEvent;
  const [saved, setSaved] = useState<UserProfile>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(DEFAULT_PROFILE));
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [active, setActive] = useState(0);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [message, setMessage] = useState("");
  const [saveFailure, setSaveFailure] = useState(false);
  const [suggestionFailure, setSuggestionFailure] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [snapshot] = useVisitState<AnalysisSnapshot | null>(
    `details.analysis.${eventId ?? "none"}`,
    null,
  );
  const [pendingTags, setPendingTags] = useState<
    Record<string, { value: string; section: number }>
  >({});
  const heading = useRef<HTMLHeadingElement>(null);
  const saveLock = useRef(false);
  const draftProfile = useMemo(() => confirmedProfile(draft), [draft]);
  const completion = profileCompletion(draftProfile);
  const dirty =
    loadState === "ready" &&
    (JSON.stringify(draft) !== JSON.stringify(toDraft(saved)) ||
      Object.values(pendingTags).some((entry) => entry.value.trim()));
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current || saveLock.current || photoBusy,
    enableBeforeUnload: dirty || status === "saving" || photoBusy,
    withResolver: true,
  });
  const outdated =
    !!snapshot &&
    JSON.stringify(profileAnalysisFacts(snapshot.profile)) !==
      JSON.stringify(profileAnalysisFacts(saved));

  useEffect(() => {
    let alive = true;
    setLoadState("loading");
    service
      .load()
      .then((profile) => {
        if (!alive) return;
        setSaved(profile);
        setDraft(toDraft(profile));
        setLoadState("ready");
        setStatus("idle");
        setMessage("");
        setErrors({});
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Your saved profile could not be loaded. No data has been changed.",
        );
        setLoadState("error");
      });
    return () => {
      alive = false;
    };
  }, [service, loadAttempt]);

  const update = (patch: Partial<ProfileDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setStatus("idle");
    setMessage("");
    setErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([key]) =>
            !Object.keys(patch).some(
              (changed) =>
                key === changed || (changed === "projects" && key.startsWith("project.")),
            ),
        ),
      ),
    );
  };
  const changeSection = (index: number) => {
    setActive(index);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      document
        .getElementById("profile-editor")
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  };
  const save = async () => {
    if (saveLock.current || photoBusy || loadState !== "ready") return;
    const pending = Object.values(pendingTags).find((entry) => entry.value.trim());
    if (pending) {
      setActive(pending.section);
      setMessage(
        "You have text waiting to be added as a tag. Add it or clear its input before saving.",
      );
      return;
    }
    const issues = validateDraft(draft);
    setErrors(issues);
    if (Object.keys(issues).length) {
      const section = Object.keys(issues).some((key) => key.startsWith("project.")) ? 2 : 3;
      setActive(section);
      setMessage("Check the marked fields. Your changes have not been saved.");
      setStatus("idle");
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#profile-editor [aria-invalid=true]")?.focus(),
      );
      return;
    }
    saveLock.current = true;
    setStatus("saving");
    setMessage("");
    const fail = saveFailure;
    setSaveFailure(false);
    try {
      const result = await service.save(confirmedProfile(draft), saved, fail);
      setSaved(result);
      setDraft(toDraft(result));
      dirtyRef.current = false;
      setStatus("saved");
      setMessage(
        service.kind === "server"
          ? "Changes confirmed in your account. Existing plans and completed tasks are preserved."
          : "Changes saved in this browser. Your existing plans and completed tasks are unchanged.",
      );
    } catch (error) {
      setStatus("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "Save failed. Your draft is still here; retry when ready.",
      );
    } finally {
      saveLock.current = false;
    }
  };
  const returnToContext = (updateAnalysis = false) =>
    returnToPlans && !updateAnalysis
      ? void navigate({
          to: "/plans",
          search: event ? { event: event.id } : {},
          resetScroll: false,
        })
      : void navigate({
          to: "/",
          search: event
            ? { opportunity: event.id, ...(updateAnalysis ? { analysis: "update" as const } : {}) }
            : {},
          resetScroll: false,
        });
  const saveButton = (mobile = false) => (
    <button
      form="student-profile"
      type="submit"
      disabled={
        status === "saving" || photoBusy || loadState !== "ready" || (!dirty && !!saved.savedAt)
      }
      className={`detail-primary ${mobile ? "flex-1" : ""}`}
    >
      {status === "saving" ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        <Save className="size-4" aria-hidden />
      )}
      {status === "saving" ? "Saving…" : "Save changes"}
    </button>
  );

  return (
    <AppShell>
      <div className="profile-page">
        <button
          type="button"
          onClick={() => returnToContext()}
          className="mb-5 flex items-center gap-2 text-xs font-medium text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {event ? `Return to ${event.title}` : "Back to Discover"}
        </button>
        {eventId && !event && (
          <p className="mb-4 text-xs text-muted-foreground">
            The selected event is unavailable. Your profile can still be edited; return to Discover
            to select another opportunity.
          </p>
        )}
        <header className="profile-header">
          <div className="min-w-0 flex-1">
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              Your next chapter
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Make opportunities
              <br className="hidden sm:block" /> fit you.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Tell us about your interests, experience, and goals.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Your profile is optional. Keep exploring at any stage.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`profile-save-label ${dirty ? "is-dirty" : ""}`}>
                <span aria-hidden />
                {loadState === "loading"
                  ? "Loading saved information"
                  : dirty
                    ? "Unsaved changes"
                    : saved.savedAt || saved.version
                      ? "Saved profile"
                      : "New profile"}
              </span>
              {loadState === "ready" && saved.savedAt && (
                <span className="text-[10px] text-muted-foreground">
                  Saved{" "}
                  {new Date(saved.savedAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
          </div>
          <div
            className="profile-completion"
            aria-label={`Profile completion: ${completion.completed} of ${completion.total} fields filled. Not a skill or readiness score.`}
          >
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="48" fill="none" className="profile-completion-track" />
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                className="profile-completion-fill"
                pathLength="100"
                strokeDasharray={`${(completion.completed / completion.total) * 100} 100`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <span>
              <strong>
                {completion.completed}
                <small>/{completion.total}</small>
              </strong>
              <span>fields filled</span>
            </span>
            <p>
              Profile completion
              <br />
              <span>Not a readiness score</span>
            </p>
          </div>
        </header>

        {loadState === "ready" && (
          <ProfileIdentity
            draft={draft}
            update={update}
            disabled={status === "saving"}
            onBusyChange={setPhotoBusy}
          />
        )}
        <div className="mb-6 hidden items-center justify-end gap-2 lg:flex">
          <button type="button" className="detail-secondary" onClick={() => returnToContext()}>
            Cancel
          </button>
          {saveButton()}
        </div>
        {loadState === "loading" && (
          <div className="glass-strong rounded-3xl p-8" role="status">
            <LoaderCircle className="mb-3 size-6 animate-spin text-primary" aria-hidden />
            Loading your profile…
          </div>
        )}
        {loadState === "error" && (
          <div className="glass-strong rounded-3xl p-6" role="alert">
            <h2 className="font-semibold">We could not read your saved profile.</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              type="button"
              className="detail-primary mt-4"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              Retry loading profile
            </button>
          </div>
        )}
        {loadState === "ready" && (
          <>
            {import.meta.env.DEV && service.kind !== "server" && (
              <details className="mb-5 text-xs text-muted-foreground">
                <summary className="w-fit cursor-pointer">Profile demo controls</summary>
                <div className="mt-3 flex flex-wrap gap-4 border-l-2 border-primary/20 pl-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={saveFailure}
                      onChange={(e) => setSaveFailure(e.target.checked)}
                    />
                    Fail next save (demo)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={suggestionFailure}
                      onChange={(e) => setSuggestionFailure(e.target.checked)}
                    />
                    Fail experience suggestions (demo)
                  </label>
                </div>
              </details>
            )}
            <div className="profile-layout">
              <div className="min-w-0">
                <nav className="profile-stepper" aria-label="Profile sections">
                  {SECTIONS.map((section, index) => {
                    const Icon = ICONS[index]!;
                    return (
                      <button
                        key={section.label}
                        type="button"
                        aria-current={active === index ? "step" : undefined}
                        onClick={() => changeSection(index)}
                      >
                        <span className="profile-step-icon">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span>
                          <small>0{index + 1}</small>
                          {section.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>
                <form
                  id="student-profile"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                  className="profile-editor glass-strong"
                  aria-busy={status === "saving"}
                >
                  <h2 className="sr-only" tabIndex={-1} ref={heading}>
                    {SECTIONS[active]?.title}
                  </h2>
                  <div id="profile-editor" className="scroll-mt-24">
                    <fieldset disabled={status === "saving"} className="min-w-0">
                      <ProfileSections
                        active={active}
                        draft={draft}
                        update={update}
                        errors={errors}
                        service={service}
                        suggestionFailure={suggestionFailure}
                        onPendingChange={(key, value, section) =>
                          setPendingTags((previous) => {
                            if (previous[key]?.value === value || (!previous[key] && !value))
                              return previous;
                            const next = { ...previous };
                            if (!value) delete next[key];
                            else next[key] = { value, section };
                            return next;
                          })
                        }
                        {...(event ? { eventTitle: event.title } : {})}
                      />
                    </fieldset>
                  </div>
                  {Object.keys(errors).length > 0 && (
                    <div
                      role="alert"
                      className="mt-5 border-l-2 border-destructive pl-3 text-xs text-destructive"
                    >
                      Check {Object.keys(errors).length} marked{" "}
                      {Object.keys(errors).length === 1 ? "field" : "fields"} before saving.
                      Optional fields can stay blank.
                    </div>
                  )}
                  <div className="profile-section-footer">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      Section {active + 1} of 4
                    </span>
                    <div className="flex gap-2">
                      {active > 0 && (
                        <button
                          type="button"
                          className="detail-secondary"
                          onClick={() => changeSection(active - 1)}
                        >
                          <ArrowLeft className="size-4" aria-hidden />
                          Previous
                        </button>
                      )}
                      {active < 3 && (
                        <button
                          type="button"
                          className="detail-secondary"
                          onClick={() => changeSection(active + 1)}
                        >
                          Next section
                          <ArrowRight className="size-4" aria-hidden />
                        </button>
                      )}
                      {active === 3 && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <Check className="size-4" aria-hidden />
                          Save when ready
                        </span>
                      )}
                    </div>
                  </div>
                </form>
                {message && loadState === "ready" && (
                  <div
                    role={status === "failed" ? "alert" : "status"}
                    className={`profile-feedback ${status === "failed" ? "has-error" : ""}`}
                  >
                    {status === "saved" && (
                      <CheckCircle2
                        className="size-5 shrink-0 text-[var(--galaxy-teal-ink)]"
                        aria-hidden
                      />
                    )}
                    <div>
                      <p className="text-sm">{message}</p>
                      {status === "failed" && (
                        <button
                          type="button"
                          className="detail-secondary mt-3"
                          onClick={() => void save()}
                        >
                          Retry save
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {status === "saving" && (
                  <p role="status" className="mt-3 text-sm text-muted-foreground">
                    {service.kind === "server"
                      ? "Confirming changes in your account…"
                      : "Confirming your changes in browser storage…"}
                  </p>
                )}
              </div>

              <aside className="profile-summary" aria-label="Profile summary">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  {dirty
                    ? "Draft summary · not saved"
                    : saved.savedAt || saved.version
                      ? "Confirmed profile summary"
                      : "Your profile summary"}
                </p>
                <ProfileVisualSummary draft={draft} onSection={changeSection} />
                <div className="profile-summary-note">
                  <ShieldCheck
                    className="size-5 shrink-0 text-[var(--galaxy-teal-ink)]"
                    aria-hidden
                  />
                  <p>
                    Your profile helps explain recommendations. Participation requirements are
                    checked separately.
                  </p>
                </div>
                {event && (
                  <div className="mt-6 border-t border-primary/15 pt-5">
                    <p className="text-xs font-semibold">For {event.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Participation conditions are checked separately against the organizer's
                      sources.
                    </p>
                    {(!draft.entrantType || draft.entrantType === "unknown") && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        To clarify: individual or team participation is unknown.
                      </p>
                    )}
                    {draft.entrantType === "team" && !draft.teamSizeInput.trim() && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        To clarify: team size is unknown.
                      </p>
                    )}
                    {outdated && (
                      <p
                        role="status"
                        className="mt-3 text-xs font-semibold text-[var(--galaxy-copper-ink)]"
                      >
                        Previous opportunity analysis needs updating.
                      </p>
                    )}
                    <button
                      type="button"
                      className="detail-secondary mt-4 w-full"
                      disabled={dirty || status === "saving"}
                      onClick={() => returnToContext(true)}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Update my opportunity analysis
                    </button>
                    {dirty && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Save your changes first. Analysis uses confirmed facts only.
                      </p>
                    )}
                  </div>
                )}
                {!event && (
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Open a selected opportunity to update its analysis. Existing plans and completed
                    tasks are kept.
                  </p>
                )}
                <details className="mt-6 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">What counts as profile completion?</summary>
                  <ul className="mt-3 space-y-2">
                    {completion.checks.map(([label, done]) => (
                      <li key={label} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`size-1.5 rounded-full ${done ? "bg-[var(--galaxy-teal-ink)]" : "bg-muted-foreground/30"}`}
                        />
                        {label}: {done ? "filled" : "not provided"}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 leading-relaxed">
                    Counts 11 optional core fields, including an explicit choice not to disclose.
                    Name, projects, and age are not required. This measures form completion only.
                  </p>
                </details>
              </aside>
            </div>
          </>
        )}
        {loadState === "ready" && (
          <div className="profile-save-bar glass-strong">
            <div className="hidden sm:block">
              <p className="text-xs font-semibold">
                {dirty
                  ? "Your draft is not saved yet"
                  : saved.savedAt || saved.version
                    ? "Changes confirmed"
                    : "Nothing saved yet"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {dirty ? "Save only what you choose to share." : "You can keep exploring."}
              </p>
            </div>
            <div className="flex flex-1 gap-2 sm:flex-none">
              <button type="button" onClick={() => returnToContext()} className="detail-secondary">
                Cancel
              </button>
              {saveButton(true)}
            </div>
          </div>
        )}
        <Dialog
          open={blocker.status === "blocked"}
          onOpenChange={(open) => {
            if (!open && blocker.status === "blocked") blocker.reset();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {status === "saving"
                  ? "Your profile is still saving"
                  : "Leave your unsaved changes?"}
              </DialogTitle>
              <DialogDescription>
                {status === "saving"
                  ? "Wait for saving to finish before leaving this screen."
                  : "Your saved profile will stay as it was. You can keep editing or discard this draft and leave."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                className="detail-primary"
                onClick={() => {
                  if (blocker.status === "blocked") blocker.reset();
                }}
              >
                Keep editing
              </button>
              {status !== "saving" && (
                <button
                  type="button"
                  className="detail-secondary"
                  onClick={() => {
                    dirtyRef.current = false;
                    if (blocker.status === "blocked") blocker.proceed();
                  }}
                >
                  Discard changes & leave
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
