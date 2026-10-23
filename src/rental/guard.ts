import { auth } from '@wix/essentials';
import { members } from '@wix/members';
import { json } from './http';

export async function merchantOnly(): Promise<Response | undefined> {
  const token = await auth.getTokenInfo();
  if (token.subjectType === 'USER') return undefined;
  return json({ ok: false, message: 'Sign in to the site dashboard to manage rentals.' }, 403);
}

export interface SiteMember {
  memberId: string;
  email: string;
}

// The logged-in site member making this request, or null for visitors and dashboard users.
export async function currentMember(): Promise<SiteMember | null> {
  try {
    const token = await auth.getTokenInfo();
    if (token.subjectType !== 'MEMBER' || !token.subjectId) return null;
    const { member } = await members.getCurrentMember({ fieldsets: ['FULL'] });
    if (!member?._id) return null;
    return { memberId: member._id, email: (member.loginEmail ?? '').trim().toLowerCase() };
  } catch (error) {
    console.error('currentMember failed', error);
    return null;
  }
}
