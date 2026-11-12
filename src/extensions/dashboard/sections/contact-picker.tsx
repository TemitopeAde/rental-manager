import { useEffect, useState } from 'react';
import { ChevronsUpDown, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/dashboard/client';
import { useI18n } from '@/i18n';

export interface ContactOption {
  id: string;
  name: string;
  email: string;
  phone: string;
}

// Combobox over the site's Wix contacts. The backend matches name or email prefixes,
// so the list is never filtered locally.
export function ContactPicker({ id, value, onChange }: {
  id: string;
  value: ContactOption | null;
  onChange: (contact: ContactOption | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ContactOption[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setState('loading');
    const timer = setTimeout(() => {
      api<{ contacts: ContactOption[] }>(`/api/rentals/contacts?q=${encodeURIComponent(search)}`)
        .then((body) => {
          if (!active) return;
          setResults(body.contacts ?? []);
          setState('idle');
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

  function choose(contact: ContactOption | null) {
    onChange(contact);
    setOpen(false);
    setSearch('');
  }

  const empty = {
    loading: t('contact_picker.searching'),
    error: problem || t('contact_picker.load_failed'),
    idle: search ? t('contact_picker.no_matches', { search }) : t('contact_picker.no_contacts'),
  }[state];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('contact_picker.label')}</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="h-auto min-h-9 min-w-0 flex-1 justify-between gap-2 px-2.5 py-1.5 font-normal">
              {value ? <ContactRow contact={value} /> : <span className="text-muted-foreground">{t('contact_picker.placeholder')}</span>}
              <ChevronsUpDown className="shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder={t('contact_picker.search_placeholder')} value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty>{empty}</CommandEmpty>
                {state !== 'loading' && results.length > 0 ? (
                  <CommandGroup>
                    {results.map((contact, index) => (
                      <CommandItem key={contact.id} value={`${index} ${contact.name} ${contact.email}`} data-checked={contact.id === value?.id} onSelect={() => choose(contact)}>
                        <ContactRow contact={contact} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value ? (
          <Button variant="ghost" size="icon" aria-label={t('contact_picker.clear_aria')} onClick={() => choose(null)}><X /></Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t('contact_picker.tip')}</p>
    </div>
  );
}

function ContactRow({ contact }: { contact: ContactOption }) {
  const detail = [contact.name ? contact.email : '', contact.phone].filter(Boolean).join(' · ');
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted"><UserRound className="size-4 text-muted-foreground" /></span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{contact.name || contact.email}</span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </span>
  );
}
