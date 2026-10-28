import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { authService, safeReturn } from "@/lib/auth/service";
import { useLocale } from "@/components/LocaleProvider";
import { AuthFrame } from "./AuthFrame";
import { useAuth } from "./AuthProvider";

export function LoginScreen({
  returnTo,
  externalError,
  googleComplete,
}: {
  returnTo?: string;
  externalError?: string;
  googleComplete?: boolean;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    externalError === "existing_account"
      ? t("Sign in using your existing account method.", "ادخل باستخدام طريقة حسابك الحالية.")
      : externalError
        ? t(
            "Google sign-in did not finish. Please retry.",
            "لم يكتمل الدخول عبر Google. حاول مجددًا.",
          )
        : "",
  );
  const [config, setConfig] = useState<{ googleEnabled: boolean; passwordEnabled: boolean } | null>(
    null,
  );
  const [configError, setConfigError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const target = safeReturn(returnTo);
  useEffect(() => {
    let alive = true;
    void authService
      .config()
      .then((value) => {
        if (alive) {
          setConfig(value);
          setConfigError(false);
        }
      })
      .catch(() => {
        if (alive) setConfigError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  const reloadAuth = auth?.reload;
  useEffect(() => {
    if (googleComplete) void reloadAuth?.();
  }, [googleComplete, reloadAuth]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const user =
        mode === "login"
          ? await authService.login(email.trim(), password)
          : await authService.register(email.trim(), password, name.trim());
      auth?.confirm(user);
      setPassword("");
      await navigate({ href: target });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Sign-in failed. Please retry.", "تعذّر الدخول. حاول مجددًا."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <div
        className="mb-7 flex rounded-2xl border border-border bg-background/40 p-1"
        aria-label={t("Account access", "الدخول للحساب")}
      >
        {(["login", "register"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={busy}
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition-colors ${mode === value ? "bg-primary text-primary-foreground shadow-button" : "text-muted-foreground hover:text-foreground"}`}
          >
            {value === "login" ? t("Sign in", "تسجيل الدخول") : t("Create account", "حساب جديد")}
          </button>
        ))}
      </div>
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        {mode === "login" ? (
          <LogIn className="size-5" aria-hidden />
        ) : (
          <UserPlus className="size-5" aria-hidden />
        )}
      </div>
      <h1 className="text-3xl font-bold tracking-tight">
        {auth?.user
          ? t("You’re signed in.", "أنت مسجّل الدخول.")
          : mode === "login"
            ? t("Good to see you.", "أهلًا برجعتك.")
            : t("Your next step starts here.", "خطوتك القادمة بتبدأ هون.")}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {mode === "login"
          ? t("Your opportunities and plans, all in one place.", "فرصك وخططك، بمكان واحد.")
          : t("A little about you. A world of possibilities.", "حساب بسيط، وفرص بتناسبك.")}
      </p>
      {auth?.user ? (
        <div className="mt-7 space-y-4">
          <p dir="auto" className="text-sm text-muted-foreground">
            {auth.user.email}
          </p>
          <button
            type="button"
            className="detail-primary min-h-12 w-full"
            onClick={() => void navigate({ href: target })}
          >
            {t("Continue", "متابعة")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="detail-secondary mb-3 mt-7 min-h-12 w-full"
            disabled={!config?.googleEnabled || busy}
            onClick={() =>
              window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(target)}`)
            }
          >
            <span aria-hidden className="text-lg font-bold">
              G
            </span>
            {t("Continue with Google", "المتابعة مع Google")}
          </button>
          {config && !config.googleEnabled && (
            <p className="text-center text-xs text-muted-foreground">
              {t(
                "Google sign-in is not available yet. Use your email.",
                "دخول Google غير متاح حاليًا. استخدم إيميلك.",
              )}
            </p>
          )}
          {configError && (
            <p role="alert" className="prep-error mt-3">
              {t("Account service is unavailable.", "خدمة الحسابات غير متاحة.")}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("Retry connection", "إعادة الاتصال")}
              </button>
            </p>
          )}
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("or use email", "أو باستخدام الإيميل")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            {mode === "register" && (
              <div>
                <label htmlFor="account-name" className="mb-2 block text-sm font-semibold">
                  {t("Display name (optional)", "الاسم الظاهر (اختياري)")}
                </label>
                <input
                  id="account-name"
                  autoComplete="nickname"
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="prep-input w-full"
                  disabled={busy}
                />
              </div>
            )}
            <div>
              <label htmlFor="account-email" className="mb-2 block text-sm font-semibold">
                {t("Email address", "البريد الإلكتروني")}
              </label>
              <input
                id="account-email"
                dir="ltr"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="prep-input w-full"
                disabled={busy}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="account-password" className="text-sm font-semibold">
                  {t("Password", "كلمة المرور")}
                </label>
                {mode === "login" && (
                  <Link
                    to="/forgot-password"
                    search={{ returnTo: target }}
                    className="rounded-md py-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {t("Forgot password?", "نسيت كلمة المرور؟")}
                  </Link>
                )}
              </div>
              <div className="relative">
                <input
                  id="account-password"
                  type={show ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="prep-input w-full !pe-12"
                  disabled={busy}
                  aria-describedby={mode === "register" ? "password-help" : undefined}
                />
                <button
                  type="button"
                  aria-label={
                    show
                      ? t("Hide password", "إخفاء كلمة المرور")
                      : t("Show password", "إظهار كلمة المرور")
                  }
                  aria-pressed={show}
                  onClick={() => setShow((value) => !value)}
                  className="absolute end-1 top-0 grid size-11 place-items-center rounded-xl text-muted-foreground"
                >
                  {show ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {mode === "register" && (
                <p id="password-help" className="mt-2 text-xs text-muted-foreground">
                  {t("Use at least 12 characters.", "استخدم 12 حرفًا على الأقل.")}
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="prep-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="detail-primary min-h-12 w-full"
              disabled={busy || !config?.passwordEnabled}
            >
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  {t("Please wait…", "لحظة…")}
                </>
              ) : mode === "login" ? (
                t("Sign in with email", "تسجيل الدخول بالإيميل")
              ) : (
                t("Create my account", "إنشاء حسابي")
              )}
              {!busy && <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />}
            </button>
          </form>
          <p className="mt-6 border-t border-border pt-4 text-center text-xs leading-6 text-muted-foreground">
            {t(
              "Browser demo data stays here and is not imported automatically.",
              "بيانات الديمو تبقى على هذا المتصفح ولا تُنقل تلقائيًا لحسابك.",
            )}
          </p>
        </>
      )}
    </AuthFrame>
  );
}
