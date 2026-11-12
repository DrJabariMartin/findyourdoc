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
npm run automations # runs every automation once (reminders, re-checks, email delivery); production runs it hourly
```

Every pull request runs lint, type checks, tests and a build in GitHub Actions (`.github/workflows/ci.yml`).

### Settings

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Database connection. SQLite locally, Postgres in production. |
| `SESSION_SECRET` | Signs login cookies. At least 16 random characters. |
| `STORAGE_DIR` | Where credential documents are stored. Keep it outside the web root. |
| `APP_URL` | Public address used in email links. |
| `LOCUMS_STATES` | Comma-separated states where practices may post locums. Unset allows all (development). In production it starts empty; see the launch market section of [docs/launch.md](docs/launch.md). |
| `EMAIL_TRANSPORT` | `log` prints emails to the server log (development). `hold` keeps them queued (production default). `ses` sends through Amazon SES; see [docs/launch.md](docs/launch.md). |
| `AUTOMATION_SECRET` | Protects `/api/automations`. At least 24 random characters. |
| `EMAIL_FROM` | Sender address for outgoing email. |
| `LAUNCH_STATES` | States where patients can book, comma separated. Default `MD,DC,VA` (the DMV launch market). Other states go to the waitlist. |

## How the rules are enforced in code

| Policy | Where |
|---|---|
| Clinician keeps 100% of their rate; locums fee is 12% on top, paid by the practice | `src/lib/fees.ts` |
| Permanent hire is $9,500 flat; locum-to-permanent fee falls to $0 over 12 months (no non-competes) | `src/lib/fees.ts` |
| Booking fee is a flat $40, only for a completed visit by a new patient who found the clinician here; never for no-shows, cancellations, existing patients, the practice's own website, or patients on Medicare, Medicaid, TRICARE or VA (anti-kickback safeguard) | `src/lib/fees.ts`, `recordVisit` in `src/app/actions/booking.ts` |
| Search ranking uses availability only | `src/app/find/page.tsx` |
| Licensure follows the patient: video visits only for patients located in a state where the clinician holds a verified, unexpired license, inside the launch market; in-person only at a licensed office | `src/lib/market.ts`, `bookSlot` in `src/app/actions/booking.ts` |
| Video bookings record the patient's state and telehealth consent (Maryland Health Occupations 1-1002, COMAR 10.32.05) | `src/app/find/[id]/BookForm.tsx` |
| An admin-set fee waiver (for example the founder's own pilot practice) makes every booking fee $0, and an ownership disclosure shows on the profile; neither changes ranking | `src/lib/fees.ts`, `setPilotTerms` in `src/app/actions/admin.ts` |
| Only verified clinicians can enter the Lounge, apply to jobs or take bookings | `src/lib/session.ts` |
| Anonymous posts reference a handle; the user-to-handle link lives only in `HandleVault` | `prisma/schema.prisma`, `src/app/actions/lounge.ts` |
| Posts that look like they contain patient identifiers are held for a moderator | `src/lib/identifiers.ts` |
| Verification is re-checked every 90 days, automatically where an NPI exists | `src/lib/automation/jobs.ts` |
| No third-party scripts or ad pixels (strict Content Security Policy) | `next.config.ts` |
| Emails never include the visit reason or insurance; clinician emails include no patient details | `src/lib/email.ts` |
| Each visit gets one reminder, even if the job runs twice at once | `src/lib/reminders.ts` |
| A cancelled time opens up again for other patients | `reopen` in `src/app/actions/booking.ts` |
| Sign-up, login, password reset, booking and uploads are rate limited | `src/lib/ratelimit.ts` |
| Credential documents are checked by content (PDF, JPG, PNG only, 10 MB max) and open only for their owner or an admin | `src/app/actions/verify.ts`, `src/app/documents/[id]/route.ts` |
| Password reset links are single use, expire in 1 hour, and are stored only as a hash | `src/app/actions/auth.ts` |

## Automations

Routine work runs by itself and every step is logged on the admin page (`/admin`). A person still makes the calls our policies reserve for people: approving a new member, publishing a held Lounge post, and reinstating a paused profile.

| What happens | When | Code |
|---|---|---|
| NPPES registry check of name, profession, license state and number, shown to the admin as pass or a list of differences | At sign-up, and hourly for anyone not yet checked | `onClinicianSignup`, `precheck-pending` |
| Welcome and "you're verified" emails | At sign-up and approval | `onClinicianSignup`, `onClinicianVerified` |
| 90-day re-check: a clean NPPES result renews the date; any difference pauses the profile (and booking) for review and emails the member; a registry outage changes nothing | Hourly | `recheck-licenses` |
| Credential expiry reminders at 60, 30 and 7 days, then marked expired | Hourly | `credential-reminders` |
| Job alerts to verified clinicians whose profession and license state fit (no pay comparisons) | When a job is posted | `onJobPosted` |
| Patient booking confirmation and clinician notice, then one reminder in the 24 hours before the visit | At booking, hourly | `bookSlot`, `appointment-reminders` (`src/lib/reminders.ts`) |
| Nudge clinicians to record past visits (so fees are right and no-shows are never charged) | Daily | `record-visit-nudges` |
| Daily digest to admins of everything that needs a person | Daily | `admin-digest` |
| Email delivery with retry, once per message; emails held or failed at booking or password reset are retried here | Hourly | `deliver-outbox` |

The rules live in `src/lib/automation/rules.ts` (tested in `tests/automation.test.ts`); the jobs live in `src/lib/automation/jobs.ts`. Emails never include a visit reason or insurance.

**Run them:** `npm run automations` (all jobs) or `npm run automations -- recheck-licenses`. In production, the GitHub Actions workflow `.github/workflows/automations.yml` calls `POST /api/automations?job=all` every hour with `Authorization: Bearer $AUTOMATION_SECRET`. It skips itself until the repository secrets `APP_URL` and `AUTOMATION_SECRET` are set. Every job is safe to repeat.

**Email:** set `EMAIL_TRANSPORT`. `log` prints emails (development); `hold` (the production default) keeps them queued; `ses` sends through Amazon SES and also needs `EMAIL_FROM` and `AWS_REGION`. Use `ses` only after the AWS BAA is accepted and the sending domain is verified. See [docs/launch.md](docs/launch.md).

## Before real patients or clinicians use it

This is a first version. The chosen launch setup, costs and steps are in [docs/launch.md](docs/launch.md). The first pilot (Align Orthopedic & Wellness, Columbia, MD) is set up as in [docs/pilot-align.md](docs/pilot-align.md). Before launch:

- **Hosting:** HIPAA-eligible hosting and database with a signed business associate agreement. Appointment records contain protected health information. Switch Prisma's provider to `postgresql`.
- **Separate the handle vault** into its own database with its own credentials.
- **Email:** turn on Amazon SES under the AWS BAA (`EMAIL_TRANSPORT="ses"`, see [docs/launch.md](docs/launch.md)). Add SMS reminders and email address verification.
- **Document storage:** move credential documents from local disk to encrypted object storage covered by the same agreement.
- **Automated primary-source license checks** to speed up the verification queue.
- **Shared rate limits:** with more than one server, move the counters from memory to Redis or the database.
- **Legal review** of pricing, terms, privacy policy and the booking consent text by healthcare counsel in DC, Maryland and Virginia (and Georgia if Atlanta opens).
