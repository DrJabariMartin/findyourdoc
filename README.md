# FindYourDoc

A verified safe haven for medical professionals, where patients can also find and book verified clinicians of every kind.

- **Find care:** patients search in plain language ("knee pain", "flu", "physical therapy") and book physicians, NPs, PAs, nurses, physical and occupational therapists, pharmacists and more. Free for patients. Results are ordered by availability only; nobody can pay to rank higher.
- **The Lounge:** a private community open only to verified, licensed members, with anonymous posting that shows role and region only.
- **Jobs and locums:** every listing shows what the practice pays, what the clinician takes home and our fee. No non-competes.
- **For practices:** post roles, review verified applicants and move them through hiring.

## Run it locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env        # then set SESSION_SECRET to a long random string
npm run db:push             # creates the local SQLite database
npm run db:seed             # sample data (fictional people only)
npm run dev                 # http://localhost:3000
```

Sample logins (password `demo-password-123`): `admin@example.com` (verification queue), `ortho@example.com`, `pt@example.com`, `np@example.com` (verified clinicians), `pending@example.com` (awaiting verification), `practice@example.com` (practice).

```bash
npm test        # pricing, fee, search, identifier and time-zone rules
npm run lint
npm run build
```

## How the rules are enforced in code

| Policy | Where |
|---|---|
| Clinician keeps 100% of their rate; locums fee is 12% on top, paid by the practice | `src/lib/fees.ts` |
| Permanent hire is $9,500 flat; locum-to-permanent fee falls to $0 over 12 months (no non-competes) | `src/lib/fees.ts` |
| Booking fee is a flat $40, only for a completed visit by a new patient who found the clinician here; never for no-shows, cancellations, existing patients or the practice's own website | `src/lib/fees.ts`, `recordVisit` in `src/app/actions/booking.ts` |
| Search ranking uses availability only | `src/app/find/page.tsx` |
| Only verified clinicians can enter the Lounge, apply to jobs or take bookings | `src/lib/session.ts` |
| Anonymous posts reference a handle; the user-to-handle link lives only in `HandleVault` | `prisma/schema.prisma`, `src/app/actions/lounge.ts` |
| Posts that look like they contain patient identifiers are held for a moderator | `src/lib/identifiers.ts` |
| Verification is re-checked every 90 days | `src/app/actions/admin.ts` |
| No third-party scripts or ad pixels (strict Content Security Policy) | `next.config.ts` |

## Before real patients or clinicians use it

This is a first version. Before launch:

- **Hosting:** HIPAA-eligible hosting and database with a signed business associate agreement. Appointment records contain protected health information. Switch Prisma's provider to `postgresql`.
- **Separate the handle vault** into its own database with its own credentials.
- **Email and SMS:** appointment confirmations and reminders (a HIPAA-compliant provider), plus email verification and password reset.
- **Document upload** for the credential wallet, and automated primary-source license checks.
- **Rate limiting** on sign-up, login and booking.
- **Legal review** of pricing, terms, privacy policy and the booking consent text by healthcare counsel in the launch state.
