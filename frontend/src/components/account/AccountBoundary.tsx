import { Fragment, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/discover/AppShell";
import { useLocale } from "@/components/LocaleProvider";

export function AccountCacheBridge() {
  const query = useQueryClient();
  const auth = useAuth();
  useEffect(() => {
    const update = () => {
      void query.invalidateQueries({
        predicate: (item) =>
          item.queryKey[0] === "account" || item.queryKey[0] === "account-profile-facts",
      });
    };
    window.addEventListener("nextstep:account-data", update);
    return () => window.removeEventListener("nextstep:account-data", update);
  }, [query]);
  useEffect(() => {
    query.removeQueries({
      predicate: (item) =>
        (item.queryKey[0] === "account" || item.queryKey[0] === "account-profile-facts") &&
        item.queryKey[1] !== auth?.user?.id,
    });
  }, [auth?.user?.id, query]);
  return null;
}
export function AccountBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const { t } = useLocale();
  if (!auth?.ready)
    return (
      <AppShell>
        <p role="status" className="prep-loading">
          {t("Loading your account…", "جارٍ تحميل حسابك…")}
        </p>
      </AppShell>
    );
  if (!auth.user)
    return (
      <AppShell>
        <section className="glass mx-auto max-w-xl rounded-3xl p-8">
          <LockKeyhole className="mb-5 size-9 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold">
            {t("Keep your next steps with you.", "خلي خطوتك الجاية محفوظة بحسابك.")}
          </h1>
          <p className="my-5 text-sm leading-7 text-muted-foreground">
            {t(
              "Sign in to access your saved profile, opportunities and preparation progress. Public opportunities stay open to everyone.",
              "سجّل الدخول للوصول لملفك والفرص المحفوظة والتقدّم. تصفّح الفرص متاح للجميع.",
            )}
          </p>
          <Link to="/login" search={{ returnTo: location.href }} className="detail-primary">
            {t("Sign in", "تسجيل الدخول")}
          </Link>
        </section>
      </AppShell>
    );
  return <Fragment key={auth.user.id}>{children}</Fragment>;
}
