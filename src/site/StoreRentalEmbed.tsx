import { useEffect, useState, type CSSProperties } from 'react';
import { Toaster, toast } from 'sonner';
import { request } from './client';
import { useSiteI18n } from './i18n';
import { RentalBookingForm, type BookingNotification } from './RentalBookingForm';
import styles from './rental.module.css';
import type { CatalogItem } from './types';

type FontValue = { font: string; textDecoration: string };

function parseFont(raw: string | undefined, fallback: FontValue): FontValue {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'font' in parsed && typeof parsed.font === 'string') {
      return {
        font: parsed.font,
        textDecoration: 'textDecoration' in parsed && typeof parsed.textDecoration === 'string' ? parsed.textDecoration : '',
      };
    }
  } catch {
    return { font: raw, textDecoration: '' };
  }
  return fallback;
}

function appearanceStyle(appearance: StoreRentalAppearance): CSSProperties {
  const heading = parseFont(appearance.headingFont, { font: '700 22px/1.25 "helvetica-w01-roman", sans-serif', textDecoration: '' });
  const body = parseFont(appearance.bodyFont, { font: '400 16px/1.5 "helvetica-w01-roman", sans-serif', textDecoration: '' });
  const button = parseFont(appearance.buttonFont, { font: '600 16px/1.2 "helvetica-w01-roman", sans-serif', textDecoration: '' });
  const style: CSSProperties & Partial<Record<`--${string}`, string>> = {};
  const assign = (name: `--${string}`, value: string | undefined) => { if (value) style[name] = value; };
  assign('--rm-background', appearance.backgroundColor);
  assign('--rm-card', appearance.cardColor);
  assign('--rm-text', appearance.textColor);
  assign('--rm-heading-color', appearance.headingColor);
  assign('--rm-accent', appearance.accentColor);
  assign('--rm-on-accent', appearance.buttonTextColor);
  assign('--rm-border', appearance.borderColor);
  if (appearance.cornerRadius !== undefined && Number.isFinite(appearance.cornerRadius)) style['--rm-radius'] = `${appearance.cornerRadius}px`;
  assign('--rm-heading-font', heading.font);
  assign('--rm-heading-decoration', heading.textDecoration);
  assign('--rm-body-font', body.font);
  assign('--rm-body-decoration', body.textDecoration);
  assign('--rm-button-font', button.font);
  assign('--rm-button-decoration', button.textDecoration);
  return style;
}

export interface StoreRentalAppearance {
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  headingColor?: string;
  accentColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  cornerRadius?: number;
  headingFont?: string;
  bodyFont?: string;
  buttonFont?: string;
}

export function StoreRentalEmbed({ productId, appearance }: { productId: string; appearance?: StoreRentalAppearance }) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [language, setLanguage] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [ineligible, setIneligible] = useState(false);

  const { t, isRtl } = useSiteI18n(language);

  useEffect(() => {
    let active = true;
    setItem(null);
    setMessage('');
    setIneligible(false);
    request<{ eligible: boolean; item?: CatalogItem; message?: string; language?: string }>(`/api/rentals/store-product?productId=${encodeURIComponent(productId)}`)
      .then((body) => {
        if (!active) return;
        if (body.language) setLanguage(body.language);
        if (body.eligible && body.item) setItem(body.item);
        else setIneligible(true);
      })
      .catch(() => {
        if (active) setMessage(t('not_available_for_product'));
      });
    return () => { active = false; };
  }, [productId, t]);

  useEffect(() => {
    if (message) toast.error(message);
  }, [message]);

  const toaster = <Toaster position="top-center" closeButton richColors />;

  if (ineligible) return null;
  if (message) {
    return <div className={styles.pluginContainer} dir={isRtl ? 'rtl' : 'ltr'}>{toaster}</div>;
  }
  if (!item) {
    return (
      <div className={`${styles.pluginContainer} ${styles.notice} ${styles.loadingState}`} dir={isRtl ? 'rtl' : 'ltr'} aria-live="polite" aria-label={t('loading_rental')}>
        {toaster}
        <svg className={styles.loadingDots} viewBox="0 0 36 12" aria-hidden="true">
          <circle className={styles.loadingDot} cx="6" cy="6" r="4" />
          <circle className={styles.loadingDot} cx="18" cy="6" r="4" />
          <circle className={styles.loadingDot} cx="30" cy="6" r="4" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={styles.pluginContainer}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={appearanceStyle(appearance ?? {})}
    >
      {toaster}
      <RentalBookingForm
        itemId={item._id}
        embedded
        language={language}
        onNotification={({ tone, text }: BookingNotification) => {
          if (tone === 'error') toast.error(text);
          else toast.success(text);
        }}
      />
    </div>
  );
}
