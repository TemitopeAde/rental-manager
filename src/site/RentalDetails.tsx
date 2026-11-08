import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from 'react';
import { request } from './client';
import { sizedImage } from './format';
import { useSiteI18n } from './i18n';
import { absolute, navigate, pagePath, readSlug, useSiteBase } from './links';
import { PlaceholderIcon, type ImageRatio } from './RentalCatalogGrid';
import { RentalBookingForm } from './RentalBookingForm';
import type { CatalogItem } from './types';
import styles from './details.module.css';

const ratios: Record<ImageRatio, string> = { square: '1 / 1', portrait: '3 / 4', landscape: '4 / 3' };

export type ImageSize = 'small' | 'medium' | 'large';
const galleryWidths: Record<ImageSize, string> = { small: '360px', medium: '460px', large: '580px' };

// Matches the booking form's own preview sample so the embedded form renders in the Editor.
const sample: CatalogItem = {
  _id: 'sample',
  slug: 'sample-rental',
  name: 'Sample rental',
  description: 'Your item description appears here. Open this page from the rental catalog to show a real item.',
  dailyRate: 20,
  weeklyRate: 100,
  depositAmount: 50,
  category: 'Equipment',
  minDays: 1,
};

type State =
  | { status: 'loading' }
  | { status: 'ready'; item: CatalogItem; currency?: string }
  | { status: 'missing'; message: string };

