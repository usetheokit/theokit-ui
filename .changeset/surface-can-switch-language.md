---
"@theokit/ui": minor
---

Add an i18n layer so a surface can switch language. Wrap your app in `<I18nProvider locale="sv" catalogues={{ ... }}>` (built-in `en` and `sv` catalogues are merged with yours; `locale` defaults to `"en"`), then call `useI18n()` to get `{ locale, setLocale, t, formatNumber, formatDate }`. `t("chat.send", { name })` looks up a key and interpolates `{name}` placeholders, and `setLocale("sv")` switches language at runtime. Without a provider, `useI18n()` falls back to English. The `translate`, `formatNumber` and `formatDate` helpers, the `en`, `sv` and `defaultCatalogues` catalogues, and the `Messages`, `Catalogues`, `TranslateParams`, `I18n` and `I18nProviderProps` types are exported too.
