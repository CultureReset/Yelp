/**
 * Verification methods, strongest first.
 *
 * The rule that makes claiming work: every method targets the contact detail
 * ALREADY on the listing, never one the claimant supplies. A claimant who can
 * change the phone number and then verify against it has verified nothing.
 * See docs/02-identity-auth-claiming.md.
 */
export const METHODS = [
  {
    key: 'phone_call',
    label: 'Call the business phone',
    blurb: 'We call the number on the listing and read out a 6-digit code.',
    strength: 'Strongest',
    needs: 'phone' as const,
    minutes: 2,
  },
  {
    key: 'sms',
    label: 'Text the business phone',
    blurb: 'We text a 6-digit code to the number on the listing.',
    strength: 'Strong',
    needs: 'phone' as const,
    minutes: 2,
  },
  {
    key: 'domain_email',
    label: 'Email at the business domain',
    blurb: 'Only available if your email address matches the website on the listing.',
    strength: 'Strong',
    needs: 'domain' as const,
    minutes: 5,
  },
  {
    key: 'postcard',
    label: 'Postcard to the business address',
    blurb: 'We mail a code to the address on the listing. Slow, but it proves you are there.',
    strength: 'Slow but solid',
    needs: 'address' as const,
    minutes: 60 * 24 * 7,
  },
  {
    key: 'document',
    label: 'Upload a document',
    blurb: 'A business licence, utility bill, or tax document. Reviewed by a person.',
    strength: 'Reviewed by hand',
    needs: 'none' as const,
    minutes: 60 * 24 * 2,
  },
] as const;

export type MethodKey = (typeof METHODS)[number]['key'];

export const MAX_CODE_ATTEMPTS = 5;
export const MAX_SENDS_PER_DAY = 3;
export const CLAIM_TTL_DAYS = 7;

/**
 * Shown in full, deliberately. These details are already public on the
 * business page, so masking them hides nothing from an attacker while making
 * the owner guess which number we are about to call. The security property
 * that matters is above: we verify against the LISTING's details, never
 * against anything the claimant types in.
 */
export function targetPhone(phone: string): string {
  return phone;
}

export function targetEmailDomain(domain: string): string {
  return `your address at ${domain}`;
}

export function targetAddress(address: string, city: string | null): string {
  return [address, city].filter(Boolean).join(', ');
}

export function methodAvailable(
  key: MethodKey,
  biz: { phone: string | null; websiteDomain: string | null; address1: string | null },
  userEmail: string,
): { available: boolean; reason?: string } {
  const m = METHODS.find((x) => x.key === key)!;
  if (m.needs === 'phone' && !biz.phone) {
    return { available: false, reason: 'This listing has no phone number.' };
  }
  if (m.needs === 'domain') {
    if (!biz.websiteDomain) return { available: false, reason: 'This listing has no website.' };
    const emailDomain = userEmail.split('@')[1]?.toLowerCase();
    if (emailDomain !== biz.websiteDomain.toLowerCase()) {
      return {
        available: false,
        reason: `Your email is not at ${biz.websiteDomain}.`,
      };
    }
  }
  if (m.needs === 'address' && !biz.address1) {
    return { available: false, reason: 'This listing has no street address.' };
  }
  return { available: true };
}

export const STATE_LABELS: Record<string, string> = {
  claim_started: 'Started',
  verification_sent: 'Code sent',
  verified: 'Verified',
  manual_review: 'Being reviewed',
  claimed: 'Claimed',
  denied: 'Not approved',
  disputed: 'Disputed',
  expired: 'Expired',
};
