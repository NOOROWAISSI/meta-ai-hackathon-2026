import { Link, useLocation } from "@tanstack/react-router";
import { Bookmark, Compass, ListChecks, Moon, Sparkles, Sun, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { AuthControl } from "@/components/auth/AuthControl";
import { LanguageToggle, useLocale } from "@/components/LocaleProvider";

const NAV = [
  { to: "/", label: "Discover", icon: Compass },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/plans", label: "My Plans", icon: ListChecks },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

/** Placeholder brand name — change here. */
export const BRAND = "NextStep";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={
        theme === "dark"
          ? t("Switch to light mode", "تفعيل الوضع الفاتح")
          : t("Switch to dark mode", "تفعيل الوضع الداكن")
      }
      aria-pressed={theme === "dark"}
      onClick={toggleTheme}
      className="glass transition-soft flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground hover:border-primary/50"
    >
      {theme === "dark" ? (
        <Moon className="size-4 text-primary" aria-hidden />
      ) : (
        <Sun className="size-4 text-primary" aria-hidden />
      )}
      {theme === "dark" ? t("Dark mode", "الوضع الداكن") : t("Light mode", "الوضع الفاتح")}
    </button>
  );
}

function Wordmark() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-xl px-1 font-semibold tracking-tight text-foreground"
    >
      <span className="grid size-8 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--primary),#8b9ae0)] text-primary-foreground shadow-button">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <span className="text-lg">{BRAND}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { t } = useLocale();
  const navLabel = (label: string) =>
    ({
      Discover: t("Discover", "استكشف"),
      Saved: t("Saved", "المحفوظات"),
      "My Plans": t("My Plans", "خططي"),
      Profile: t("Profile", "ملفي"),
    })[label] ?? label;
  const searchContext = location.search as { event?: string; opportunity?: string };
  const eventId = searchContext.opportunity ?? searchContext.event;
  const isCurrentSection = (to: (typeof NAV)[number]["to"]) =>
    to === "/"
      ? location.pathname === "/" || location.pathname === "/opportunities"
      : location.pathname === to || location.pathname.startsWith(`${to}/`);
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only"
      >
        {t("Skip to content", "انتقل للمحتوى")}
      </a>
      <div aria-hidden className="ambient-scene">
        <div className="ambient-stars" />
        <div className="ambient-orbit ambient-orbit-one" />
        <div className="ambient-orbit ambient-orbit-two" />
        <span className="ambient-bubble bubble-one" />
        <span className="ambient-bubble bubble-two" />
        <span className="ambient-bubble bubble-three" />
        <span className="ambient-bubble bubble-four" />
        <span className="ambient-bubble bubble-five" />
        <div className="ambient-grain" />
      </div>

      {/* Desktop floating sidebar */}
      <aside className="glass fixed start-4 top-4 bottom-4 z-30 hidden w-56 flex-col rounded-3xl p-4 lg:flex">
        <Wordmark />
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              search={{
                ...(to === "/profile" && eventId ? { event: eventId } : {}),
                ...(to === "/profile" && location.pathname === "/plans"
                  ? { returnTo: "plans" as const }
                  : {}),
              }}
              activeOptions={{ exact: true, includeSearch: false }}
              aria-current={isCurrentSection(to) ? "page" : undefined}
              data-nav-active={isCurrentSection(to)}
              className="app-nav-link transition-soft flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {navLabel(label)}
            </Link>
          ))}
        </nav>
        <div className="mb-3 mt-auto">
          <div className="mb-3">
            <AuthControl />
          </div>
          <ThemeToggle />
          <div className="mt-2">
            <LanguageToggle />
          </div>
        </div>
        <p className="rounded-2xl bg-secondary/70 p-3 text-xs leading-relaxed text-secondary-foreground">
          {t(
            "Source-backed opportunities. Check the organizer’s current conditions before participating.",
            "فرص مرتبطة بمصادرها. راجع شروط الجهة الحالية قبل المشاركة.",
          )}
        </p>
      </aside>

      {/* Mobile top bar */}
      <header className="glass sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl px-4 py-3 lg:hidden">
        <Wordmark />
        <AuthControl />
        <LanguageToggle />
        <ThemeToggle />
      </header>

      <main id="main-content" className="px-4 pb-28 pt-6 sm:px-6 lg:ms-64 lg:pb-12 lg:pe-8 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-2xl p-1.5 lg:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            search={{
              ...(to === "/profile" && eventId ? { event: eventId } : {}),
              ...(to === "/profile" && location.pathname === "/plans"
                ? { returnTo: "plans" as const }
                : {}),
            }}
            activeOptions={{ exact: true, includeSearch: false }}
            aria-current={isCurrentSection(to) ? "page" : undefined}
            data-nav-active={isCurrentSection(to)}
            className="app-nav-link app-nav-link-mobile transition-soft flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium text-muted-foreground"
          >
            <Icon className="size-4" aria-hidden />
            {navLabel(label)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function DemoPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <AppShell>
      <section className="glass mx-auto mt-10 max-w-xl rounded-3xl p-8 text-center">
        <span className="inline-flex rounded-full bg-amber/20 px-3 py-1 text-xs font-semibold text-amber-ink">
          Demo placeholder
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <Link
          to="/"
          className="transition-soft mt-6 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-button hover:-translate-y-0.5"
        >
          Back to Discover
        </Link>
      </section>
    </AppShell>
  );
}
