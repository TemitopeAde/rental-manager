import type { APIRoute } from 'astro';
import { searchContacts } from '../../../rental/contacts';
import { merchantOnly } from '../../../rental/guard';
import { json, str } from '../../../rental/http';
import { isPermissionError } from '../../../rental/refund-rules';
import { readableError } from '../../../lib/error-text';

export const GET: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const url = new URL(request.url);
  try {
    const contacts = await searchContacts(str(url.searchParams.get('q')));
    return json({ contacts });
  } catch (error) {
    console.error('[contacts] query failed', error);
    if (isPermissionError(error)) {
      return json({ message: 'The app needs the "Read Contacts" permission to list your contacts.' }, 403);
    }
    const raw = error instanceof Error ? error.message : JSON.stringify(error);
    return json({ message: readableError(raw, 'Could not load contacts.') }, 500);
  }
};
