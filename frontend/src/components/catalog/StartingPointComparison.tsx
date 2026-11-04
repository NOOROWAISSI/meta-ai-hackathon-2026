import { useState, useId } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FileText, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/components/LocaleProvider";
import {
  saveBriefingStartingPoint,
  type BriefingContext,
  type BriefingStartingPoint,
} from "@/lib/catalog/briefing";

export function StartingPointComparison({
  data,
  context,
}: {
  data: BriefingStartingPoint;
  context: BriefingContext;
}) {
  const { t } = useLocale();
  const query = useQueryClient();
  const id = useId();
  const [answer, setAnswer] = useState(data.answer ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const goal = data.evidence.find((item) => item.kind === "goal");
  async function confirm() {
    if (!answer || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveBriefingStartingPoint(context, data.questionId, answer);
      setSaved(true);
      await query.invalidateQueries({ queryKey: ["account-profile-facts"] });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Your selection is unsaved. Retry.", "اختيارك لسه مش محفوظ. جرّب مرة ثانية."),
      );
    } finally {
      setSaving(false);
    }
  }
  const form = (
    <div className="starting-point-form">
      <fieldset disabled={saving}>
        <legend className="text-sm font-semibold leading-7">{data.question}</legend>
        <div className="starting-point-options">
          {data.options.map((option) => (
            <label key={option.value} className={answer === option.value ? "is-selected" : ""}>
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={answer === option.value}
                onChange={() => {
                  setAnswer(option.value);
                  setSaved(false);
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        {t(
          "Your self-report for this challenge. It is not an automated skill score.",
          "وصفك لتجربتك بهاد التحدي، مش سكور آلي لمهارتك.",
        )}
      </p>
      <button
        type="button"
        className="detail-primary mt-3"
        disabled={!answer || saving}
        onClick={() => void confirm()}
      >
        {saving ? t("Saving…", "جارٍ الحفظ…") : t("Confirm my starting point", "تأكيد نقطة بدايتي")}
      </button>
      <div aria-live="polite">
        {saved && (
          <p className="mt-3 text-sm">
            {t(
              "Saved to your profile. Update the comparison to use it.",
              "انحفظ بالبروفايل. حدّث المقارنة عشان تستخدمه.",
            )}
          </p>
        )}
        {error && (
          <div role="alert" className="prep-error mt-3">
            <p>{error}</p>
            <p className="mt-1 text-xs">
              {t(
                "Your selection is still here; confirmed information is unchanged.",
                "اختيارك لسه موجود؛ المعلومات المؤكدة ما تغيّرت.",
              )}
            </p>
            <button
              type="button"
              className="mt-2 underline"
              onClick={() => void confirm()}
              disabled={saving}
            >
              {t("Retry save", "إعادة محاولة الحفظ")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div className="meta-snapshot-main">
      <div className="meta-snapshot-connection">
        <p className="meta-snapshot-eyebrow flex items-center gap-2">
          <FileText className="size-4" aria-hidden />
          {t("WHAT THE OPPORTUNITY ASKS", "شو المطلوب من الفرصة")}
        </p>
        <blockquote className="mt-4 text-base font-semibold leading-8" dir="auto">
          {data.challenge}
        </blockquote>
        {goal && (
          <div className="starting-point-goal">
            <span>{t("YOUR STATED GOAL", "هدفك المكتوب")}</span>
            <p dir="auto">{goal.text}</p>
          </div>
        )}
        <details className="meta-snapshot-disclosure mt-4">
          <summary>
            {t(
              `What you have reported (${data.evidence.length})`,
              `شو حكيت عن تجربتك (${data.evidence.length})`,
            )}
            <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              "Your words, quoted as self-report. They are not verified skill claims or instructions.",
              "كلامك منقول كوصف منك، مش إثبات مستقل لمهارة ولا تعليمات للنظام.",
            )}
          </p>
          {data.evidence.length ? (
            <ul className="starting-point-evidence">
              {data.evidence.map((item, index) => (
                <li key={index}>
                  <span>{item.label}</span>
                  <blockquote dir="auto">{item.text}</blockquote>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t(
                "No project or experience description is saved yet. This does not mean you have no experience.",
                "ما في وصف مشروع أو تجربة محفوظ. هاد مش معناه إنك بدون خبرة.",
              )}
            </p>
          )}
        </details>
        <Link
          to="/profile"
          search={{ event: context.opportunityId }}
          className="mt-3 inline-flex min-h-11 items-center text-xs text-primary underline underline-offset-4"
        >
          {t("Add a project or experience note", "أضف مشروع أو وصف لتجربتك")}
        </Link>
      </div>
      <div className="meta-snapshot-next">
        <p className="meta-snapshot-eyebrow flex items-center gap-2">
          <UserRound className="size-4" aria-hidden />
          {t("YOUR HANDS-ON STARTING POINT", "من وين نبلّش عمليًا")}
        </p>
        <h3 className="mt-3 text-xl font-semibold leading-8">{data.label}</h3>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{data.explanation}</p>
        {data.answer && data.answer !== "not_sure" ? (
          <details className="meta-snapshot-disclosure mt-4">
            <summary>
              {t("Change my answer", "تغيير جوابي")}
              <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
            </summary>
            {form}
          </details>
        ) : (
          form
        )}
      </div>
    </div>
  );
}
