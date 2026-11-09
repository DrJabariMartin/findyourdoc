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
npm test        # pricing, fee, identifier, time-zone, rate-limit, email and reminder rules
npm run lint
npm run build
npm run reminders   # sends reminders for visits in the next 24 hours; schedule it every 15 minutes
```

Every pull request runs lint, type checks, tests and a build in GitHub Actions (`.github/workflows/ci.yml`).

### Settings

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Database connection. SQLite locally, Postgres in production. |
| `SESSION_SECRET` | Signs login cookies. At least 16 random characters. |
| `STORAGE_DIR` | Where credential documents are stored. Keep it outside the web root. |
| `APP_URL` | Public address used in email links. |
| `EMAIL_PROVIDER` | `console` prints emails to the server log. Any other value fails until a real provider is wired into `src/lib/email.ts`. |
| `EMAIL_FROM` | Sender address for outgoing email. |

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
| Emails never include the visit reason or insurance; clinician emails include no patient details | `src/lib/email.ts` |
| Each visit gets one reminder, even if the job runs twice at once | `src/lib/reminders.ts` |
| A cancelled time opens up again for other patients | `reopen` in `src/app/actions/booking.ts` |
| Sign-up, login, password reset, booking and uploads are rate limited | `src/lib/ratelimit.ts` |
| Credential documents are checked by content (PDF, JPG, PNG only, 10 MB max) and open only for their owner or an admin | `src/app/actions/verify.ts`, `src/app/documents/[id]/route.ts` |
| Password reset links are single use, expire in 1 hour, and are stored only as a hash | `src/app/actions/auth.ts` |

## Before real patients or clinicians use it

This is a first version. Before launch:

- **Hosting:** HIPAA-eligible hosting and database with a signed business associate agreement. Appointment records contain protected health information. Switch Prisma's provider to `postgresql`.
- **Separate the handle vault** into its own database with its own credentials.
- **Email and SMS provider** that signs a business associate agreement, wired into `send()` in `src/lib/email.ts`. Add SMS reminders and email address verification.
- **Document storage:** move credential documents from local disk to encrypted object storage covered by the same agreement.
- **Automated primary-source license checks** to speed up the verification queue.
- **Shared rate limits:** with more than one server, move the counters from memory to Redis or the database.
- **Scheduler:** run `npm run reminders` every 15 minutes (a cron job or the host's scheduler).
- **Legal review** of pricing, terms, privacy policy and the booking consent text by healthcare counsel in the launch state.
