import { ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type {
  EvidenceOptInStatus,
  ProfessionalSource,
} from "@/lib/profile/evidence";

// Localized disclosure for document extraction. The matching server gate
// (EvidenceOptIn) is enforced independently of this panel: the panel
// explains and records the per-document opt-in, and the backend refuses
// analysis without a current, content-bound opt-in even if a client never
// shows this UI. This consent is separate from the plan-generation
// acknowledgment; neither covers the other.
export function ExtractionOptInPanel({
  sources,
  statuses,
  busy,
  onOptIn,
  onWithdraw,
}: {
  sources: ProfessionalSource[];
  statuses: Record<string, EvidenceOptInStatus | undefined>;
  busy: boolean;
  onOptIn: (sourceId: string) => void;
  onWithdraw: (sourceId: string) => void;
}) {
  const { t } = useLocale();
  if (!sources.length) return null;
  return (
    <section
      aria-label={t("Document extraction disclosure", "إفصاح استخراج المستندات")}
      className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4"
    >
      <h4 className="flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        {t("Before your documents are sent", "قبل ما تنرسل مستنداتك")}
      </h4>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t(
          "When you analyze, the full extracted text of the selected documents below is sent to Meta AI through the backend to propose professional facts for your review. Your name and email address are not sent. Nothing is confirmed in your profile automatically.",
          "لما تحلّل، النص الكامل المستخرج من المستندات المختارة تحت بينرسل لـMeta AI عبر الباك لاقتراح معلومات مهنية تراجعها. اسمك وبريدك الإلكتروني ما بينرسلوا. وما في إشي بينعتمد بملفك تلقائيًا.",
        )}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t(
          "This permission is per document and recorded on the server. It is separate from the plan-generation acknowledgment; neither one covers the other. If you replace a document, you will be asked again for the new copy. You can withdraw at any time; withdrawal stops future analyses for that document but cannot retract text already sent in an earlier analysis.",
          "هاي الإذن لكل مستند وبتتسجّل على السيرفر. وهي منفصلة عن إقرار إنشاء الخطط؛ ولا وحدة بتغطي التانية. إذا بدّلت مستند، رح نطلب منك من جديد للنسخة الجديدة. بتقدر تسحب الإذن بأي وقت؛ السحب بوقف التحليلات الجاية لهداك المستند بس ما بيقدر يسترجع نص انرسل أصلًا بتحليل سابق.",
        )}
      </p>
      <ul className="mt-3 space-y-2">
        {sources.map((source) => {
          const status = statuses[source.id];
          return (
            <li
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2 text-sm"
            >
              <span>
                <strong>{source.title}</strong>{" "}
                <span className="text-muted-foreground">
                  {status === undefined
                    ? t("Checking permission…", "عم نتحقق من الإذن…")
                    : status.optedIn
                      ? t("Opted in", "مسموح")
                      : t("Not opted in", "مش مسموح")}
                </span>
              </span>
              {status?.optedIn ? (
                <button
                  type="button"
                  className="detail-secondary"
                  disabled={busy}
                  onClick={() => onWithdraw(source.id)}
                >
                  {t("Withdraw", "اسحب الإذن")}
                </button>
              ) : (
                <button
                  type="button"
                  className="detail-primary"
                  disabled={busy || status === undefined}
                  onClick={() => onOptIn(source.id)}
                >
                  {t("Opt in for this document", "اسمح لهدا المستند")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
