export const supportedLocales = ['en', 'es', 'fr', 'de', 'pt', 'it', 'he'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export type TranslationKey = string;

export interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  dir: 'ltr' | 'rtl';
  locales: LocaleInfo[];
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDay: (iso: string, options?: Intl.DateTimeFormatOptions) => string;
  formatRange: (start: string, end: string) => string;
  formatMoney: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

