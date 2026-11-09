# Launch setup: decisions and steps

Decided 2026-11-09 so the automations can run in production. Nothing here has been bought or signed yet. Each step marked **Jabari** spends money or accepts a legal agreement, so it waits for him.

## Decisions

| Need | Choice | Why |
| --- | --- | --- |
| Hosting, database, email | **Amazon Web Services under the AWS Business Associate Addendum (BAA)** | One BAA covers the app server, the Postgres database, backups and email. The BAA is accepted online in AWS Artifact at no charge. Appointment records and patient emails are protected health information, so every service that touches them must be covered. |
| Patient and member email | **Amazon SES** (`EMAIL_TRANSPORT="ses"`) | Covered by the same BAA. Already built into the app (`src/lib/automation/mailer.ts`). Plain-text emails only, and they never include a visit reason or insurance. |
| App server | **AWS App Runner** running the Next.js app | Runs a container with no servers to manage. |
| Database | **Amazon RDS for PostgreSQL**, encrypted, with automated backups | Switch Prisma's `provider` to `postgresql` when deploying. |
| Hourly scheduler | **GitHub Actions** (`.github/workflows/automations.yml`) | Free within the private-repo allowance (about 720 of 2,000 minutes a month). The call carries only the secret, never patient data, so it doesn't need a BAA. |
| Checks on every change | **GitHub Actions CI** (`.github/workflows/ci.yml`) | Runs lint, typecheck, tests and build on each pull request. |

Considered and set aside:
- **Vercel** offers a BAA only on its enterprise plan.
- **Postmark** and **SendGrid** don't sign BAAs.
- **Paubox** and **Aptible** are HIPAA-ready, but each covers only part of the stack and costs more at this size.
- **Zapier** and **Make** can't carry patient data without a BAA.

## Estimated monthly cost at launch

These are estimates, not quotes. Check them in the AWS Pricing Calculator before approving.

| Item | Estimate |
| --- | --- |
| App Runner (1 vCPU, 2 GB) | about $25 to $50 |
| RDS PostgreSQL (small instance, 20 GB, backups) | about $15 to $30 |
| SES email | $0.10 per 1,000 emails, so a few dollars |
| Domain and DNS (Route 53) | about $1 to $2, plus the domain itself |
| GitHub Actions | $0 within the free allowance |
| **Total** | **about $45 to $85 a month** |

## Steps

1. **Jabari:** Create the AWS account in the company's name on the company card. This is spend.
2. **Jabari:** In AWS Artifact, accept the AWS BAA for the account. This is a legal agreement.
3. **Jabari:** Confirm the domain, and buy it if it isn't owned yet. This is spend.
4. **Engineering:** Create the RDS database and the App Runner service, set environment variables from `.env.example`, and switch Prisma to `postgresql`.
5. **Engineering:** Verify the domain in SES (DKIM, SPF, DMARC), then request SES production access. The SES sandbox only sends to verified addresses.
6. **Engineering:** Set `EMAIL_TRANSPORT="ses"`, `EMAIL_FROM` and `AWS_REGION` on the app. Give the app's IAM role permission to call `ses:SendEmail` only.
7. **Engineering:** Add the repository secrets `APP_URL` and `AUTOMATION_SECRET`. The hourly workflow starts on its next run.
8. **Engineering:** Send a test booking to a staff address, then check the admin page's Automations section for "sent".

Steps 4 to 8 take about a day once steps 1 to 3 are done.

## Still needed before real patients

These come from the README and are unchanged:
- Healthcare counsel reviews the terms, privacy policy and booking consent.
- State-board primary-source checks.
- Rate limiting.
- Email verification and password reset.
- Moving the handle vault to its own database.
