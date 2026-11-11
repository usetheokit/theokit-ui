import {
  type ReactNode,
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/** A flat catalogue: message key -> template. `{name}` placeholders are interpolated. */
export type Messages = Readonly<Record<string, string>>;
export type Catalogues = Readonly<Record<string, Messages>>;
export type TranslateParams = Readonly<Record<string, string | number>>;

/** Built-in English and Swedish strings for the UI's own labels. */
export const en: Messages = {
  "settings.label": "Settings",
  "chat.send": "Send",
  "language.label": "Language",
};

export const sv: Messages = {
  "settings.label": "Inställningar",
  "chat.send": "Skicka",
  "language.label": "Språk",
};

export const defaultCatalogues: Catalogues = { en, sv };

/** Look a key up in `locale`, then its base language, then `fallback`; the key itself is the last resort. */
export function translate(
  catalogues: Catalogues,
  locale: string,
  key: string,
  params?: TranslateParams,
  fallback = "en",
): string {
  const base = locale.split("-")[0] ?? locale;
  const template =
    catalogues[locale]?.[key] ?? catalogues[base]?.[key] ?? catalogues[fallback]?.[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  locale: string,
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export interface I18n {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, params?: TranslateParams) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18n | null>(null);

export interface I18nProviderProps {
  /** Initial locale. Default "en". */
  locale?: string;
  /** Extra or overriding catalogues, merged over the built-in en/sv. */
  catalogues?: Catalogues;
  children?: ReactNode;
}

export function I18nProvider({ locale: initial = "en", catalogues, children }: I18nProviderProps) {
  const [locale, setLocale] = useState(initial);
  const merged = useMemo<Catalogues>(() => {
    const out: Record<string, Messages> = { ...defaultCatalogues };
    for (const [loc, msgs] of Object.entries(catalogues ?? {})) {
      out[loc] = { ...out[loc], ...msgs };
    }
    return out;
  }, [catalogues]);
  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(merged, locale, key, params),
    [merged, locale],
  );
  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      t,
      formatNumber: (v, o) => formatNumber(locale, v, o),
      formatDate: (v, o) => formatDate(locale, v, o),
    }),
    [locale, t],
  );
  return createElement(I18nContext.Provider, { value }, children);
}

/** Without a provider, returns an English-only instance whose setLocale is a no-op. */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: "en",
    setLocale: () => {},
    t: (key, params) => translate(defaultCatalogues, "en", key, params),
    formatNumber: (v, o) => formatNumber("en", v, o),
    formatDate: (v, o) => formatDate("en", v, o),
  };
}
