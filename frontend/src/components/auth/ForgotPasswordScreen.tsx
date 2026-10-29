import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { authService, safeReturn } from "@/lib/auth/service";
import { AuthFrame } from "./AuthFrame";

export function ForgotPasswordScreen({ returnTo }: { returnTo?: string }) {
  const { language, t } = useLocale();
  const [step, setStep] = useState<"email" | "code" | "password" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [challenge, setChallenge] = useState("");
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  async function requestCode() {
    const result = await authService.requestPasswordCode(email.trim(), language);
    setChallenge(result.challengeId);
    setResendAt(Date.now() + result.resendAfterSeconds * 1000);
    setNow(Date.now());
    setCode("");
    setStep("code");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (step === "email") await requestCode();
      else if (step === "code") {
        const grant = await authService.verifyPasswordCode(challenge, code);
        setToken(grant);
        setCode("");
        setStep("password");
      } else if (step === "password") {
        if (password !== confirm)
          throw new Error(t("Passwords do not match.", "كلمتا المرور غير متطابقتين."));
        await authService.resetPassword(challenge, token, password);
        setToken("");
        setPassword("");
        setConfirm("");
        setStep("done");
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Could not finish. Please retry.", "تعذّرت العملية. حاول مجددًا."),
      );
    } finally {
      setBusy(false);
    }
  }
  const Icon =
    step === "email" ? Mail : step === "code" ? ShieldCheck : step === "done" ? Check : KeyRound;
  return (
    <AuthFrame>
      <div
        className="mb-6 flex items-center gap-2"
        aria-label={t("Recovery steps", "خطوات الاستعادة")}
      >
        {["email", "code", "password"].map((value, index) => (
          <span
            key={value}
            aria-current={step === value ? "step" : undefined}
            className={`h-1 flex-1 rounded-full ${index <= ["email", "code", "password", "done"].indexOf(step) ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
      <div className="mb-5 grid size-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <h1 tabIndex={-1} ref={heading} className="text-3xl font-bold tracking-tight outline-none">
        {step === "email"
          ? t("Forgot your password?", "نسيت كلمة المرور؟")
          : step === "code"
            ? t("Check your inbox.", "افتح إيميلك.")
            : step === "password"
              ? t("A fresh start.", "كلمة مرور جديدة.")
              : t("You’re all set.", "هيك تمام.")}
      </h1>
      <p className="mb-7 mt-3 text-sm leading-6 text-muted-foreground">
        {step === "email"
          ? t(
              "Enter your account email to request a six-digit recovery code.",
              "اكتب إيميل حسابك لنرسل رمز استعادة من 6 أرقام.",
            )
          : step === "code"
            ? t(
                "If this email has a password account, a code has been sent. Check spam too. It expires in 10 minutes.",
                "إذا الإيميل مرتبط بحساب وكلمة مرور، تم إرسال رمز. افحص البريد المزعج كمان. الرمز صالح 10 دقائق.",
              )
            : step === "password"
              ? t(
                  "Choose a password with at least 12 characters. Your existing sessions will be signed out.",
                  "اختار كلمة مرور من 12 حرفًا على الأقل. سيتم تسجيل خروج الجلسات السابقة.",
                )
              : t(
                  "Your password has been changed. Sign in with your new password.",
                  "تغيّرت كلمة المرور. ادخل باستخدام كلمتك الجديدة.",
                )}
      </p>
      {step !== "email" && step !== "done" && (
        <p
          dir="ltr"
          className="mb-5 break-all rounded-xl border border-border bg-background/40 px-3 py-2 text-center text-sm"
        >
          {email}
        </p>
      )}
      {step === "done" ? (
        <Link
          to="/login"
          search={{ returnTo: safeReturn(returnTo) }}
          className="detail-primary min-h-12 w-full"
        >
          {t("Back to sign in", "العودة لتسجيل الدخول")}
        </Link>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {step === "email" && (
            <div>
              <label htmlFor="recovery-email" className="mb-2 block text-sm font-semibold">
                {t("Email address", "البريد الإلكتروني")}
              </label>
              <input
                id="recovery-email"
                dir="ltr"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                className="prep-input w-full"
              />
            </div>
          )}
          {step === "code" && (
            <div>
              <label htmlFor="recovery-code" className="mb-2 block text-sm font-semibold">
                {t("Verification code", "رمز التحقق")}
              </label>
              <input
                id="recovery-code"
                dir="ltr"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                required
                minLength={6}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
                disabled={busy}
                className="prep-input w-full text-center !text-2xl tracking-[0.35em]"
              />
            </div>
          )}
          {step === "password" && (
            <>
              <div>
                <label htmlFor="recovery-password" className="mb-2 block text-sm font-semibold">
                  {t("New password", "كلمة المرور الجديدة")}
                </label>
                <div className="relative">
                  <input
                    id="recovery-password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    className="prep-input w-full !pe-12"
                  />
                  <button
                    type="button"
                    aria-label={
                      show
                        ? t("Hide password", "إخفاء كلمة المرور")
                        : t("Show password", "إظهار كلمة المرور")
                    }
                    aria-pressed={show}
                    className="absolute end-1 top-0 grid size-11 place-items-center rounded-xl"
                    onClick={() => setShow((value) => !value)}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="recovery-confirm" className="mb-2 block text-sm font-semibold">
                  {t("Confirm new password", "تأكيد كلمة المرور")}
                </label>
                <input
                  id="recovery-confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={busy}
                  className="prep-input w-full"
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="prep-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="detail-primary min-h-12 w-full">
            {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {busy
              ? t("Please wait…", "لحظة…")
              : step === "email"
                ? t("Send verification code", "إرسال رمز التحقق")
                : step === "code"
                  ? t("Verify code", "تأكيد الرمز")
                  : t("Save new password", "حفظ كلمة المرور")}
          </button>
          {step === "code" && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="min-h-11 rounded-lg text-primary disabled:text-muted-foreground"
                disabled={busy || remaining > 0}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await requestCode();
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : t("Resend failed.", "تعذّرت إعادة الإرسال."),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {remaining > 0
                  ? t(`Resend in ${remaining}s`, `إعادة الإرسال بعد ${remaining}ث`)
                  : t("Resend code", "إعادة إرسال الرمز")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-lg text-muted-foreground underline"
                onClick={() => {
                  setStep("email");
                  setError("");
                  setToken("");
                }}
              >
                {t("Change email", "تغيير الإيميل")}
              </button>
            </div>
          )}
        </form>
      )}
      {step === "email" && (
        <p className="mt-5 text-center text-xs leading-6 text-muted-foreground">
          {t(
            "Signed up with Google? Return to sign in and choose Continue with Google. This recovery flow is for NextStep email/password accounts; it does not change your Google password.",
            "سجّلت عبر Google؟ ارجع لتسجيل الدخول واختار المتابعة مع Google. الاستعادة هون لحسابات NextStep المسجّلة بإيميل وكلمة مرور، وما بتغيّر كلمة مرور Google.",
          )}
        </p>
      )}
      {step !== "done" && (
        <Link
          to="/login"
          search={{ returnTo: safeReturn(returnTo) }}
          className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("Back to sign in", "العودة لتسجيل الدخول")}
        </Link>
      )}
    </AuthFrame>
  );
}
