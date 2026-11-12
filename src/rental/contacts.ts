import { contacts } from '@wix/crm';
import { auth } from '@wix/essentials';

const queryContacts = auth.elevate(contacts.queryContacts);

export interface ContactOption {
  id: string;
  name: string;
  email: string;
  phone: string;
}

function toOption(contact: contacts.Contact): ContactOption {
  const first = contact.info?.name?.first?.trim() ?? '';
  const last = contact.info?.name?.last?.trim() ?? '';
  return {
    id: contact._id ?? '',
    name: [first, last].filter(Boolean).join(' '),
    email: contact.primaryInfo?.email?.trim() ?? '',
    phone: contact.primaryInfo?.phone?.trim() ?? '',
  };
}

// Site contacts for the dashboard's renter picker: the most recently active when there's no search text,
// otherwise those whose first name, last name or email starts with it.
export async function searchContacts(text: string, limit = 20): Promise<ContactOption[]> {
  const term = text.trim().slice(0, 100);
  const query: contacts.ContactQuery = term
    ? {
        filter: {
          $or: [
            { 'info.name.first': { $startsWith: term } },
            { 'info.name.last': { $startsWith: term } },
            { 'primaryInfo.email': { $startsWith: term.toLowerCase() } },
          ],
        },
        paging: { limit },
      }
    : { sort: [{ fieldName: 'lastActivity.activityDate', order: 'DESC' }], paging: { limit } };
  let result;
  try {
    result = await queryContacts(query);
  } catch (error) {
    // Some sites reject sorting by last activity; the unsorted list is still useful.
    if (term || /permission|forbidden|403/i.test(String(error instanceof Error ? error.message : error))) throw error;
    result = await queryContacts({ paging: { limit } });
  }
  return (result.contacts ?? []).map(toOption).filter((option) => option.id && (option.name || option.email));
}
