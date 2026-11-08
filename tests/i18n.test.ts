import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../src/i18n/locales/en.ts';
import { es } from '../src/i18n/locales/es.ts';
import { fr } from '../src/i18n/locales/fr.ts';
import { de } from '../src/i18n/locales/de.ts';
import { pt } from '../src/i18n/locales/pt.ts';
import { it as itLocale } from '../src/i18n/locales/it.ts';
import { he } from '../src/i18n/locales/he.ts';
import {
  resolveSiteLocale,
  translateSite,
  formatSiteMoney,
  formatSiteShortDate,
  formatSiteDateRange,
  siteDateLocales,
} from '../src/site/i18n.ts';

const supportedLocales = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', dir: 'rtl' },
];

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n dashboard system', () => {
  it('registers all 7 supported locales with metadata and valid direction', () => {
    assert.equal(supportedLocales.length, 7);
    const codes = supportedLocales.map((l) => l.code);
    assert.deepEqual(codes, ['en', 'es', 'fr', 'de', 'pt', 'it', 'he']);

    const hebrew = supportedLocales.find((l) => l.code === 'he');
    assert.equal(hebrew?.dir, 'rtl');

    const english = supportedLocales.find((l) => l.code === 'en');
    assert.equal(english?.dir, 'ltr');
  });

  it('contains matching keys in all locales without missing translations', () => {
    const enKeys = getLeafKeys(en as unknown as Record<string, unknown>);
    const locales = { es, fr, de, pt, it: itLocale, he };

    for (const [code, dict] of Object.entries(locales)) {
      const keys = getLeafKeys(dict as unknown as Record<string, unknown>);
      assert.deepEqual(
        keys,
        enKeys,
        `Locale ${code} should have the exact same keys as English`,
      );
    }
  });

  it('has translated values without empty strings', () => {
    const locales = { en, es, fr, de, pt, it: itLocale, he };
    for (const [code, dict] of Object.entries(locales)) {
      const keys = getLeafKeys(dict as unknown as Record<string, unknown>);
      for (const k of keys) {
        const parts = k.split('.');
        let val: unknown = dict;
        for (const p of parts) {
          val = (val as Record<string, unknown>)[p];
        }
        assert.ok(typeof val === 'string' && val.trim().length > 0, `Locale ${code} key ${k} must not be empty`);
      }
    }
  });
});

describe('i18n site & widget system', () => {
  it('resolves site locale with correct precedence', () => {
    // Explicit preference
    assert.equal(resolveSiteLocale('es'), 'es');
    assert.equal(resolveSiteLocale('fr-CA'), 'fr');
    assert.equal(resolveSiteLocale('de_DE'), 'de');
    assert.equal(resolveSiteLocale('he'), 'he');

    // Unknown locale falls back to 'en'
    assert.equal(resolveSiteLocale('xyz'), 'en');
    assert.equal(resolveSiteLocale(null), 'en');
  });

  it('translates site keys and interpolates variables correctly', () => {
    assert.equal(translateSite('en', 'rent_now'), 'Rent now');
    assert.equal(translateSite('es', 'rent_now'), 'Alquilar ahora');
    assert.equal(translateSite('fr', 'rent_now'), 'Louer maintenant');
    assert.equal(translateSite('de', 'rent_now'), 'Jetzt mieten');
    assert.equal(translateSite('he', 'rent_now'), 'השכר עכשיו');

    // Parameter interpolation
    const enLine = translateSite('en', 'rental_summary_line', { days: 3, unit: 'days' });
    assert.equal(enLine, 'Rental · 3 days');

    const esLine = translateSite('es', 'rental_summary_line', { days: 5, unit: 'días' });
    assert.equal(esLine, 'Alquiler · 5 días');

    const deCart = translateSite('de', 'cart_success', { reference: 'RB-123' });
    assert.ok(deCart.includes('RB-123'));
    assert.ok(deCart.includes('Warenkorb'));
  });

  it('provides matching date picker locales for all 7 languages', () => {
    for (const loc of supportedLocales) {
      const dateLocale = siteDateLocales[loc.code as keyof typeof siteDateLocales];
      assert.ok(dateLocale, `Date picker locale must exist for ${loc.code}`);
    }
  });

  it('formats money and dates across locales', () => {
    const formattedEn = formatSiteMoney(150, 'USD', 'en');
    assert.ok(formattedEn.includes('150'));

    const formattedDate = formatSiteShortDate(new Date(2026, 4, 15), 'es');
    assert.ok(typeof formattedDate === 'string' && formattedDate.length > 0);

    const rangeStr = formatSiteDateRange('2026-05-10', '2026-05-15', 'en');
    assert.ok(rangeStr.includes('→'));
  });
});
