import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { post } from '@/dashboard/client';
import { cn } from '@/lib/utils';
import { useI18n } from './context';
import type { SupportedLocale } from './types';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, locales, t } = useI18n();
  const [saving, setSaving] = useState(false);

  async function handleLanguageChange(val: string) {
    const next = val as SupportedLocale;
    setLocale(next);
    setSaving(true);
    try {
      await post('/api/rentals/settings', { language: next });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rental_manager_lang_changed', { detail: next }));
      }
    } catch (err) {
      console.error('Failed to save language to settings collection', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor="language-switcher-select" className="sr-only">
        {t('common.select_language')}
      </label>
      <Select value={locale} onValueChange={handleLanguageChange} disabled={saving}>
        <SelectTrigger
          id="language-switcher-select"
          className="w-full justify-between bg-muted/40 hover:bg-muted/70 text-xs font-medium"
          aria-label={t('common.switch_language')}
        >
          <div className="flex items-center gap-2 truncate">
            {saving ? (
              <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" aria-hidden="true" />
            ) : (
              <Globe className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <SelectValue placeholder={t('common.select_language')} />
          </div>
        </SelectTrigger>
        <SelectContent align="start" className="w-48">
          {locales.map((loc) => (
            <SelectItem key={loc.code} value={loc.code} className="text-xs">
              <span className="flex items-center gap-2">
                <span className="text-sm" aria-hidden="true">{loc.flag}</span>
                <span className="font-medium">{loc.nativeName}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

