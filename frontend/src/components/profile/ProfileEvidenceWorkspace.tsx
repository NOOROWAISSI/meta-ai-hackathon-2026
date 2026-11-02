import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Github,
  Linkedin,
  LoaderCircle,
  Sparkles,
  Trash2,
  CheckCheck,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import {
  evidenceService,
  sourceLocation,
  type EvidenceView,
  type ProposedFact,
} from "@/lib/profile/evidence";

type Edit = { selected: boolean; value: string; contribution: string };
export function ProfileEvidenceWorkspace({
  disabled,
  onChanged,
}: {
  disabled: boolean;
  onChanged: () => void;
}) {
  const { t, language } = useLocale();
  const [view, setView] = useState<EvidenceView>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState("cv");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repos, setRepos] = useState<{ name: string; url: string; description: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [edits, setEdits] = useState<Edit[]>([]);
  const draft = view?.workspace.draft;
  const previousDraftId = useRef<string | null>(null);
  const operationLock = useRef(false);
  const retryOperation = useRef<{
    label: string;
    operation: () => Promise<EvidenceView>;
    changesProfile: boolean;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const refresh = () => {
      evidenceService
        .read(abort.signal)
        .then(setView)
        .catch((e) => {
          if (!abort.signal.aborted) setError(String(e.message));
        });
    };
    refresh();
    window.addEventListener("nextstep:account-data", refresh);
    return () => {
      abort.abort();
      window.removeEventListener("nextstep:account-data", refresh);
    };
  }, []);
  useEffect(() => {
    if (previousDraftId.current === (draft?.id ?? null)) return;
    previousDraftId.current = draft?.id ?? null;
    setEdits(
      draft?.output.facts.map((f) => ({
        selected: false,
        value: f.value,
        contribution: "",
      })) ?? [],
    );
  }, [draft]);
  const versions = () => ({
    profileVersion: view!.profileVersion,
    sourcesVersion: view!.workspace.version,
  });
  async function run(label: string, operation: () => Promise<EvidenceView>, changesProfile = true) {
    if (operationLock.current || disabled) return;
    operationLock.current = true;
    retryOperation.current = { label, operation, changesProfile };
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      setView(result);
      if (changesProfile) onChanged();
      setNotice(t("Confirmed saved.", "تم الحفظ."));
      retryOperation.current = null;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Please retry. Your input is preserved.", "جرّب مجددًا؛ مدخلاتك محفوظة."),
      );
    } finally {
      operationLock.current = false;
      setBusy("");
    }
  }
  const locked = disabled || !!busy || !view;
  const stale =
    !!draft &&
    (draft.profileVersion !== view?.profileVersion ||
      draft.sourcesVersion !== view?.workspace.version);
  function patch(index: number, value: Partial<Edit>) {
    setEdits((previous) => previous.map((edit, i) => (i === index ? { ...edit, ...value } : edit)));
  }
  function factLabel(fact: ProposedFact) {
    return fact.basis === "source_statement"
      ? t("Source statement", "تصريح من المصدر")
      : fact.basis === "artifact_observation"
        ? t("Code observation", "ملاحظة من الكود")
        : t("AI inference · needs your review", "استنتاج AI · بحاجة لمراجعتك");
  }
  return (
    <section
      className="glass relative mb-8 overflow-hidden rounded-[2rem] border border-primary/20 p-5 sm:p-8"
      aria-labelledby="professional-evidence-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <div className="relative">
        <span className="text-xs font-semibold uppercase tracking-[.2em] text-primary">
          {t("Your work tells a better story", "شغلك بحكي عنك أكثر")}
        </span>
        <h2 id="professional-evidence-title" className="mt-2 text-2xl font-bold">
          {t("Bring your experience into focus.", "خلّينا نفهم تجربتك بوضوح.")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          {t(
            "Add your CV, selected public code, or LinkedIn information. Review the original passages and choose what becomes part of your profile. Nothing is adopted automatically.",
            "أضف سيرتك، مشاريع عامة بتختارها من GitHub، أو معلومات LinkedIn. راجع المقاطع الأصلية واختار المعلومات اللي بدك تعتمدها بملفك؛ ما بنعتمد اقتراحات تلقائيًا.",
          )}
        </p>
        <ol className="my-6 flex flex-wrap gap-4 border-y border-border py-4 text-sm">
          <li>01 · {t("Add sources", "أضف المصادر")}</li>
          <li>02 · {t("Review extraction", "راجع الاستخراج")}</li>
          <li>03 · {t("Confirm your facts", "اعتمد معلوماتك")}</li>
        </ol>
        {disabled && (
          <p role="status" className="mb-4 text-sm text-amber-500">
            {t(
              "Save or cancel the form changes below before changing sources. Your draft stays intact.",
              "احفظ أو ألغِ تعديلات النموذج تحت قبل تغيير المصادر؛ مسودتك بتضل موجودة.",
            )}
          </p>
        )}
        <fieldset disabled={locked} className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <legend className="sr-only">{t("Add professional sources", "إضافة مصادر مهنية")}</legend>
          <div className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor="professional-kind">
              <FileText className="mb-2 size-5 text-primary" />
              {t("CV or LinkedIn information", "السيرة أو معلومات LinkedIn")}
            </label>
            <select
              id="professional-kind"
              className="profile-input w-full rounded-xl border border-border bg-background p-3"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="cv">CV</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <label className="block text-sm" htmlFor="professional-file">
              {t("Upload PDF or DOCX · maximum 5 MB", "رفع PDF أو DOCX · حتى 5 MB")}
            </label>
            <input
              id="professional-file"
              type="file"
              accept=".pdf,.docx"
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/15 file:p-3 file:text-primary"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    setError(t("Choose a file under 5 MB.", "اختار ملف أقل من 5 MB."));
                    return;
                  }
                  void run("upload", () =>
                    evidenceService.upload(
                      file,
                      kind,
                      view!.profileVersion,
                      view!.workspace.version,
                    ),
                  );
                }
              }}
            />
            {kind === "linkedin" && (
              <>
                <label htmlFor="linkedin-provenance" className="block text-sm">
                  <Linkedin className="inline size-4" />{" "}
                  {t("Profile URL (optional provenance)", "رابط الحساب (اختياري لتوثيق المصدر)")}
                </label>
                <input
                  id="linkedin-provenance"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/…"
                  className="w-full rounded-xl border border-border bg-background p-3"
                />
                <p className="text-xs leading-6 text-muted-foreground">
                  {t(
                    "Paste professional sections or upload a profile export. A URL alone does not grant access to LinkedIn history.",
                    "الصق الأقسام المهنية أو ارفع نسخة من الحساب؛ الرابط لحاله ما بعطينا وصول لتاريخ LinkedIn.",
                  )}
                </p>
              </>
            )}
            <label htmlFor="professional-text" className="block text-sm">
              {t("Or paste professional text", "أو الصق المعلومات المهنية")}
            </label>
            <textarea
              id="professional-text"
              rows={5}
              maxLength={60000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/70 p-3"
            />
            <button
              type="button"
              className="detail-secondary"
              disabled={!text.trim()}
              onClick={() =>
                void run("text", () =>
                  evidenceService.mutate("/text", {
                    kind,
                    title: kind === "cv" ? "CV · provided text" : "LinkedIn · provided text",
                    text,
                    url: url || null,
                    ...versions(),
                  }),
                )
              }
            >
              {t("Add text source", "أضف النص كمصدر")}
            </button>
          </div>
          <div className="space-y-3 lg:border-s lg:border-border lg:ps-6">
            <label htmlFor="github-account" className="block text-sm font-semibold">
              <Github className="mb-2 size-5 text-primary" />
              {t("Choose public GitHub projects", "اختار مشاريع GitHub العامة")}
            </label>
            <div className="flex gap-2">
              <input
                id="github-account"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="GitHub username"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3"
              />
              <button
                type="button"
                className="detail-secondary"
                disabled={!username.trim()}
                onClick={async () => {
                  setBusy("github-list");
                  setError("");
                  try {
                    setRepos(await evidenceService.repositories(username));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                {t("Find", "ابحث")}
              </button>
            </div>
            {!!repos.length && (
              <div className="max-h-48 space-y-2 overflow-auto">
                {repos.map((repo) => (
                  <button
                    type="button"
                    key={repo.url}
                    onClick={() => setRepoUrl(repo.url)}
                    aria-pressed={repoUrl === repo.url}
                    className={`block w-full rounded-xl border p-3 text-start text-sm ${repoUrl === repo.url ? "border-primary bg-primary/15" : "border-border"}`}
                  >
                    <strong>{repo.name}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {repo.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <label htmlFor="github-repository" className="block text-sm">
              {t("Selected repository URL", "رابط المشروع المختار")}
            </label>
            <input
              id="github-repository"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full rounded-xl border border-border bg-background p-3"
            />
            <button
              type="button"
              className="detail-secondary"
              disabled={!repoUrl.trim()}
              onClick={() =>
                void run("github-import", () =>
                  evidenceService.mutate("/github", { url: repoUrl, ...versions() }),
                )
              }
            >
              {t("Import selected code sample", "استورد عينة من المشروع المختار")}
            </button>
            <p className="text-xs leading-6 text-muted-foreground">
              {t(
                "We read a bounded snapshot of README and selected code files at a specific commit. No code is executed. You will confirm your personal contribution; a repository link is not proof of authorship.",
                "بنقرأ README وعينة محدودة من الكود عند commit محدد، بدون تشغيله. أنت بتؤكد مساهمتك الشخصية؛ رابط المشروع مش إثبات ملكية أو كفاءة.",
              )}
            </p>
          </div>
        </fieldset>
        {!!view?.workspace.sources.length && (
          <div className="mt-7 border-t border-border pt-5">
            <h3 className="font-semibold">
              {t("Private sources · review before analysis", "مصادرك الخاصة · راجعها قبل التحليل")}
            </h3>
            <div className="mt-3 divide-y divide-border">
              {view.workspace.sources.map((source) => (
                <div key={source.id} className="py-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      disabled={locked}
                      aria-label={t("Analyze ", "حلل ") + source.title}
                      checked={selected.includes(source.id)}
                      onChange={(e) =>
                        setSelected((previous) =>
                          e.target.checked
                            ? [...previous, source.id]
                            : previous.filter((id) => id !== source.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 font-medium">
                      {source.title}
                      <small className="block text-xs font-normal text-muted-foreground">
                        {source.kind} · {new Date(source.importedAt).toLocaleDateString()}{" "}
                        {source.revision ? "· " + source.revision.slice(0, 8) : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-3 text-muted-foreground hover:text-destructive"
                      disabled={locked}
                      aria-label={t("Delete ", "احذف ") + source.title}
                      onClick={() => {
                        if (
                          window.confirm(
                            t(
                              "Delete the private source and its retained quotations? Adopted profile facts and plan progress remain editable and preserved.",
                              "حذف المصدر الخاص واقتباساته؟ معلومات البروفايل اللي اعتمدتها وتقدّم الخطط بضلوا محفوظين وقابلين للتعديل.",
                            ),
                          )
                        )
                          void run("delete", () =>
                            evidenceService.mutate("/" + source.id, versions(), "DELETE"),
                          );
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-primary">
                      {t("Inspect extracted text & source limits", "شوف النص وحدود المصدر")}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {source.warnings.map((w) => (
                        <p key={w} className="text-xs text-muted-foreground">
                          {w}
                        </p>
                      ))}
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {t("Original source", "المصدر الأصلي")}
                        </a>
                      )}
                      {source.chunks.map((chunk) => (
                        <div key={chunk.id}>
                          <strong className="text-xs">{chunk.locator}</strong>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background/70 p-3 text-xs">
                            {chunk.text}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                checked={consent}
                disabled={locked}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                {t(
                  "I reviewed the selected text and consent to sending it to Meta through the backend to propose professional facts. Nothing is confirmed automatically.",
                  "راجعت النص المختار وبوافق ينرسل لـMeta عبر الباك لاقتراح معلومات مهنية. ما في اعتماد تلقائي لأي معلومة.",
                )}
              </span>
            </label>
            <button
              type="button"
              className="detail-primary mt-4"
              disabled={locked || !consent || !selected.length || selected.length > 3}
              onClick={() =>
                void run(
                  "analysis",
                  () =>
                    evidenceService.mutate("/analyze", {
                      ...versions(),
                      sourceIds: selected,
                      consent,
                      language,
                    }),
                  false,
                )
              }
            >
              <Sparkles className="size-4" />
              {t("Analyze selected sources", "حلل المصادر المختارة")}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "Select 1–3 sources. Imported files are processed locally on the server; only extracted text is stored. Avoid identity documents and confidential code.",
                "اختار 1–3 مصادر. الملف بنقرأ على السيرفر وبنخزّن النص المستخرج فقط. تجنّب أوراق الهوية والكود السري.",
              )}
            </p>
          </div>
        )}
        {draft && (
          <div className="mt-8 border-t border-primary/20 pt-6">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <CheckCheck className="size-5 text-primary" />
              {t("Your review comes first", "مراجعتك أولًا")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "Select, edit and confirm only what accurately describes you. Quotations support the proposal, not independent verification of your ability.",
                "اختار وعدّل واعتمد بس اللي بوصفك بدقة. الاقتباس بس بوضح مصدر الاقتراح، مش تقييم مستقل لقدرتك.",
              )}
            </p>
            {stale && (
              <p role="alert">
                {t(
                  "This draft is outdated. Refresh and analyze again.",
                  "المسودة قديمة؛ حدّث وحلل مجددًا.",
                )}
              </p>
            )}
            {draft.output.facts.map((fact, index) => (
              <div key={index} className="my-4 border-s-2 border-primary/30 ps-4">
                <label className="flex gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    disabled={locked || stale}
                    checked={edits[index]?.selected ?? false}
                    onChange={(e) => patch(index, { selected: e.target.checked })}
                  />
                  {fact.kind} · {factLabel(fact)}
                </label>
                <label className="sr-only" htmlFor={`evidence-fact-${index}`}>
                  {t("Proposed fact ", "المعلومة المقترحة ")}
                  {index + 1}
                </label>
                <textarea
                  id={`evidence-fact-${index}`}
                  disabled={locked}
                  value={edits[index]?.value ?? fact.value}
                  maxLength={fact.kind === "skill" ? 100 : 1500}
                  onChange={(e) => patch(index, { value: e.target.value })}
                  rows={fact.kind === "skill" ? 1 : 3}
                  className="mt-3 w-full rounded-xl border border-border bg-background/70 p-3 text-sm"
                />
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{fact.explanation}</p>
                {fact.kind === "project" && (
                  <>
                    <label
                      className="mt-3 block text-sm"
                      htmlFor={`evidence-contribution-${index}`}
                    >
                      {t(
                        "What did you personally contribute? Required to adopt this project.",
                        "شو كانت مساهمتك الشخصية؟ مطلوبة لاعتماد المشروع.",
                      )}
                    </label>
                    <textarea
                      id={`evidence-contribution-${index}`}
                      maxLength={1500}
                      disabled={locked}
                      value={edits[index]?.contribution ?? ""}
                      onChange={(e) => patch(index, { contribution: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-border bg-background/70 p-3 text-sm"
                    />
                  </>
                )}
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-primary">
                    {t("Original proposal & evidence", "الاقتراح الأصلي ومصادره")}
                  </summary>
                  <p className="my-3 whitespace-pre-wrap">{fact.value}</p>
                  {fact.references.map((reference, i) => {
                    const source = view.workspace.sources.find((s) => s.id === reference.sourceId);
                    return (
                      <blockquote
                        key={i}
                        className="my-3 border-s border-primary/40 ps-3 text-xs leading-6"
                      >
                        <strong>
                          {source?.title} · {sourceLocation(source, reference.chunkId)}
                        </strong>
                        <p className="whitespace-pre-wrap">“{reference.quote}”</p>
                      </blockquote>
                    );
                  })}
                </details>
              </div>
            ))}
            {!!draft.output.questions.length && (
              <aside className="my-4 rounded-xl bg-primary/5 p-4">
                <h4 className="font-semibold">
                  {t("Information worth clarifying", "معلومات بدها توضيح")}
                </h4>
                <ul className="mt-2 list-disc space-y-2 ps-5 text-sm">
                  {draft.output.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </aside>
            )}
            <button
              type="button"
              className="detail-primary"
              disabled={
                locked ||
                stale ||
                !edits.some((e) => e.selected) ||
                edits.some(
                  (e, i) =>
                    e.selected &&
                    (!e.value.trim() ||
                      (draft.output.facts[i]?.kind === "project" && !e.contribution.trim())),
                )
              }
              onClick={() =>
                void run("accept", () =>
                  evidenceService.mutate("/accept", {
                    draftId: draft.id,
                    ...versions(),
                    facts: edits.flatMap((e, index) =>
                      e.selected
                        ? [{ index, value: e.value.trim(), contribution: e.contribution.trim() }]
                        : [],
                    ),
                  }),
                )
              }
            >
              <ShieldCheck className="size-4" />
              {t("Confirm selected facts in my profile", "اعتمد المعلومات المختارة بملفي")}
            </button>
          </div>
        )}
        {!!view?.workspace.confirmed.length && (
          <details className="mt-6 border-t border-border pt-4 text-sm">
            <summary className="cursor-pointer font-medium">
              {t("Previously confirmed facts", "المعلومات المعتمدة سابقًا")} ·{" "}
              {view.workspace.confirmed.length}
            </summary>
            <ul className="mt-3 space-y-3">
              {view.workspace.confirmed.map((f) => (
                <li key={f.id}>
                  <strong>{f.kind}</strong> · {f.value}
                  {f.contribution && <p className="text-muted-foreground">{f.contribution}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {t(
                "Edit adopted skills and projects in the form below. Removing a source does not erase adopted facts or completed tasks.",
                "عدّل المهارات والمشاريع المعتمدة بالنموذج تحت. حذف المصدر ما بحذف معلومات اعتمدتها أو مهام خلصتها.",
              )}
            </p>
          </details>
        )}
        {busy && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            {t(
              "Working… your confirmed information is preserved.",
              "جارٍ العمل… معلوماتك المعتمدة محفوظة.",
            )}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-primary">
            {notice}
          </p>
        )}
        {error && (
          <div role="alert" className="mt-4 text-sm text-destructive">
            <p>{error}</p>
            <button
              type="button"
              className="me-4 mt-2 underline"
              disabled={locked}
              onClick={() => {
                const retry = retryOperation.current;
                if (retry) void run(retry.label, retry.operation, retry.changesProfile);
              }}
            >
              {t("Retry last action", "أعد آخر عملية")}
            </button>
            <button
              type="button"
              className="mt-2 underline"
              disabled={!!busy}
              onClick={async () => {
                try {
                  setView(await evidenceService.read());
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t(
                "Refresh saved sources; then retry your action",
                "حدّث المصادر المحفوظة وجرّب العملية مجددًا",
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
