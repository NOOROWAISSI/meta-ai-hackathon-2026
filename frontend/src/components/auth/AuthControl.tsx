import { Link, useLocation } from "@tanstack/react-router";
import { LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useLocale } from "@/components/LocaleProvider";

export function AuthControl() {
  const auth = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!auth?.user)
    return (
      <Link
        to="/login"
        search={{ returnTo: location.pathname === "/login" ? "/" : location.href }}
        className="detail-secondary min-h-11 text-xs"
      >
        <LogIn className="size-4" aria-hidden />
        {t("Sign in", "دخول")}
      </Link>
    );
  return (
    <div>
      <p className="mb-2 max-w-48 truncate text-xs font-medium" title={auth.user.email}>
        {auth.user.displayName || auth.user.email}
      </p>
      <button
        type="button"
        className="detail-secondary min-h-11 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await auth.logout();
          } catch {
            setError("Sign out failed. Retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut className="size-4" aria-hidden />
        {busy ? t("Signing out…", "جارٍ الخروج…") : t("Sign out", "خروج")}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
