import { auth } from '@wix/essentials';
import { json } from './http';

export async function merchantOnly(): Promise<Response | undefined> {
  const token = await auth.getTokenInfo();
  if (token.subjectType === 'USER') return undefined;
  return json({ ok: false, message: 'Sign in to the site dashboard to manage rentals.' }, 403);
}
