// Pure rules for owner notifications: no SDK imports, so they can be unit tested without a Wix site.

/** A deliberately simple check: one @, something before it, and a dot in the domain. */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Where owner alerts go: the address set in Settings, else the owner's Wix login email, else nowhere. */
export function ownerAlertAddress(configured: string, ownerLoginEmail: string): string {
  const chosen = configured.trim();
  if (chosen && isEmailAddress(chosen)) return chosen;
  return isEmailAddress(ownerLoginEmail) ? ownerLoginEmail.trim() : '';
}

export interface OrderLine {
  reference: string;
  status: string;
}

/** Subject and heading for the one owner email sent per paid order. */
export function orderAlertTitle(orderNumber: string, lines: OrderLine[]): { subject: string; heading: string; needsApproval: boolean } {
  const needsApproval = lines.some((line) => line.status === 'pending');
  const label = orderNumber ? `order #${orderNumber}` : 'order';
  const count = lines.length === 1 ? lines[0].reference : `${lines.length} rentals`;
  return {
    needsApproval,
    subject: needsApproval ? `Approve new rental ${label} (${count})` : `New rental ${label} (${count})`,
    heading: needsApproval
      ? lines.length === 1 ? 'A new rental needs your approval' : 'New rentals need your approval'
      : lines.length === 1 ? 'A new rental is confirmed' : 'New rentals are confirmed',
  };
}
