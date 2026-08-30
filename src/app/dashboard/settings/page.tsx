import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guard';
import { SectionScaffold } from '@/components/section-scaffold';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page() {
  // Route guard: this section declares the permission it needs.
  await requirePermission('business.read');

  return (
    <SectionScaffold
      title={'Settings'}
      purpose={'Your account, your team, and your organization.'}
      note={'Notification preferences are per-user, not per-business — a matrix of event type against channel.'}
      slots={[
        {
                "name": "Profile",
                "status": "next",
                "detail": "Name, email with re-verification on change, phone, photo, locale, timezone.",
                "fields": [
                        "users.email",
                        "locale",
                        "timezone"
                ]
        },
        {
                "name": "Security",
                "status": "next",
                "detail": "Password, TOTP and passkey enrollment, recovery codes, active session list with per-device revoke.",
                "fields": [
                        "auth_credentials",
                        "sessions",
                        "recovery_codes"
                ]
        },
        {
                "name": "Users & permissions",
                "status": "next",
                "detail": "Invite, list, change role, scope to locations, remove, transfer ownership.",
                "fields": [
                        "memberships.role",
                        "location_scope",
                        "invitations"
                ]
        },
        {
                "name": "Notifications",
                "status": "planned",
                "detail": "Event type by channel matrix: email, push, SMS, in-app.",
                "fields": [
                        "notification_prefs"
                ]
        },
        {
                "name": "Organization",
                "status": "planned",
                "detail": "Legal name, billing address, tax ID, locations list, and location transfer.",
                "fields": [
                        "organizations.legal_name",
                        "tax_id"
                ]
        },
        {
                "name": "Integrations & API keys",
                "status": "planned",
                "detail": "Connected apps, scoped keys with last-used timestamps and one-click rotation, webhooks.",
                "fields": [
                        "api_keys.prefix",
                        "scopes"
                ]
        },
        {
                "name": "Data & privacy",
                "status": "planned",
                "detail": "Export your data, deletion request, consent settings, and platform access log.",
                "fields": [
                        "audit_log"
                ]
        },
        {
                "name": "Close account",
                "status": "planned",
                "detail": "States the consequence plainly: the listing does not disappear, it reverts to unclaimed.",
                "fields": [
                        "users.status"
                ]
        }
]}
    />
  );
}
