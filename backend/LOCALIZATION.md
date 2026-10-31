# Arabic/English UI and future content translation

Fixed labels live in frontend code, not database rows or model requests. LocaleProvider persists language and sets document lang/dir. Navigation, real opportunities and authentication/recovery support Arabic/English and RTL. Legacy demo Details, Profile, Preparation and Saved copy is not fully localized.

The browser boundary anticipates POST /api/localization/catalog with {language: ar|en}. Dynamic translation is disabled by default using VITE_ENABLE_META_TRANSLATION. The app-only backend does not implement that endpoint or invoke Meta for translation: the adapter is a separate proposal for Rofi's review. A UI flag alone is insufficient; the reviewed backend adapter must also exist.

Original content stays visible without that integration. Changing language never changes eligibility, original source evidence, confirmed facts, plans or progress. See [HANDOFF-ROFI.md](HANDOFF-ROFI.md).
