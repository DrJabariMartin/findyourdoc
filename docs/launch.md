# Launch setup: decisions and steps

Decided 2026-11-09 and re-checked against current vendor pages the same day. Nothing has been bought or signed. Each step marked **Jabari** spends money or accepts a legal agreement, so it waits for him.

## Decisions

| Need | Choice | Why |
| --- | --- | --- |
| Hosting, database, email, files | **AWS under the AWS Business Associate Addendum (BAA)** | One BAA, accepted online in AWS Artifact at no charge, covers the app, database, file storage and email. Appointment records, patient emails and credential documents all need BAA coverage. |
| App server | **Amazon ECS Express Mode on AWS Fargate**, built from the repo's `Dockerfile` | One command creates the service, load balancer, HTTPS and auto scaling. Express Mode itself is free; you pay for Fargate and the load balancer. |
| Database | **Amazon RDS for PostgreSQL** (small instance), encrypted, with automated backups | Switch Prisma's `provider` to `postgresql` when deploying. |
| Credential documents | **Amazon S3** (encrypted, private bucket) | Fargate's disk is wiped on every restart, so the local `STORAGE_DIR` can't be used in production. `src/lib/storage.ts` needs an S3 version before launch. |
| Patient and member email | **Amazon SES** (`EMAIL_TRANSPORT="ses"`) | HIPAA-eligible since July 2019 under the same BAA. Already built (`src/lib/automation/mailer.ts`). Emails are plain text and never include a visit reason or insurance. |
| Hourly scheduler | **GitHub Actions** (`.github/workflows/automations.yml`) | About 720 of the free 2,000 private-repo minutes a month. The call carries only a secret, never patient data, so it needs no BAA. GitHub runs scheduled workflows only from the default branch, so it starts once this code is on `main`. |
| Checks on every change | **GitHub Actions CI** (`.github/workflows/ci.yml`) | Lint, typecheck, tests and build on each pull request. |

### Corrected in the 2026-11-09 audit
- **App Runner replaced.** The first version of this plan chose AWS App Runner. AWS no longer offers App Runner to new customers and points them to ECS Express Mode instead, so the plan now uses ECS Express Mode.
- **Vercel note corrected.** The plan said Vercel signs a BAA only on its enterprise plan. Since September 2025, Vercel has offered a BAA to Pro teams as a paid add-on. AWS still wins here because one free BAA covers the database, files and email too, which Vercel doesn't host.
- **File storage added.** Credential documents need S3, because a container's own disk isn't permanent.

### Considered and set aside
- **Vercel Pro with its BAA add-on.** It still needs a separate HIPAA database, file store and email provider, each with its own BAA and cost.
- **Supabase.** HIPAA requires its Team plan plus a HIPAA add-on, which costs far more than this whole stack at launch.
- **Postmark** and **SendGrid** don't sign BAAs.
- **Paubox** and **Aptible** are HIPAA-ready but cost more at this size.
- **Zapier** and **Make** can't carry patient data without a BAA.

## Estimated monthly cost at launch (us-east-1)

These are estimates from published rates, not quotes. Check them in the AWS Pricing Calculator before approving.

| Item | Estimate |
| --- | --- |
| Fargate task, 0.5 vCPU and 1 GB, always on | about $18 |
| Application Load Balancer (hourly charge plus light traffic) | about $18 to $25 |
| Public IPv4 addresses for the load balancer | about $7 |
| RDS PostgreSQL db.t4g.micro (about $12) plus 20 GB storage and backups | about $15 to $20 |
| S3, SES, Route 53, logs, container registry | about $3 to $8 |
| GitHub Actions | $0 within the free allowance |
| **Total** | **about $60 to $80 a month** |

The domain itself is extra, usually $10 to $20 a year.

## Steps

1. **Jabari:** Create the AWS account in the company's name, on the company card. This is spend.
2. **Jabari:** Accept the AWS BAA in AWS Artifact. This is a legal agreement.
3. **Jabari:** Confirm the domain, or buy it if it isn't owned yet. This is spend.
4. **Engineering:**
   - Switch Prisma to `postgresql`.
   - Move document storage to S3.
   - Build the `Dockerfile` image and push it to Amazon ECR. The image hasn't been built yet: this sandbox has no Docker daemon.
5. **Engineering:**
   - Create the RDS database, the S3 bucket and the ECS Express Mode service.
   - Set environment variables from `.env.example`.
   - Give the task role only these permissions: `ses:SendEmail`, plus read and write on the one bucket.
6. **Engineering:**
   - Verify the domain in SES (DKIM, SPF, DMARC).
   - Request SES production access. The SES sandbox only sends to verified addresses.
   - Then set `EMAIL_TRANSPORT="ses"`, `EMAIL_FROM` and `AWS_REGION`.
7. **Engineering:** Add the repository secrets `APP_URL` and `AUTOMATION_SECRET`, and merge to `main`. The hourly workflow then starts.
8. **Engineering:**
   - Make a test booking to a staff address.
   - Check that the email was sent.
   - Check that the admin page's Automations section shows the run.

Steps 4 to 8 take about two days once steps 1 to 3 are done.

## Still needed before real patients

- Healthcare counsel reviews the terms, privacy policy and booking consent.
- State-board primary-source license checks.
- Rate limits shared through the database or Redis once there's more than one server.
- Email address verification.
- Moving the handle vault to its own database.
