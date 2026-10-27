import { useState } from "react";
import {
  Compass,
  Globe2,
  Laptop,
  MapPin,
  Plus,
  Rocket,
  Sprout,
  Target,
  Trash2,
  Undo2,
  Users,
  UserRound,
  Wallet,
  Leaf,
  BookOpen,
  Code2,
} from "lucide-react";
import type { ProfileProject } from "@/lib/discover/types";
import { GOALS, type ProfileDraft, type ProfileErrors } from "@/lib/profile/model";
import type { ProfileService } from "@/lib/profile/service";
import { Field, SelectField, TagEditor, TextField } from "./ProfileFields";
import { ExperienceHelper } from "./ExperienceHelper";
import { BackgroundFields } from "./BackgroundFields";
import { SectionHeading, ChoiceRail, WeeklyRhythm } from "./ProfileCompositions";

export const SECTIONS = [
  {
    title: "Your background",
    label: "Background",
    description: "A little context. Share only what you are comfortable sharing.",
  },
  {
    title: "What draws you in?",
    label: "Interests & goals",
    description: "Keep it curious. Tell us what you want to explore in tech hackathons.",
  },
  {
    title: "What have you worked on?",
    label: "Skills & projects",
    description:
      "Your words, your contribution. Small projects and work in progress count as experience to describe.",
  },
  {
    title: "Make room for your next step.",
    label: "Time & preferences",
    description:
      "A realistic starting point for preparation. These preferences are not organizer requirements.",
  },
] as const;
const INTERESTS = ["AI", "Web development", "Cybersecurity", "Robotics", "Data", "Design"];
const SKILLS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "HTML",
  "CSS",
  "APIs",
  "SQL",
  "Data analysis",
  "UI design",
  "Security",
  "Git",
];
export function ProfileSections({
  active,
  draft,
  update,
  errors,
  service,
  suggestionFailure,
  eventTitle,
  onPendingChange,
}: {
  active: number;
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  errors: ProfileErrors;
  service: ProfileService;
  suggestionFailure: boolean;
  eventTitle?: string;
  onPendingChange: (key: string, value: string, section: number) => void;
}) {
  const [removed, setRemoved] = useState<ProfileProject | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const field = { draft, update, errors };
  const projects = draft.projects ?? [];
  const editProject = (id: string, patch: Partial<ProfileProject>) =>
    update({
      projects: projects.map((project) => (project.id === id ? { ...project, ...patch } : project)),
    });
  return (
    <>
      <section
        hidden={active !== 0}
        aria-labelledby="profile-background-title"
        className="profile-section"
      >
        <BackgroundFields
          draft={draft}
          update={update}
          errors={errors}
          {...(eventTitle ? { eventTitle } : {})}
        />
      </section>

      <section
        hidden={active !== 1}
        aria-labelledby="profile-interests-title"
        className="profile-section"
      >
        <SectionHeading
          id="profile-interests-title"
          number="02"
          eyebrow="Follow your curiosity"
          title="What draws you in?"
        >
          Pick your topics, then choose a direction. Nothing is locked in.
        </SectionHeading>
        <div className="profile-topic-garden">
          <TagEditor
            label="Interests"
            selected={draft.interests}
            suggestions={INTERESTS}
            onChange={(interests) => update({ interests })}
            onPendingChange={(value) => onPendingChange("interests", value, 1)}
          />
        </div>
        <ChoiceRail
          legend="What would you like to do?"
          className="profile-goal-route"
          value={draft.goalChoice ?? "unknown"}
          onChange={(value) =>
            update({ goalChoice: value as NonNullable<ProfileDraft["goalChoice"]> })
          }
          options={[
            { value: "now", label: GOALS.now, short: "Pursue now", icon: Rocket },
            { value: "prepare", label: GOALS.prepare, short: "Get ready", icon: Sprout },
            { value: "explore", label: GOALS.explore, short: "Explore", icon: Compass },
          ]}
          unknownLabel="Still exploring / not provided"
        />
        <TextField
          name="goalDescription"
          label="Your goal in your own words (optional)"
          hint={
            draft.goals?.length && draft.goalDescription === undefined
              ? `Previously saved: ${draft.goals.join("; ")}. These stay unchanged unless you edit your goal.`
              : "A short description is enough."
          }
          multiline
          {...field}
        />
        <ChoiceRail
          legend="Preferred participation format"
          value={draft.preferredFormat ?? "unknown"}
          onChange={(value) =>
            update({ preferredFormat: value as NonNullable<ProfileDraft["preferredFormat"]> })
          }
          options={[
            { value: "online", label: "Online", icon: Laptop },
            { value: "onsite", label: "On-site", icon: MapPin },
            { value: "hybrid", label: "Hybrid", icon: Globe2 },
            { value: "any", label: "No preference", icon: Compass },
          ]}
        />
      </section>

      <section
        hidden={active !== 2}
        aria-labelledby="profile-skills-title"
        className="profile-section"
      >
        <SectionHeading
          id="profile-skills-title"
          number="03"
          eyebrow="Your working notebook"
          title="Things you have worked on"
        >
          Skills, small experiments, and your part in a project.
        </SectionHeading>

        <p className="profile-self-report-stamp">SELF-REPORTED · NOT A SKILL ASSESSMENT</p>
        <div className="profile-toolbox">
          <Code2 className="profile-toolbox-decoration" aria-hidden />
          <TagEditor
            label="Reported skills"
            searchable
            selected={draft.skills}
            suggestions={SKILLS}
            onChange={(skills) => update({ skills })}
            onPendingChange={(value) => onPendingChange("skills", value, 2)}
          />
          {!!draft.skills.length && (
            <details className="profile-skill-notes">
              <summary>Describe your experience with a skill (optional)</summary>
              <div className="mt-4 space-y-4">
                {draft.skills.map((skill) => (
                  <Field key={skill} label={`${skill} experience`}>
                    {(id) => (
                      <textarea
                        id={id}
                        value={draft.skillNotes?.[skill] ?? ""}
                        onChange={(e) =>
                          update({ skillNotes: { ...draft.skillNotes, [skill]: e.target.value } })
                        }
                        rows={2}
                        maxLength={1200}
                        placeholder="For example: used it to build a small class project."
                      />
                    )}
                  </Field>
                ))}
              </div>
            </details>
          )}
        </div>
        <details className="profile-overview-note">
          <summary>
            <BookOpen className="size-4" aria-hidden />
            Add an experience note (optional)
            {draft.experience?.trim() ? <span>Note added</span> : null}
          </summary>
          <TextField
            name="experience"
            label="Experience overview (optional)"
            hint="Coursework, independent learning, team projects, or anything else you want to describe."
            multiline
            {...field}
          />
        </details>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 pt-6">
          <div>
            <h3 className="text-lg font-semibold">Your project notebook</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Describe your part, even when the work was shared.
            </p>
          </div>
          <button
            type="button"
            className="detail-secondary"
            onClick={() => {
              const id = crypto.randomUUID();
              setExpandedProjects(new Set([id]));
              update({
                projects: [
                  ...projects,
                  { id, title: "", description: "", contribution: "", technologies: [], url: "" },
                ],
              });
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add project
          </button>
        </div>
        {!projects.length && (
          <div className="profile-empty-project">
            <span aria-hidden>↗</span>
            <p>No projects added yet.</p>
            <p className="text-xs text-muted-foreground">
              Optional. Start with one whenever you are ready.
            </p>
          </div>
        )}
        {projects.map((project, index) => (
          <details
            className="profile-project profile-notebook-entry"
            key={project.id}
            open={
              expandedProjects.has(project.id) ||
              Object.keys(errors).some((key) => key.startsWith(`project.${project.id}.`))
            }
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setExpandedProjects((previous) => {
                if (previous.has(project.id) === open) return previous;
                const next = new Set(previous);
                if (open) next.add(project.id);
                else next.delete(project.id);
                return next;
              });
            }}
          >
            <summary className="cursor-pointer">
              <span className="text-xs text-primary">{String(index + 1).padStart(2, "0")}</span>
              <span className="ml-3 font-semibold">{project.title || "Untitled project"}</span>
              <span className="profile-project-preview">
                {project.technologies.length
                  ? project.technologies.join(" · ")
                  : "Open your project notes"}
              </span>
            </summary>
            <div className="mt-5 space-y-4">
              <Field
                id={`project.${project.id}.title`}
                label="Project title"
                hint="Required only if you add a project entry."
                {...(errors[`project.${project.id}.title`]
                  ? { error: errors[`project.${project.id}.title`] }
                  : {})}
              >
                {(id, describedBy) => (
                  <input
                    id={id}
                    value={project.title}
                    maxLength={160}
                    onChange={(e) => editProject(project.id, { title: e.target.value })}
                    aria-invalid={!!errors[`project.${project.id}.title`]}
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
              <Field label="Short project description">
                {(id) => (
                  <textarea
                    id={id}
                    rows={2}
                    maxLength={2000}
                    value={project.description}
                    onChange={(e) => editProject(project.id, { description: e.target.value })}
                  />
                )}
              </Field>
              <Field
                label="What did you personally contribute?"
                hint="Describe your own work; leave blank if you are not ready to explain it."
              >
                {(id, describedBy) => (
                  <textarea
                    id={id}
                    rows={3}
                    maxLength={2000}
                    value={project.contribution}
                    onChange={(e) => editProject(project.id, { contribution: e.target.value })}
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
              <TagEditor
                label={`Technologies for ${project.title || "untitled project"}`}
                selected={project.technologies}
                onPendingChange={(value) =>
                  onPendingChange(`project.${project.id}.technologies`, value, 2)
                }
                suggestions={SKILLS.slice(0, 6)}
                onChange={(technologies) => editProject(project.id, { technologies })}
                searchable
              />
              <Field
                id={`project.${project.id}.url`}
                label="Repository or demo URL (optional)"
                {...(errors[`project.${project.id}.url`]
                  ? { error: errors[`project.${project.id}.url`] }
                  : {})}
              >
                {(id, describedBy) => (
                  <input
                    id={id}
                    type="url"
                    value={project.url}
                    maxLength={2000}
                    onChange={(e) => editProject(project.id, { url: e.target.value })}
                    aria-invalid={!!errors[`project.${project.id}.url`]}
                    aria-describedby={describedBy}
                    placeholder="https://…"
                  />
                )}
              </Field>
              <p className="profile-footnote">
                A link is an artifact, not independent proof of authorship or competence.
              </p>
              <ExperienceHelper
                project={project}
                service={service}
                fail={suggestionFailure}
                onAccept={(contribution, skills) => {
                  const combined = [...draft.skills];
                  for (const skill of skills) {
                    if (!combined.some((entry) => entry.toLowerCase() === skill.toLowerCase()))
                      combined.push(skill);
                  }
                  update({
                    projects: projects.map((entry) =>
                      entry.id === project.id ? { ...entry, contribution } : entry,
                    ),
                    skills: combined,
                  });
                }}
              />
              <button
                type="button"
                className="flex items-center gap-2 text-xs text-destructive"
                onClick={() => {
                  setRemoved(project);
                  update({ projects: projects.filter((entry) => entry.id !== project.id) });
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove {project.title || "untitled project"}
              </button>
            </div>
          </details>
        ))}
        {removed && !projects.some((entry) => entry.id === removed.id) && (
          <button
            type="button"
            className="detail-secondary mt-4"
            onClick={() => {
              update({ projects: [...projects, removed] });
              setRemoved(null);
            }}
          >
            <Undo2 className="size-4" aria-hidden />
            Undo removed project
          </button>
        )}
      </section>

      <section
        hidden={active !== 3}
        aria-labelledby="profile-availability-title"
        className="profile-section"
      >
        <SectionHeading
          id="profile-availability-title"
          number="04"
          eyebrow="Set your own pace"
          title="A rhythm that fits your life"
        >
          Time, learning, and practical preferences. These are not organizer requirements.
        </SectionHeading>

        <WeeklyRhythm draft={draft} update={update} errors={errors} />
        <div className="profile-personal-target">
          <Target className="size-5" aria-hidden />
          <TextField
            name="targetDate"
            label="Your target date (optional)"
            hint="A personal target, not an event deadline."
            type="date"
            {...field}
          />
        </div>
        <ChoiceRail
          legend="Learning budget preference"
          className="profile-budget-route"
          value={draft.learningBudget ?? "unknown"}
          onChange={(value) =>
            update({ learningBudget: value as NonNullable<ProfileDraft["learningBudget"]> })
          }
          options={[
            { value: "free", label: "Free resources only", icon: Leaf },
            { value: "paid", label: "Include paid resources", icon: Wallet },
          ]}
        />
        {draft.learningBudget === "paid" && (
          <div className="profile-field-grid">
            <TextField
              name="budgetInput"
              label="Maximum learning budget (optional)"
              type="number"
              min={0}
              max={1000000}
              step="0.01"
              hint="Zero is valid. Blank means no maximum reported."
              {...field}
            />
            <SelectField
              name="currency"
              label="Budget currency"
              {...field}
              options={[
                ["", "Choose currency"],
                ["USD", "USD · US dollar"],
                ["ILS", "ILS · Israeli shekel"],
                ["JOD", "JOD · Jordanian dinar"],
                ["EUR", "EUR · Euro"],
                ["GBP", "GBP · British pound"],
              ]}
            />
          </div>
        )}
        <TextField
          name="learningLanguage"
          label="Preferred learning language"
          hint="For example Arabic or English. Leave blank for unknown."
          {...field}
          maxLength={80}
        />
        <ChoiceRail
          legend="Team status"
          value={draft.entrantType ?? "unknown"}
          onChange={(value) =>
            update({ entrantType: value as NonNullable<ProfileDraft["entrantType"]> })
          }
          unknownLabel="Undecided / not provided"
          options={[
            { value: "solo", label: "Solo", icon: UserRound },
            { value: "team", label: "Already in a team", icon: Users },
          ]}
        />
        {draft.entrantType === "team" && (
          <TextField
            name="teamSizeInput"
            label="Team size, including you"
            hint="Leave blank if the size is not confirmed."
            type="number"
            min={1}
            max={100}
            step="1"
            {...field}
          />
        )}
        <TextField
          name="constraints"
          label="Practical constraints (optional)"
          hint="For example limited equipment, unreliable connectivity, travel, or accessibility needs."
          multiline
          {...field}
        />
      </section>
    </>
  );
}
