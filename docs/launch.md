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

## Launch market: DC, Maryland and Virginia (Atlanta second)

Decided 2026-11-10. The primary market is the DC area: the District of Columbia, Maryland and Virginia. Atlanta, Georgia is an optional second market that opens only after the DC area works. Community, permanent hiring and booking are open nationally, but outreach, content and the Founding 100 focus on the DC area.

### Company registration
- **Incorporate in Delaware** (C-corp), as decided on 2026-11-09.
- **Register as a foreign corporation in the jurisdiction where Jabari lives and works first.** That is where the company "does business" from day one.
- **Add DC, Maryland or Virginia when the company gets an office, an employee, or a state license there.** A Maryland staffing license (see below) requires being registered in Maryland.
- **Register in Georgia only when Atlanta opens.** This replaces the 2026-11-09 plan to register in Georgia at launch.

### Licensing that affects the product

| | DC | Maryland | Virginia | Georgia (second) |
| --- | --- | --- | --- | --- |
| Physicians: Interstate Medical Licensure Compact | Member | Member | **Not confirmed. Plan on a full Virginia license.** | Member |
| Nurses: Nurse Licensure Compact | **Not a member.** RNs need a DC license. | Member | Member | Member |
| PT Compact | Member, issuing and accepting privileges | Member, issuing and accepting privileges | Member (check DHP for status) | Member |
| Temporary staffing (locums) | DC Health licenses nurse staffing agencies | MDH OHCQ licenses any "health care staff agency" that refers practitioners, as employees or contractors, for temporary work at a facility | Check for any nurse staffing agency registration | Check |

What this means:
- **Compacts speed up licensing but don't replace it.** A clinician still needs a license or compact privilege in the state where the patient is. Verification keeps checking the license for the state where the clinician practices.
- **Telehealth follows the patient.** A video visit needs a license where the patient is located. Booking is in-person only today, so nothing changes yet. A telehealth option must check the patient's state against the clinician's licenses.
- **Locums is gated by state.** FindYourDoc refers clinicians for temporary work at practices and charges 12% on top, so Maryland's definition probably covers it, and DC's covers nurses. `LOCUMS_STATES` lists the states where locums posts are allowed. In production it starts empty, and each state is added when counsel says no license is needed or the license is granted. Permanent and per-diem posts work everywhere.

### Taxes on the practice subscription
- **Maryland** taxes SaaS at 6%, and since July 1, 2025 it also charges 3% on many data and IT services. Treat practice plans as taxable in Maryland until a CPA says otherwise.
- **DC** taxes many digital and SaaS products. Have a CPA confirm.
- **Virginia** doesn't generally tax SaaS.
- Turn on Stripe Tax when Stripe is set up.

### Government plans (booking fee is never charged)
The fee exemption now also matches the local plan names: Maryland HealthChoice and MCHP, Virginia Cardinal Care and FAMIS, DC Healthy Families and DC Healthcare Alliance. It still matches Georgia's PeachCare.

### Sources (checked 2026-11-10)
- PT Compact map: [DC](https://ptcompact.org/State/DC), [Maryland](https://ptcompact.org/State/MD), [Virginia DHP](https://www.dhp.virginia.gov/Boards/PhysicalTherapy/PractitionerResources/PTLicensureCompact/)
- Nurse Licensure Compact membership: [overview](https://en.wikipedia.org/wiki/Nurse_Licensure_Compact) (DC not a member)
- Maryland OHCQ: [Health Care Staff Agencies](https://health.maryland.gov/ohcq/Pages/Health-Care-Staff-Agencies.aspx)
- DC Health: [nurse staffing agency regulations](https://dchealth.dc.gov/sites/default/files/dc/sites/doh/publication/attachments/Regulations%20for%20Nurse%20Staffing%20Agencies%20%2822B%20DCMR%204900%29%20%28as%20of%2004.21.23%29.pdf)
- IMLC participating states: [imlcc.com](https://imlcc.com/faqs/). Confirm Virginia on the live map before relying on it.
- Maryland 3% tech services tax: [Venable](https://www.venable.com/insights/publications/2025/07/salt-alert-maryland-enacts-3-sales-tax-on-tech)

Healthcare counsel should confirm the locums and staffing questions in all three jurisdictions before any locums post goes live.

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
3. **Jabari:** Have a trademark attorney clear the name first. "FindYourDoc" may conflict with existing "Find My Doc" filings and apps. Buy the domain, and commission a logo, only after the name is cleared. This is spend. Steps 1, 2 and 4 don't depend on the name, so they can go ahead. The SES and app setup in steps 5 to 7 waits for the domain.
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
