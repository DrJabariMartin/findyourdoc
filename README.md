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
| Verification is re-checked every 90 days, automatically where an NPI exists | `src/lib/automation/jobs.ts` |
| No third-party scripts or ad pixels (strict Content Security Policy) | `next.config.ts` |

## Automations

Routine work runs by itself and every step is logged on the admin page (`/admin`). A person still makes the calls our policies reserve for people: approving a new member, publishing a held Lounge post, and reinstating a paused profile.

| What happens | When | Code |
|---|---|---|
| NPPES registry check of name, profession, license state and number, shown to the admin as pass or a list of differences | At sign-up, and hourly for anyone not yet checked | `onClinicianSignup`, `precheck-pending` |
| Welcome and "you're verified" emails | At sign-up and approval | `onClinicianSignup`, `onClinicianVerified` |
| 90-day re-check: a clean NPPES result renews the date; any difference pauses the profile (and booking) for review and emails the member; a registry outage changes nothing | Hourly | `recheck-licenses` |
| Credential expiry reminders at 60, 30 and 7 days, then marked expired | Hourly | `credential-reminders` |
| Job alerts to verified clinicians whose profession and license state fit (no pay comparisons) | When a job is posted | `onJobPosted` |
| Patient booking confirmation, and a reminder about 24 hours before | At booking, hourly | `onAppointmentBooked`, `appointment-reminders` |
| Nudge clinicians to record past visits (so fees are right and no-shows are never charged) | Daily | `record-visit-nudges` |
| Daily digest to admins of everything that needs a person | Daily | `admin-digest` |
| Email delivery with retry, once per message | Hourly | `deliver-outbox` |

The rules live in `src/lib/automation/rules.ts` (tested in `tests/automation.test.ts`); the jobs live in `src/lib/automation/jobs.ts`. Emails never include a visit reason or insurance.

**Run them:** `npm run automations` (all jobs) or `npm run automations -- recheck-licenses`. In production, the GitHub Actions workflow `.github/workflows/automations.yml` calls `POST /api/automations?job=all` every hour with `Authorization: Bearer $AUTOMATION_SECRET`. It skips itself until the repository secrets `APP_URL` and `AUTOMATION_SECRET` are set. Every job is safe to repeat.

**Email:** set `EMAIL_TRANSPORT`. `log` prints emails (development); `hold` (the production default) keeps them queued; `ses` sends through Amazon SES and also needs `EMAIL_FROM` and `AWS_REGION`. Use `ses` only after the AWS BAA is accepted and the sending domain is verified. See [docs/launch.md](docs/launch.md).

## Before real patients or clinicians use it

This is a first version. The chosen launch setup, costs and steps are in [docs/launch.md](docs/launch.md). Before launch:

- **Hosting:** HIPAA-eligible hosting and database with a signed business associate agreement. Appointment records contain protected health information. Switch Prisma's provider to `postgresql`.
- **Separate the handle vault** into its own database with its own credentials.
- **Email and SMS:** appointment confirmations and reminders (a HIPAA-compliant provider), plus email verification and password reset.
- **Document upload** for the credential wallet, and state-board primary-source checks (the automated check today uses NPPES, which confirms identity and taxonomy but not license standing).
- **Rate limiting** on sign-up, login and booking.
- **Legal review** of pricing, terms, privacy policy and the booking consent text by healthcare counsel in the launch state.
