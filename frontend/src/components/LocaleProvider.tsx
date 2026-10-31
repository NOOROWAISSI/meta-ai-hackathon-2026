import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "ar" | "en";
const LocaleContext = createContext({
  language: "en" as Language,
  setLanguage: (_: Language) => {},
  t: (en: string, _ar: string) => en,
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    try {
      if (localStorage.getItem("nextstep.language") === "ar") setLanguage("ar");
    } catch {
      /* Language remains usable without persistence. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  const changeLanguage = (value: Language) => {
    setLanguage(value);
    try {
      localStorage.setItem("nextstep.language", value);
    } catch {
      /* Optional display preference. */
    }
  };
  return (
    <LocaleContext.Provider
      value={{
        language,
        setLanguage: changeLanguage,
        t: (en, ar) => (language === "ar" ? ar : en),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
export const useLocale = () => useContext(LocaleContext);
export function LanguageToggle() {
  const { language, setLanguage } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
      className="glass min-h-11 rounded-xl px-3 text-sm font-semibold"
      aria-label={language === "ar" ? "Switch to English" : "التبديل للعربية"}
      lang={language === "ar" ? "en" : "ar"}
    >
      {language === "ar" ? "English" : "العربية"}
    </button>
  );
}