export function RentalDetails({
  itemSlug = '',
  catalogPage = '',
  backLabel,
  showCategory = true,
  showDescription = true,
  showWeeklyPrice = true,
  showDeposit = true,
  showQuantity = true,
  showThumbnails = true,
  imageRatio = 'square',
  imageSize = 'medium',
  bookingTitle,
  buttonLabel,
  monthsShown = 1,
  language,
}: {
  /** Shown when the page URL has no `?slug=` (the Editor, or a page fixed to one item). */
  itemSlug?: string;
  catalogPage?: string;
  backLabel?: string;
  showCategory?: boolean;
  showDescription?: boolean;
  showWeeklyPrice?: boolean;
  showDeposit?: boolean;
  showQuantity?: boolean;
  showThumbnails?: boolean;
  imageRatio?: ImageRatio;
  imageSize?: ImageSize;
  bookingTitle?: string;
  buttonLabel?: string;
  monthsShown?: number;
  language?: string;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [apiLanguage, setApiLanguage] = useState<string | undefined>();
  const base = useSiteBase();
  const sizeStyle = { '--rm-gallery-max': galleryWidths[imageSize] ?? galleryWidths.medium } as CSSProperties;

  const { t, isRtl, money } = useSiteI18n(language || apiLanguage);

  useEffect(() => {
    let active = true;
    const settle = (next: State) => {
      if (active) setState(next);
    };

    (async () => {
      const urlSlug = await readSlug();
      const key = urlSlug || itemSlug;
      if (key) {
        try {
          const body = await request<{ item: CatalogItem; currency?: string; language?: string }>(`/api/rentals/item?slug=${encodeURIComponent(key)}`);
          if (body.language) setApiLanguage(body.language);
          settle({ status: 'ready', item: body.item, currency: body.currency });
          return;
        } catch (error) {
          // A visitor following a stale link gets a clear message; a bad fixed slug in the
          // panel falls through to the preview below so the Editor never shows an empty box.
          if (urlSlug) {
            settle({ status: 'missing', message: error instanceof Error ? error.message : t('rental_load_error') });
            return;
          }
        }
      }
      try {
        const body = await request<{ items: CatalogItem[]; currency?: string; language?: string }>('/api/rentals/catalog');
        if (body.language) setApiLanguage(body.language);
        const first = body.items[0];
        settle(first
          ? { status: 'ready', item: first, currency: body.currency }
          : { status: 'missing', message: t('empty_catalog') });
      } catch {
        settle({ status: 'ready', item: sample, currency: 'USD' });
      }
    })();

    return () => {
      active = false;
    };
  }, [itemSlug, t]);

  const isDefaultBack = !backLabel || backLabel === 'All rentals';
  const effectiveBackLabel = isDefaultBack ? t('all_rentals') : backLabel;
  const isDefaultBookingTitle = !bookingTitle || bookingTitle === 'Choose your dates';
  const effectiveBookingTitle = isDefaultBookingTitle ? t('choose_dates') : bookingTitle;
  const isDefaultButton = !buttonLabel || buttonLabel === 'Rent now';
  const effectiveButtonLabel = isDefaultButton ? t('rent_now') : buttonLabel;
  const backPath = pagePath(catalogPage);
  const back = backPath ? (
    <a className={styles.back} href={absolute(base, backPath)} onClick={(event) => navigate(event, backPath)}>
      <span aria-hidden="true">{isRtl ? '→' : '←'}</span> {effectiveBackLabel}
    </a>
  ) : null;

  if (state.status === 'loading') {
    return (
      <div className={styles.details} style={sizeStyle} aria-busy="true" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className={styles.layout}>
          <div className={styles.skeletonMedia} style={{ aspectRatio: ratios[imageRatio] }} />
          <div className={styles.info}>
            <div className={styles.skeletonLine} data-width="40" />
            <div className={styles.skeletonLine} data-width="80" data-tall />
            <div className={styles.skeletonLine} data-width="30" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className={styles.details} style={sizeStyle} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className={styles.missing}>
          <p>{state.message}</p>
          {back}
        </div>
      </div>
    );
  }

  const { item, currency } = state;
  return (
    <div className={styles.details} style={sizeStyle} dir={isRtl ? 'rtl' : 'ltr'}>
      {back ? <nav className={styles.breadcrumb} aria-label={t('breadcrumb_label')}>{back}</nav> : null}
      <div className={styles.layout}>
        <Gallery item={item} ratio={ratios[imageRatio] ?? ratios.square} showThumbnails={showThumbnails} t={t} />
        <div className={styles.info}>
          {showCategory && item.category ? <p className={styles.category}>{item.category}</p> : null}
          <h1 className={styles.name}>{item.name}</h1>
          <div className={styles.prices}>
            <p className={styles.price}>
              {money(item.dailyRate, currency)}<span className={styles.unit}>{t('per_day')}</span>
            </p>
            {showWeeklyPrice && item.weeklyRate > 0 ? (
              <p className={styles.priceAlt}>
                {money(item.weeklyRate, currency)}<span className={styles.unit}>{t('per_week')}</span>
              </p>
            ) : null}
          </div>
          <ul className={styles.facts}>
            {showDeposit && item.depositAmount ? <li>{money(item.depositAmount, currency)} {t('refundable_deposit')}</li> : null}
            {item.minDays && item.minDays > 1 ? <li>{t('min_days', { count: item.minDays })}</li> : null}
            {item.maxDays ? <li>{t('up_to_days', { count: item.maxDays })}</li> : null}
          </ul>
          {showDescription && item.description ? <p className={styles.description}>{item.description}</p> : null}
          <RentalBookingForm
            key={item._id}
            embedded
            itemId={item._id}
            title={effectiveBookingTitle}
            buttonLabel={effectiveButtonLabel}
            showDeposit={showDeposit}
            showWeeklyPrice={showWeeklyPrice}
            showQuantity={showQuantity}
            monthsShown={monthsShown}
            language={language || apiLanguage}
          />
        </div>
      </div>
    </div>
  );
}

function Gallery({
  item,
  ratio,
  showThumbnails,
  t,
}: {
  item: CatalogItem;
  ratio: string;
  showThumbnails: boolean;
  t: (key: any, params?: any) => string;
}) {
  const images = item.images ?? [];
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = images[Math.min(index, count - 1)];
  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setIndex(0), [item._id]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (count < 2) return;
    if (event.key === 'ArrowRight') step(1);
    if (event.key === 'ArrowLeft') step(-1);
  }

  // Horizontal swipe changes image; mostly-vertical drags are left to page scrolling.
  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count < 2) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    step((dx < 0) !== rtl ? 1 : -1);
  }

  return (
    <div className={styles.gallery} style={{ '--rm-image-ratio': ratio } as CSSProperties}>
      <div
        className={styles.stage}
        tabIndex={count > 1 ? 0 : undefined}
        role={count > 1 ? 'region' : undefined}
        aria-roledescription={count > 1 ? 'carousel' : undefined}
        aria-label={count > 1 ? t('images_carousel', { name: item.name }) : undefined}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current ? (
          <img key={current.src} className={styles.stageImage} src={sizedImage(current.src, 1000)} alt={current.alt || item.name} />
        ) : (
          <span className={styles.placeholder}><PlaceholderIcon /></span>
        )}
        {count > 1 ? (
          <>
            <button type="button" className={styles.arrow} data-side="prev" aria-label={t('prev_image')} onClick={() => step(-1)}>‹</button>
            <button type="button" className={styles.arrow} data-side="next" aria-label={t('next_image')} onClick={() => step(1)}>›</button>
            <span className={styles.counter} aria-live="polite">{index + 1} / {count}</span>
          </>
        ) : null}
      </div>
      {showThumbnails && count > 1 ? (
        <div className={styles.thumbs}>
          {images.map((image, position) => (
            <button
              key={image.src}
              type="button"
              className={styles.thumb}
              aria-label={t('show_image', { number: position + 1 })}
              aria-current={position === index || undefined}
              onClick={() => setIndex(position)}
            >
              <img src={sizedImage(image.src, 200)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
