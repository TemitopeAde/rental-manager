import { useEffect, useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { request } from './client';
import { money, partClass, sizedImage } from './format';
import { absolute, itemPath, navigate, useSiteBase } from './links';
import { itemKey, type CatalogItem } from './types';
import styles from './rental.module.css';

export type CatalogParts = {
  title?: HTMLAttributes<HTMLHeadingElement>;
  field?: HTMLAttributes<HTMLElement>;
  card?: HTMLAttributes<HTMLElement>;
  price?: HTMLAttributes<HTMLParagraphElement>;
  button?: HTMLAttributes<HTMLElement>;
};

export type ImageRatio = 'square' | 'portrait' | 'landscape';
export type ImageHover = 'swap' | 'zoom' | 'none';
type SortOrder = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

const ratios: Record<ImageRatio, string> = { square: '1 / 1', portrait: '3 / 4', landscape: '4 / 3' };

const sortOptions: Array<{ value: SortOrder; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A–Z' },
  { value: 'name-desc', label: 'Name: Z–A' },
];

const samples: CatalogItem[] = [
  { _id: 'sample-1', slug: 'camera-kit', name: 'Mirrorless camera kit', description: 'Body, two lenses and a spare battery.', dailyRate: 45, weeklyRate: 220, category: 'Equipment' },
  { _id: 'sample-2', slug: 'tent', name: 'Four-person tent', description: 'Waterproof, sets up in ten minutes.', dailyRate: 15, weeklyRate: 70, category: 'Outdoor' },
  { _id: 'sample-3', slug: 'speaker', name: 'Party speaker', description: 'Bluetooth, 12 hours of battery.', dailyRate: 30, weeklyRate: 150, category: 'Event' },
];

export function RentalCatalogGrid({
  title = 'Rentals',
  columns = 3,
  pageSize = 12,
  priceBasis = 'daily',
  showCategoryFilter = true,
  showDescription = false,
  showSort = true,
  showRibbon = true,
  showButton = true,
  buttonLabel = 'View details',
  detailsPage = '/rental-details',
  imageRatio = 'square',
  imageHover = 'swap',
  textAlign = 'start',
  parts,
}: {
  title?: string;
  columns?: number;
  pageSize?: number;
  priceBasis?: 'daily' | 'weekly';
  showCategoryFilter?: boolean;
  showDescription?: boolean;
  showSort?: boolean;
  showRibbon?: boolean;
  showButton?: boolean;
  buttonLabel?: string;
  detailsPage?: string;
  imageRatio?: ImageRatio;
  imageHover?: ImageHover;
  textAlign?: 'start' | 'center';
  parts?: CatalogParts;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [currency, setCurrency] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortOrder>('featured');
  const size = Math.max(1, pageSize);
  const [shown, setShown] = useState(size);
  const base = useSiteBase();

  // Each tab asks the backend for its own items; `active` drops a slow response for a tab
  // the visitor has already left.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    request<{ items: CatalogItem[]; categories?: string[]; currency?: string }>(`/api/rentals/catalog${query}`)
      .then((body) => {
        if (!active) return;
        setItems(body.items);
        setCategories(body.categories ?? []);
        setCurrency(body.currency);
      })
      .catch(() => {
        if (!active) return;
        // Editor preview without a backend: filter the samples locally instead.
        setItems(category ? samples.filter((item) => item.category === category) : samples);
        setCategories([...new Set(samples.map((item) => item.category))]);
        setCurrency('USD');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category]);

  useEffect(() => setShown(size), [size]);

  const weekly = priceBasis === 'weekly';
  const priceOf = (item: CatalogItem) => (weekly && item.weeklyRate > 0 ? item.weeklyRate : item.dailyRate);

  const sorted = useMemo(() => {
    const compare: Record<SortOrder, ((a: CatalogItem, b: CatalogItem) => number) | null> = {
      featured: null,
      'price-asc': (a, b) => priceOf(a) - priceOf(b),
      'price-desc': (a, b) => priceOf(b) - priceOf(a),
      'name-asc': (a, b) => a.name.localeCompare(b.name),
      'name-desc': (a, b) => b.name.localeCompare(a.name),
    };
    const by = compare[sort];
    return by ? [...items].sort(by) : items;
    // priceOf only depends on `weekly`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort, weekly]);

  const visible = sorted.slice(0, shown);
  const span = Math.min(4, Math.max(1, columns));
  const gridStyle = {
    '--rm-columns': span,
    '--rm-columns-sm': Math.min(span, 2),
    '--rm-image-ratio': ratios[imageRatio] ?? ratios.square,
  } as CSSProperties;

  function choose(next: string) {
    if (next === category) return;
    setCategory(next);
    setShown(size);
  }

  // Sort stays visible while a filtered tab has a single item, so the toolbar doesn't jump.
  const sortable = showSort && (items.length > 1 || category !== '');
  const toolbar = (showCategoryFilter && categories.length > 1) || sortable;

  return (
    <section className={styles.catalog} data-align={textAlign}>
      <header className={styles.catalogHeader}>
        {title ? <h2 {...parts?.title} className={partClass(styles.heading, parts?.title)}>{title}</h2> : null}
        {toolbar ? (
          <div className={styles.toolbar}>
            {showCategoryFilter && categories.length > 1 ? (
              <div className={styles.chips} role="group" aria-label="Filter by category">
                {['', ...categories].map((name) => (
                  <button
                    key={name || 'all'}
                    {...parts?.field}
                    type="button"
                    className={[styles.chip, parts?.field?.className].filter(Boolean).join(' ')}
                    aria-pressed={category === name}
                    onClick={() => choose(name)}
                  >
                    {name || 'All'}
                  </button>
                ))}
              </div>
            ) : <span />}
            {sortable ? (
              <label className={styles.sort}>
                <span className={styles.sortLabel}>Sort by</span>
                <span className={styles.selectWrap}>
                  <select className={styles.sortSelect} value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
      </header>

      {loading ? (
        <div className={styles.grid} style={gridStyle} aria-busy="true">
          {Array.from({ length: Math.min(size, span * 2) }, (_, index) => (
            <div key={index} className={styles.skeletonCard}>
              <div className={styles.skeleton} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} data-short />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>No rentals are available right now. Check back soon.</p>
      ) : (
        <ul className={styles.grid} style={gridStyle}>
          {visible.map((item) => {
            const path = itemPath(detailsPage, itemKey(item));
            const href = path ? absolute(base, path) : undefined;
            const [first, second] = item.images ?? [];
            const swap = imageHover === 'swap' && second;
            const unit = weekly && item.weeklyRate > 0 ? 'week' : 'day';
            return (
              <li key={item._id} {...parts?.card} className={[styles.card, parts?.card?.className].filter(Boolean).join(' ')} data-hover={imageHover}>
                <a
                  className={styles.media}
                  href={href}
                  onClick={(event) => navigate(event, path)}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {first ? (
                    <>
                      <img className={styles.image} src={sizedImage(first.src, 720)} alt="" loading="lazy" />
                      {swap ? <img className={styles.imageAlt} src={sizedImage(second.src, 720)} alt="" loading="lazy" /> : null}
                    </>
                  ) : (
                    <span className={styles.imagePlaceholder}><PlaceholderIcon /></span>
                  )}
                  {showRibbon && item.category ? <span className={styles.ribbon}>{item.category}</span> : null}
                </a>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>
                    <a className={styles.cardLink} href={href} onClick={(event) => navigate(event, path)}>{item.name}</a>
                  </h3>
                  {showDescription && item.description ? <p className={styles.cardText}>{item.description}</p> : null}
                  <p {...parts?.price} className={partClass(styles.price, parts?.price)}>
                    {money(priceOf(item), currency)}
                    <span className={styles.priceUnit}> / {unit}</span>
                  </p>
                  {item.minDays && item.minDays > 1 ? <span className={styles.cardMeta}>{item.minDays}-day minimum</span> : null}
                </div>
                {showButton ? (
                  <a
                    {...parts?.button}
                    className={[styles.cardButton, parts?.button?.className].filter(Boolean).join(' ')}
                    href={href}
                    onClick={(event) => navigate(event, path)}
                    aria-label={`${buttonLabel}: ${item.name}`}
                  >
                    {buttonLabel}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {sorted.length > shown ? (
        <div className={styles.loadMore}>
          <button
            {...parts?.button}
            type="button"
            className={[styles.pagerButton, parts?.button?.className].filter(Boolean).join(' ')}
            onClick={() => setShown((value) => value + size)}
          >
            Load more
          </button>
          <span className={styles.pagerStatus}>Showing {visible.length} of {sorted.length}</span>
        </div>
      ) : null}
    </section>
  );
}

export function PlaceholderIcon() {
  return (
    <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="10" width="36" height="28" rx="4" />
      <circle cx="17" cy="20" r="3.5" />
      <path d="m42 32-9-9-15 15" />
    </svg>
  );
}
