import { Link } from "@tanstack/react-router";
import { ArrowLeft, Moon, Sparkles, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { LanguageToggle, useLocale } from "@/components/LocaleProvider";
import { useTheme } from "@/components/ThemeProvider";

export function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-background">
      <div className="ambient-scene" aria-hidden>
        <div className="ambient-stars" />
        <div className="ambient-orbit ambient-orbit-one" />
        <span className="ambient-bubble bubble-one" />
        <span className="ambient-bubble bubble-three" />
        <div className="ambient-grain" />
      </div>
      <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link
          to="/"
          search={{}}
          className="flex min-h-11 items-center gap-2 rounded-xl text-lg font-bold"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-button">
            <Sparkles className="size-4" aria-hidden />
          </span>
          NextStep
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t("Toggle theme", "تغيير المظهر")}
            className="glass grid size-11 place-items-center rounded-xl"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>
      <main className="relative mx-auto max-w-[480px] px-4 pb-12 pt-5 sm:pt-9">
        <section className="glass-strong relative overflow-hidden rounded-[2rem] border border-primary/15 p-6 shadow-xl sm:p-9">
          <div
            aria-hidden
            className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent"
          />
          {children}
        </section>
        <Link
          to="/"
          search={{}}
          className="mx-auto mt-5 flex min-h-11 w-fit items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("Keep exploring", "كمّل استكشاف")}
        </Link>
      </main>
    </div>
  );
}
