import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileCheck2, LoaderCircle, Sparkles, MoveRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  evidenceService,
  sourceLocation,
  type EvidenceView,
  type InsightView,
} from "@/lib/profile/evidence";

export function EvidenceOpportunityInsight({ opportunityId }: { opportunityId: string }) {
  const { t, language } = useLocale();
  const auth = useAuth();
  const userId = auth?.user?.id;
  const [view, setView] = useState<EvidenceView>();
  const [insight, setInsight] = useState<InsightView>();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionSaved, setCorrectionSaved] = useState(false);
  const correctionLock = useRef(false);
  const generation = useRef(0);
  const contextEpoch = useRef(0);
  useEffect(() => {
    contextEpoch.current++;
    const epoch = contextEpoch;
    let active = true;
    const requestGeneration = generation;
    const controller = new AbortController();
    const refresh = () => {
      const ticket = ++requestGeneration.current;
      if (userId) {
        evidenceService
          .read(controller.signal)
          .then((data) => {
            if (active && ticket === requestGeneration.current) setView(data);
          })
          .catch((e) => {
            if (active && !controller.signal.aborted) setError(e.message);
          });
        evidenceService
          .savedComparison(opportunityId, language, controller.signal)
          .then((saved) => {
            if (active && ticket === requestGeneration.current && saved) setInsight(saved);
          })
          .catch((e) => {
            if (active && !controller.signal.aborted) setError(e.message);
          });
      }
    };
    setInsight(undefined);
    setView(undefined);
    setConsent(false);
    setAnswers({});
    setShowCorrection(false);
    setCorrectionText("");
    setCorrectionSaved(false);
    setError("");
    setBusy(false);
    correctionLock.current = false;
    refresh();
    window.addEventListener("nextstep:account-data", refresh);
    return () => {
      active = false;
      epoch.current++;
      requestGeneration.current++;
      controller.abort();
      window.removeEventListener("nextstep:account-data", refresh);
    };
  }, [userId, opportunityId, language]);
  const outdated =
    !!insight &&
    (insight.outdated ||
      !view ||
      insight.profileVersion !== view.profileVersion ||
      insight.sourcesVersion !== view.workspace.version);
  async function compare() {
    if (!view || busy || !consent) return;
    const epoch = contextEpoch.current;
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    setCorrectionSaved(false);
    try {
      const result = await evidenceService.compare(opportunityId, view, language);
      if (ticket === generation.current) setInsight(result);
    } catch (e) {
      if (ticket === generation.current) setError((e as Error).message);
    } finally {
      if (epoch === contextEpoch.current) setBusy(false);
    }
  }
  async function confirmAnswer(question: string) {
    if (!view || busy || outdated || !answers[question]?.trim()) return;
    const epoch = contextEpoch.current;
    setBusy(true);
    setError("");
    try {
      const saved = await evidenceService.answer(
        opportunityId,
        view,
        language,
        question,
        answers[question]!.trim(),
      );
      if (epoch !== contextEpoch.current) return;
      setView(saved);
      setAnswers((previous) => ({ ...previous, [question]: "" }));
    } catch (failure) {
      if (epoch === contextEpoch.current) setError((failure as Error).message);
    } finally {
      if (epoch === contextEpoch.current) setBusy(false);
    }
  }
  async function saveCorrection() {
    if (!view || busy || outdated || correctionLock.current || !correctionText.trim()) return;
    const epoch = contextEpoch.current;
    correctionLock.current = true;
    setBusy(true);
    setError("");
    setCorrectionSaved(false);
    try {
      const updated = await evidenceService.correctExperience(
        opportunityId,
        view,
        language,
        correctionText.trim(),
      );
      if (epoch !== contextEpoch.current) return;
      setView(updated);
      setShowCorrection(false);
      setCorrectionText("");
      setCorrectionSaved(true);
    } catch (failure) {
      if (epoch === contextEpoch.current) setError((failure as Error).message);
    } finally {
      if (epoch === contextEpoch.current) {
        correctionLock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section
      aria-labelledby="evidence-insight-title"
      className="border-y border-primary/15 py-6"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-1 size-6 text-primary" aria-hidden />
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">
            Meta · {t("Evidence-informed explanation", "تحليل مبني على معلوماتك")}
          </p>
          <h2 id="evidence-insight-title" className="mt-2 text-xl font-bold">
            {t("Where your work meets this opportunity.", "كيف تجربتك بتلتقي مع هاي الفرصة.")}
          </h2>
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
        {t(
          "A reasoned comparison of your confirmed experience and contribution with the actual challenge, deliverables and goals. Unreported experience remains unknown. Participation conditions are checked separately.",
          "مقارنة بتشرح شو من تجربتك ومساهمتك المعتمدة بينفع بهاي الفرصة، شو الجديد فيها، وشو بدك تحضّر. التجربة اللي ما حكيت عنها بتضل مجهولة، وشروط المشاركة إلها فحص منفصل.",
        )}
      </p>
      {!auth?.user ? (
        <Link to="/profile" search={{ event: opportunityId }} className="detail-secondary mt-4">
          {t("Sign in & describe your experience", "ادخل وأضف تجربتك")}
        </Link>
      ) : (
        <>
          {!view?.workspace.confirmed.length && (
            <div className="my-4 border-s-2 border-primary/40 ps-4 text-sm leading-7">
              <p>
                {t(
                  "For a grounded comparison, add a CV or selected project sources and confirm what you personally did. A matching AI tag alone cannot tell us whether a challenge stretches your experience.",
                  "عشان المقارنة تكون إلها معنى، أضف سيرتك أو مصادر مشاريعك واعتمد شو عملت بنفسك. تطابق كلمة AI لحالها ما بوضح إذا التحدي مناسب لتجربتك أو بضيفلك إشي.",
                )}
              </p>
              <Link
                to="/profile"
                search={{ event: opportunityId }}
                className="mt-3 inline-flex items-center gap-2 font-medium text-primary"
              >
                {t("Add and review my experience", "أضف وراجع تجربتي")}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}
          <label className="mt-5 flex max-w-3xl items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy}
            />
            <span>
              {t(
                "Use Meta through the backend to compare my confirmed profile facts and their supporting passages with this opportunity. This is AI interpretation, not verified ability or an eligibility decision.",
                "بوافق Meta يقارن معلومات ملفي المعتمدة والمقاطع الداعمة إلها بالفرصة عبر الباك. هاد تفسير AI، مش تقييم كفاءة موثّق أو قرار أهلية.",
              )}
            </span>
          </label>
          <button
            type="button"
            className="detail-primary mt-4"
            disabled={!view || busy || !consent}
            onClick={() => void compare()}
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {busy
              ? t("Reading the context…", "جارٍ قراءة السياق…")
              : t(
                  insight ? "Update my comparison" : "Explain this opportunity for me",
                  insight ? "حدّث مقارنتي" : "اشرحلي الفرصة على أساس تجربتي",
                )}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}{" "}
          <span>
            {t(
              "Your sources and plans are unchanged. Retry when ready.",
              "مصادرك وخططك ما تغيّرت؛ جرّب مجددًا.",
            )}
          </span>
        </p>
      )}
      {outdated && (
        <p role="status" className="mt-4 text-sm text-amber-500">
          {t(
            "Outdated explanation · your profile, sources or recommendation method changed. Update the comparison first.",
            "تحليل قديم · الملف أو المصادر أو طريقة التوصية تغيّرت؛ حدّث المقارنة أولًا.",
          )}
        </p>
      )}
      {insight && (
        <div className="mt-7 space-y-7" aria-busy={busy}>
          {insight.analysis.recommendation && (
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-cyan-400/10 to-violet-500/10 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {t("My recommendation for you", "توصيتي إلك")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "Based on your current profile · a recommendation you can correct",
                  "حسب ملفك الحالي · توصية بتقدر تصحّحها",
                )}
              </p>
              <h3 className="mt-2 text-xl font-bold">
                {
                  {
                    recommended: t("Worth pursuing now", "بنصحك فيها هسا"),
                    prepare_first: t("Prepare this foundation first", "حضّر هاد الأساس أولًا"),
                    already_covered: t(
                      "Much of this repeats your existing work",
                      "غالبًا بتكرر إشي بتعرفه",
                    ),
                    not_aligned: t(
                      "Not the best next step for your goal",
                      "مش أفضل خطوة لهدفك الحالي",
                    ),
                    needs_clarification: t(
                      "One clarification before deciding",
                      "بدنا توضيح قبل القرار",
                    ),
                  }[insight.analysis.recommendation.decision]
                }
              </h3>
              <p className="mt-3 text-sm leading-7">{insight.analysis.recommendation.reason}</p>
              <dl className="mt-5 grid gap-5 border-t border-primary/15 pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold text-primary">
                    {t("What would you gain?", "شو رح تضيفلك؟")}
                  </dt>
                  <dd className="mt-2 text-sm leading-7">
                    {insight.analysis.recommendation.benefit}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-primary">
                    {t("Your next move", "شو تعمل هسا؟")}
                  </dt>
                  <dd className="mt-2 text-sm leading-7">
                    {insight.analysis.recommendation.nextStep}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="detail-secondary mt-4"
                disabled={busy || outdated}
                aria-expanded={showCorrection}
                onClick={() => {
                  setShowCorrection((value) => !value);
                  setCorrectionSaved(false);
                }}
              >
                {t("I already know this subject", "بعرف هالموضوع أصلًا")}
              </button>
              {showCorrection && (
                <div className="mt-4 border-t border-primary/15 pt-4">
                  <label
                    htmlFor="existing-subject-experience"
                    className="block text-sm font-medium"
                  >
                    {t(
                      "What have you already learned or personally built in this subject?",
                      "شو متعلّم أو شو بنيت بنفسك بهاد الموضوع؟",
                    )}
                  </label>
                  <textarea
                    id="existing-subject-experience"
                    rows={3}
                    maxLength={800}
                    value={correctionText}
                    disabled={busy}
                    onChange={(event) => setCorrectionText(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background/70 p-3 text-sm"
                  />
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {t(
                      "A short example is enough. This records your own experience; it does not mark every topic mastered or any participation requirement satisfied.",
                      "مثال مختصر بكفي. بنحفظ وصفك لتجربتك؛ مش معناته إنك أتقنت كل المواضيع أو استوفيت شروط المشاركة.",
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="detail-primary"
                      disabled={busy || !correctionText.trim()}
                      onClick={() => void saveCorrection()}
                    >
                      {t("Confirm my experience", "اعتمد تجربتي")}
                    </button>
                    <button
                      type="button"
                      className="detail-secondary"
                      disabled={busy}
                      onClick={() => setShowCorrection(false)}
                    >
                      {t("Cancel", "إلغاء")}
                    </button>
                  </div>
                </div>
              )}
              {correctionSaved && (
                <p role="status" className="mt-3 text-sm text-primary">
                  {t(
                    "Experience confirmed. Update my comparison to reconsider the recommendation. Your plan and completed tasks are preserved.",
                    "تم اعتماد تجربتك. اضغط حدّث مقارنتي عشان يعيد النظر بالتوصية. خطتك والمهام المكتملة محفوظة.",
                  )}
                </p>
              )}
              {!!insight.analysis.recommendation.evidenceIds.length && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-primary">
                    {t("Which work supports this recommendation?", "على أي شغل مبنية التوصية؟")}
                  </summary>
                  <ul className="mt-3 space-y-3">
                    {insight.analysis.recommendation.evidenceIds.map((id) => {
                      const fact = (view?.currentFacts ?? view?.workspace.confirmed)?.find(
                        (item) => item.id === id,
                      );
                      return fact ? (
                        <li key={id} className="border-s border-primary/30 ps-3 leading-6">
                          <p>{fact.value}</p>
                          {fact.contribution && (
                            <p className="text-muted-foreground">{fact.contribution}</p>
                          )}
                        </li>
                      ) : null;
                    })}
                  </ul>
                </details>
              )}
            </div>
          )}
          {view && view.workspace.sources.length > 0 && view.workspace.confirmed.length === 0 && (
            <p role="status" className="text-sm text-amber-500">
              {t(
                "Your files are uploaded, but no extracted facts have been confirmed yet. Review them in Profile to use that experience in this recommendation.",
                "ملفاتك مرفوعة، بس لسه ما اعتمدت معلومات مستخرجة منها. راجعها في Profile عشان تدخل تجربتك منها بهاي التوصية.",
              )}
            </p>
          )}
          <details open={!insight.analysis.recommendation} className="space-y-5">
            <summary className="cursor-pointer text-sm font-semibold text-primary">
              {t("See the reasoning and preparation details", "شوف الأسباب وتفاصيل التحضير")}
            </summary>
            <div className="max-w-4xl text-base leading-8">
              <p className="whitespace-pre-line">{insight.analysis.summary}</p>
            </div>
            <div className="grid gap-7 md:grid-cols-2">
              {[
                {
                  title: t("What transfers from your experience", "شو بينتقل من تجربتك"),
                  sections: insight.analysis.connections,
                  tone: "border-cyan-400/50",
                },
                {
                  title: t("New work & unknowns", "الشغل الجديد والمجهول"),
                  sections: insight.analysis.gaps,
                  tone: "border-violet-400/50",
                },
              ].map((group) => (
                <div key={group.title}>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
                    <FileCheck2 className="size-4 text-primary" />
                    {group.title}
                  </h3>
                  <div className="space-y-5">
                    {group.sections.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t(
                          "No supported conclusions were returned for this section.",
                          "ما رجع استنتاج مدعوم لهاد القسم.",
                        )}
                      </p>
                    )}
                    {group.sections.map((section, index) => (
                      <article key={index} className={`border-s-2 ps-4 ${group.tone}`}>
                        <h4 className="font-semibold">{section.title}</h4>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                          {section.explanation}
                        </p>
                        {section.evidenceIds.length > 0 && (
                          <details className="mt-3 text-xs">
                            <summary className="cursor-pointer text-primary">
                              {t("Why this conclusion?", "على شو مبني الاستنتاج؟")}
                            </summary>
                            {section.evidenceIds.map((id) => {
                              const fact = (view?.currentFacts ?? view?.workspace.confirmed)?.find(
                                (f) => f.id === id,
                              );
                              return fact ? (
                                <div key={id} className="mt-3 rounded-xl bg-primary/5 p-3">
                                  <strong>{fact.value}</strong>
                                  {fact.contribution && (
                                    <p className="mt-1 leading-6">{fact.contribution}</p>
                                  )}
                                  {fact.references.map((reference, i) => {
                                    const source = view?.workspace.sources.find(
                                      (s) => s.id === reference.sourceId,
                                    );
                                    return (
                                      <blockquote
                                        key={i}
                                        className="mt-3 border-s border-border ps-3 leading-6"
                                      >
                                        <span className="text-muted-foreground">
                                          {source?.title ?? t("Source removed", "المصدر محذوف")} ·{" "}
                                          {sourceLocation(source, reference.chunkId)}
                                        </span>
                                        <p>“{reference.quote}”</p>
                                      </blockquote>
                                    );
                                  })}
                                </div>
                              ) : null;
                            })}
                          </details>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!!insight.analysis.preparationPriorities.length && (
              <div className="rounded-2xl bg-gradient-to-br from-cyan-400/10 via-primary/5 to-violet-500/10 p-5">
                <h3 className="font-bold">
                  {t("A focused preparation direction", "اتجاه تحضير إله معنى")}
                </h3>
                <ol className="mt-4 space-y-4">
                  {insight.analysis.preparationPriorities.map((priority, index) => (
                    <li key={index} className="flex gap-4">
                      <span className="text-xl font-light text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="text-sm leading-7">{priority}</p>
                    </li>
                  ))}
                </ol>
                <Link
                  to="/plans"
                  search={{ event: opportunityId }}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  {t("Review preparation setup", "راجع إعداد التحضير")}
                  <MoveRight className="size-4 rtl:rotate-180" />
                </Link>
              </div>
            )}
          </details>
          {!!insight.analysis.questions.length && (
            <details
              open={insight.analysis.recommendation?.decision === "needs_clarification"}
              className="border-t border-border pt-4"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {t("Questions that could improve this comparison", "أسئلة بتساعد تدقّق المقارنة")} ·{" "}
                {insight.analysis.questions.length}
              </summary>
              <ul className="mt-3 list-disc space-y-3 ps-5 text-sm leading-7 text-muted-foreground">
                {insight.analysis.questions.map((q) => (
                  <li key={q}>
                    <label className="block font-medium">
                      {q}
                      <textarea
                        aria-label={q}
                        rows={3}
                        maxLength={Math.max(1, 980 - q.length)}
                        value={answers[q] ?? ""}
                        disabled={busy || outdated}
                        onChange={(event) =>
                          setAnswers((previous) => ({ ...previous, [q]: event.target.value }))
                        }
                        className="mt-2 block w-full rounded-xl border border-border bg-background/70 p-3 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      className="detail-secondary mt-2"
                      disabled={busy || outdated || !answers[q]?.trim()}
                      onClick={() => void confirmAnswer(q)}
                    >
                      {t("Confirm answer", "اعتمد الإجابة")}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "Your answer is saved as your own statement. Then choose Update my comparison to reconsider the recommendation; no model call runs automatically.",
                  "إجابتك بتنحفظ كتصريح منك. بعدها اضغط حدّث مقارنتي عشان يعيد النظر بالتوصية؛ ما بنعمل طلب AI تلقائي.",
                )}
              </p>
              <Link
                to="/profile"
                search={{ event: opportunityId }}
                className="mt-4 inline-block text-sm text-primary underline"
              >
                {t("Clarify my profile", "وضّح معلوماتي")}
              </Link>
            </details>
          )}
          <p className="text-xs text-muted-foreground">
            {t(
              "AI interpretation of student-confirmed information · verify important conclusions against the original sources.",
              "تفسير AI لمعلومات اعتمدها الطالب · راجع الاستنتاجات المهمة مع المصادر الأصلية.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
