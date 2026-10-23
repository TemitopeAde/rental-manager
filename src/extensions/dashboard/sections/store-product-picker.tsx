import { useEffect, useState } from 'react';
import { ChevronsUpDown, ImageOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/dashboard/client';

export interface StoreProductOption {
  id: string;
  name: string;
  price: number;
  image: string;
  visible: boolean;
}

type SearchResult = { version: string; products: StoreProductOption[]; error?: string };

// Combobox over Wix Store products. Searching happens on the backend (fuzzy on Catalog V3,
// name prefix on V1), so the list is never filtered locally.
export function StoreProductPicker({ id, value, onChange, formatPrice }: {
  id: string;
  value: string;
  onChange: (product: StoreProductOption | null) => void;
  formatPrice: (amount: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StoreProductOption[]>([]);
  const [selected, setSelected] = useState<StoreProductOption | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'no-stores'>('idle');
  const [problem, setProblem] = useState('');

  // Show the linked product's name when editing an item that already has one.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let active = true;
    api<{ product: StoreProductOption | null }>(`/api/rentals/store-products?productId=${encodeURIComponent(value)}`)
      .then((body) => {
        if (active) setSelected(body.product ?? { id: value, name: 'Product not found', price: 0, image: '', visible: false });
      })
      .catch(() => {
        if (active) setSelected({ id: value, name: value, price: 0, image: '', visible: true });
      });
    return () => {
      active = false;
    };
    // `selected` is only read to skip a refetch after picking from the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setState('loading');
    const timer = setTimeout(() => {
      api<SearchResult>(`/api/rentals/store-products?search=${encodeURIComponent(search)}`)
        .then((body) => {
          if (!active) return;
          setResults(body.products);
          setProblem(body.error ?? '');
          setState(body.error ? 'error' : body.version === 'STORES_NOT_INSTALLED' ? 'no-stores' : 'idle');
        })
        .catch((error: unknown) => {
          if (!active) return;
          setProblem(error instanceof Error ? error.message : '');
          setState('error');
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, search]);

  function choose(product: StoreProductOption | null) {
    setSelected(product);
    onChange(product);
    setOpen(false);
    setSearch('');
  }

  const empty = {
    loading: 'Searching…',
    error: problem || 'Could not load products. Try again.',
    'no-stores': 'Wix Stores isn\'t installed on this site.',
    idle: search ? `No products match "${search}".` : 'No products yet.',
  }[state];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Wix Store product</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="h-auto min-h-9 flex-1 justify-between gap-2 px-2.5 py-1.5 font-normal">
              {selected ? <ProductRow product={selected} formatPrice={formatPrice} /> : <span className="text-muted-foreground">Select a product…</span>}
              <ChevronsUpDown className="shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Search products by name…" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{empty}</CommandEmpty>
                {state !== 'loading' && results.length > 0 ? (
                  <CommandGroup>
                    {results.map((product) => (
                      <CommandItem key={product.id} value={product.id} data-checked={product.id === value} onSelect={() => choose(product)}>
                        <ProductRow product={product} formatPrice={formatPrice} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected ? (
          <Button variant="ghost" size="icon" aria-label="Remove linked product" onClick={() => choose(null)}><X /></Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Optional. Links this rental to a Store product, even one outside the selected category.</p>
    </div>
  );
}

function ProductRow({ product, formatPrice }: { product: StoreProductOption; formatPrice: (amount: number) => string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      {product.image ? (
        <img src={product.image} alt="" className="size-8 shrink-0 rounded-md border object-cover" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted"><ImageOff className="size-4 text-muted-foreground" /></span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{product.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {product.price ? formatPrice(product.price) : 'No price'}{product.visible ? '' : ' · Hidden'}
        </span>
      </span>
    </span>
  );
}
