import { useState, useEffect, useMemo, useCallback } from 'react';
import { request } from './client.ts';
import { type SupportedLocale, supportedLocales } from '../i18n/types.ts';
import { en } from '../i18n/locales/en.ts';
import { es } from '../i18n/locales/es.ts';
import { fr } from '../i18n/locales/fr.ts';
import { de } from '../i18n/locales/de.ts';
import { pt } from '../i18n/locales/pt.ts';
import { it } from '../i18n/locales/it.ts';
import { he } from '../i18n/locales/he.ts';
import {
  enUS as dateEn,
  es as dateEs,
  fr as dateFr,
  de as dateDe,
  pt as datePt,
  it as dateIt,
  he as dateHe,
} from 'react-day-picker/locale';
import type { Locale as DayPickerLocale } from 'react-day-picker/locale';

export type SiteTranslations = typeof en.site;
export type SiteTranslationKey = keyof SiteTranslations;

let cachedSiteLanguage: SupportedLocale | null = null;
let fetchConfigPromise: Promise<SupportedLocale | null> | null = null;
const SITE_LANGUAGE_CACHE_KEY = 'rental_manager_site_lang';
const SITE_LANGUAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readCachedSiteLanguage(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SITE_LANGUAGE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { language?: string; cachedAt?: number };
    if (
      typeof cached.language === 'string' &&
      (supportedLocales as readonly string[]).includes(cached.language) &&
      typeof cached.cachedAt === 'number' &&
      Date.now() - cached.cachedAt < SITE_LANGUAGE_CACHE_TTL_MS
    ) {
      return cached.language as SupportedLocale;
    }
  } catch {
    // Storage can be disabled or contain an old cache format.
  }
  return null;
}

function cacheSiteLanguage(language: SupportedLocale) {
  cachedSiteLanguage = language;
  try {
    window.localStorage.setItem(SITE_LANGUAGE_CACHE_KEY, JSON.stringify({ language, cachedAt: Date.now() }));
  } catch {
    // Storage can be disabled; the in-memory cache still works for this page.
  }
}

export async function fetchSiteLanguage(): Promise<SupportedLocale> {
  if (cachedSiteLanguage) return cachedSiteLanguage;
  const persistedLanguage = readCachedSiteLanguage();
  if (persistedLanguage) {
    cachedSiteLanguage = persistedLanguage;
    return persistedLanguage;
  }
  if (!fetchConfigPromise) {
    fetchConfigPromise = request<{ language?: string }>('/api/rentals/config')
      .then((res) => {
        if (res.language && (supportedLocales as readonly string[]).includes(res.language)) {
          cacheSiteLanguage(res.language as SupportedLocale);
          return cachedSiteLanguage;
        }
        cacheSiteLanguage('en');
        return 'en' as SupportedLocale;
      })
      .catch(() => 'en' as SupportedLocale);
  }
  const lang = await fetchConfigPromise;
  return lang ?? 'en';
}

const dictionaries: Record<SupportedLocale, SiteTranslations> = {
  en: en.site,
  es: es.site,
  fr: fr.site,
  de: de.site,
  pt: pt.site,
  it: it.site,
  he: he.site,
};

export const siteDateLocales: Record<SupportedLocale, DayPickerLocale> = {
  en: dateEn,
  es: dateEs,
  fr: dateFr,
  de: dateDe,
  pt: datePt,
  it: dateIt,
  he: dateHe,
};

export function resolveSiteLocale(preferred?: string | null): SupportedLocale {
  // 1. Explicit preference from backend settings or widget prop
  if (preferred) {
    const code = preferred.slice(0, 2).toLowerCase();
    if ((supportedLocales as readonly string[]).includes(code)) {
      cacheSiteLanguage(code as SupportedLocale);
      return code as SupportedLocale;
    }
  }

  // 2. Cached backend settings language
  if (cachedSiteLanguage) {
    return cachedSiteLanguage;
  }

  const persistedLanguage = readCachedSiteLanguage();
  if (persistedLanguage) {
    cachedSiteLanguage = persistedLanguage;
    return persistedLanguage;
  }

  // 3. localStorage if available (set by language switcher)
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('rental_manager_lang');
      if (stored && (supportedLocales as readonly string[]).includes(stored)) {
        return stored as SupportedLocale;
      }
    } catch {}

    // 4. Document language attribute
    if (document.documentElement?.lang) {
      const docLang = document.documentElement.lang.slice(0, 2).toLowerCase();
      if ((supportedLocales as readonly string[]).includes(docLang)) {
        return docLang as SupportedLocale;
      }
    }

    // 5. Browser navigator language
    if (navigator?.language) {
      const navLang = navigator.language.slice(0, 2).toLowerCase();
      if ((supportedLocales as readonly string[]).includes(navLang)) {
        return navLang as SupportedLocale;
      }
    }
  }

  return 'en';
}

export function translateSite(
  locale: SupportedLocale,
  key: SiteTranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  let text = dict[key] || dictionaries.en[key] || String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function formatSiteMoney(amount: number, currency?: string, locale: SupportedLocale = 'en'): string {
  if (!currency) return String(amount);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatSiteShortDate(date: Date | undefined, locale: SupportedLocale = 'en'): string {
  if (!date) return '';
  try {
    return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return date.toDateString();
  }
}

export function formatSiteDateRange(start: string, end: string, locale: SupportedLocale = 'en'): string {
  const [sYear, sMonth, sDay] = start.split('-').map(Number);
  const [eYear, eMonth, eDay] = end.split('-').map(Number);
  const sDate = new Date(sYear, (sMonth ?? 1) - 1, sDay ?? 1);
  const eDate = new Date(eYear, (eMonth ?? 1) - 1, eDay ?? 1);
  return `${formatSiteShortDate(sDate, locale)} → ${formatSiteShortDate(eDate, locale)}`;
}

export function useSiteI18n(preferredLocale?: string | null) {
  const [locale, setLocale] = useState<SupportedLocale>(() => resolveSiteLocale(preferredLocale));

  useEffect(() => {
    if (preferredLocale) {
      const resolved = resolveSiteLocale(preferredLocale);
      cacheSiteLanguage(resolved);
      setLocale(resolved);
      return;
    }
    // Fetch site language configured in the backend collection
    let active = true;
    fetchSiteLanguage().then((lang) => {
      if (active) {
        setLocale(resolveSiteLocale(lang));
      }
    });
    return () => { active = false; };
  }, [preferredLocale]);

  // Listen for language changes in other tabs or components
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'rental_manager_lang' && e.newValue) {
        setLocale(resolveSiteLocale(e.newValue));
      }
    }
    function onLangChanged(e: Event) {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setLocale(resolveSiteLocale(customEvent.detail));
      }
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('rental_manager_lang_changed', onLangChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('rental_manager_lang_changed', onLangChanged);
    };
  }, [preferredLocale]);

  const t = useCallback(
    (key: SiteTranslationKey, params?: Record<string, string | number>) =>
      translateSite(locale, key, params),
    [locale],
  );

  const dateLocale = useMemo(() => siteDateLocales[locale] ?? dateEn, [locale]);
  const isRtl = locale === 'he';

  const money = useCallback((amt: number, curr?: string) => formatSiteMoney(amt, curr, locale), [locale]);
  const shortDate = useCallback((d: Date | undefined) => formatSiteShortDate(d, locale), [locale]);
  const dateRange = useCallback((s: string, e: string) => formatSiteDateRange(s, e, locale), [locale]);

  return {
    locale,
    t,
    dateLocale,
    isRtl,
    money,
    shortDate,
    dateRange,
  };
}
