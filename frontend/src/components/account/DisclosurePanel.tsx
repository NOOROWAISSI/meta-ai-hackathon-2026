import { useEffect, useId, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Shown at the generation action when the server reports that the current
// data-sharing disclosure has not been acknowledged. Generation stays blocked
// until the student acknowledges; declining sends nothing and saves nothing.
export function DisclosurePanel({
  busy,
  onAcknowledge,
  onDecline,
}: {
  busy?: boolean;
  onAcknowledge: () => void;
  onDecline: () => void;
}) {
  const { t } = useLocale();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const sent: Array<[string, string]> = [
    ["Your goals", "أهدافك"],
    [
      "Your background, project experience, and preparation notes, including system readings you accepted",
      "خلفيتك وخبرتك في المشاريع وملاحظات التحضير، بما في ذلك القراءات التي قبلتها",
    ],
    ["The skills you reported and your constraints", "المهارات التي أبلغت عنها وقيودك"],
    ["Your available hours per week", "ساعاتك المتاحة أسبوعيًا"],
    ["Your current plan tasks", "مهام خطتك الحالية"],
    [
      "The opportunity's published requirements and reviewed resources",
      "المتطلبات المنشورة للفرصة والموارد المراجعة",
    ],
  ];
  return (
    <section
      role="region"
      aria-labelledby={headingId}
      className="mt-6 rounded-2xl border border-border bg-background/60 p-5"
    >
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-lg font-bold outline-none">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        {t("How your information is used to generate a draft", "كيف تُستخدم معلوماتك لإنشاء مسودة")}
      </h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {t(
          "Draft generation is done by Meta AI, an external provider. When you generate, this app sends the following to Meta so it can prepare your draft:",
          "تتم إنشاء المسودات بواسطة Meta AI، وهو مزوّد خارجي. عند الإنشاء، يرسل هذا التطبيق المعلومات التالية إلى Meta حتى يتمكن من إعداد مسودتك:",
        )}
      </p>
      <ul className="mt-3 list-disc space-y-1 ps-5 text-sm leading-6">
        {sent.map(([en, ar]) => (
          <li key={en}>{t(en, ar)}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {t(
          "Your name, email address, age, enrollment status, where you live, and team details are never sent. They are used only on this server to check requirements. Resource links are not sent either.",
          "لا تُرسل أبدًا اسمك أو بريدك الإلكتروني أو عمرك أو حالة التحاقك أو مكان إقامتك أو تفاصيل فريقك. تُستخدم هذه المعلومات فقط على هذا الخادم للتحقق من المتطلبات. ولا تُرسل روابط الموارد أيضًا.",
        )}
      </p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        {t(
          "You can decline. If you decline, no draft is generated and nothing is sent. You can withdraw this acknowledgment at any time from this page, and generation will stop until you acknowledge again. Withdrawing stops future sharing; it does not delete information already sent in earlier generations.",
          "يمكنك الرفض. إذا رفضت، لن تُنشأ أي مسودة ولن يُرسل أي شيء. ويمكنك سحب هذا الإقرار في أي وقت من هذه الصفحة، وسيتوقف الإنشاء حتى تقرّ من جديد. يوقف السحب المشاركة المستقبلية؛ ولا يحذف المعلومات التي أُرسلت بالفعل في عمليات إنشاء سابقة.",
        )}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="detail-primary" disabled={busy} onClick={onAcknowledge}>
          {t("I understand, generate my draft", "فهمت، أنشئ مسودتي")}
        </button>
        <button type="button" className="detail-secondary" disabled={busy} onClick={onDecline}>
          {t("Not now", "ليس الآن")}
        </button>
      </div>
    </section>
  );
}
