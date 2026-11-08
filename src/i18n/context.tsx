import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { de } from './locales/de';
import { en, type Translations } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { he } from './locales/he';
import { it } from './locales/it';
import { pt } from './locales/pt';
import type { I18nContextValue, LocaleInfo, SupportedLocale } from './types';

export const supportedLocales: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', dir: 'rtl' },
];

const dictionaries: Record<SupportedLocale, Translations> = {
  en,
  es,
  fr,
  de,
  pt,
  it,
  he,
};

const STORAGE_KEY = 'rental_manager_lang';

function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (saved && supportedLocales.some((l) => l.code === saved)) {
      return saved;
    }
    const navLang = window.navigator.language?.slice(0, 2)?.toLowerCase();
    const match = supportedLocales.find((l) => l.code === navLang);
    return match ? match.code : 'en';
  } catch {
    return 'en';
  }
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale);

  const currentInfo = useMemo(() => {
    return supportedLocales.find((l) => l.code === locale) ?? supportedLocales[0];
  }, [locale]);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // localStorage may be disabled
    }
    if (typeof document !== 'undefined') {
      const info = supportedLocales.find((l) => l.code === nextLocale) ?? supportedLocales[0];
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = info.dir;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = currentInfo.dir;
    }
  }, [locale, currentInfo.dir]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = dictionaries[locale] ?? dictionaries.en;
    let raw = getNestedValue(dict, key);
    if (raw === undefined && locale !== 'en') {
      raw = getNestedValue(dictionaries.en, key);
    }
    if (raw === undefined) {
      return key;
    }
    let text = String(raw);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  const formatDay = useCallback((iso: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string => {
    if (!iso) return '—';
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    try {
      return date.toLocaleDateString(locale, options);
    } catch {
      return date.toLocaleDateString(undefined, options);
    }
  }, [locale]);

  const formatRange = useCallback((start: string, end: string): string => {
    return `${formatDay(start)} – ${formatDay(end)}`;
  }, [formatDay]);

  const formatMoney = useCallback((amount: number, currency?: string): string => {
    if (!currency) return amount.toLocaleString(locale);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }, [locale]);

  const formatDate = useCallback((date: Date | string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    try {
      return d.toLocaleDateString(locale, options);
    } catch {
      return d.toLocaleDateString(undefined, options);
    }
  }, [locale]);

  const value: I18nContextValue = useMemo(() => ({
    locale,
    setLocale,
    dir: currentInfo.dir,
    locales: supportedLocales,
    t,
    formatDay,
    formatRange,
    formatMoney,
    formatDate,
  }), [locale, setLocale, currentInfo.dir, t, formatDay, formatRange, formatMoney, formatDate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

