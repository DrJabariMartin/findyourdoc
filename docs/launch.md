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
- **Register as a foreign corporation in Maryland only.** The founder's practice and the first pilot are in Columbia, Maryland, so that is where the company does business from day one. A Maryland staffing license (see below) also requires it.
- **Don't register in DC, Virginia or Georgia yet.** Selling to customers there over the internet doesn't require it. Add a jurisdiction only when the company gets an office, an employee or a state license there. This replaces the 2026-11-09 plan to register in Georgia at launch.

### Licensing that affects the product

| | DC | Maryland | Virginia | Georgia (second) |
| --- | --- | --- | --- | --- |
| Physicians: Interstate Medical Licensure Compact | Member | Member | **Not a member.** Physicians need a full Virginia license. | Member |
| Nurses: Nurse Licensure Compact | **Not a member.** RNs need a DC license. | Member | Member | Member |
| PT Compact | Member, issuing and accepting privileges | Member, issuing and accepting privileges | Member | Member |
| Temporary staffing (locums) | DC Health licenses nurse staffing agencies | MDH OHCQ licenses any "health care staff agency" that refers practitioners, as employees or contractors, for temporary work at a facility | No state license for employment or nurse staffing agencies | Not checked. Check when Atlanta opens. |

What this means:
- **Compacts speed up licensing but don't replace it.** A clinician still needs a license or compact privilege in the state where the patient is. Verification keeps checking the license for the state where the clinician practices.
- **Telehealth follows the patient.** A video visit needs a license where the patient is located. Booking is in-person only today, so nothing changes yet. A telehealth option must check the patient's state against the clinician's licenses.
- **Locums is gated by state.** FindYourDoc refers clinicians for temporary work at practices and charges 12% on top, so Maryland's definition probably covers it, and DC's covers nurses. `LOCUMS_STATES` lists the states where locums posts are allowed. In production it starts empty. **Virginia is the likely first state**, because it has no staffing-agency license; add it as soon as counsel confirms. Add Maryland and DC when counsel says no license is needed or the license is granted. Permanent and per-diem posts work everywhere.

### Taxes on the practice subscription
- **Maryland: collect from the first sale**, because the company is physically there. Software subscriptions sold to businesses are taxed at 3% (the rate that started July 1, 2025); sales to individual consumers are 6%. A CPA should confirm the practice plans fall under the 3% rule.
- **DC: nothing to collect until sales there pass $100,000 or 200 transactions in a year.** After that, SaaS is taxed at 6%.
- **Virginia: nothing to collect.** It doesn't generally tax SaaS.
- Turn on Stripe Tax when Stripe is set up. It tracks the DC threshold, so nobody has to.

### Government plans (booking fee is never charged)
The fee exemption now also matches the local plan names: Maryland HealthChoice and MCHP, Virginia Cardinal Care and FAMIS, DC Healthy Families and DC Healthcare Alliance. It still matches Georgia's PeachCare.

### Sources (checked 2026-11-10, re-checked 2026-11-12)
- PT Compact map: [DC](https://ptcompact.org/State/DC), [Maryland](https://ptcompact.org/State/MD), [Virginia DHP](https://www.dhp.virginia.gov/Boards/PhysicalTherapy/PractitionerResources/PTLicensureCompact/)
- Nurse Licensure Compact membership: [overview](https://en.wikipedia.org/wiki/Nurse_Licensure_Compact) (DC not a member)
- Maryland OHCQ: [Health Care Staff Agencies](https://health.maryland.gov/ohcq/Pages/Health-Care-Staff-Agencies.aspx)
- DC Health: [nurse staffing agency regulations](https://dchealth.dc.gov/sites/default/files/dc/sites/doh/publication/attachments/Regulations%20for%20Nurse%20Staffing%20Agencies%20%2822B%20DCMR%204900%29%20%28as%20of%2004.21.23%29.pdf)
- IMLC membership: the [IMLCC FY2026 annual report](https://imlcc.com/wp-content/uploads/2026/10/IMLCC_AnnualReport_2026_webvf.pdf) lists Virginia as a non-member and counts DC as a member. Several third-party "compact map" sites wrongly list Virginia as a member.
- Virginia staffing: [Harbor Compliance](https://www.harborcompliance.com/virginia-employment-agency-peo-talent-license) (no state license for employment or nurse staffing agencies)
- Maryland 3% tax on business SaaS: [CohnReznick](https://www.cohnreznick.com/insights/maryland-expands-sales-and-use-tax-to-it-software-services), [Venable](https://www.venable.com/insights/publications/2025/07/salt-alert-maryland-enacts-3-sales-tax-on-tech)
- DC SaaS tax and threshold: [Anrok](https://www.anrok.com/saas-sales-tax-by-state/district-of-columbia)

Healthcare counsel reviews Maryland first, because the pilot is there. DC and Virginia follow, and each only has to be done before that jurisdiction opens. Counsel confirms the staffing question for a state before locums posts open in it.

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
3. **Jabari:** Have a trademark attorney clear the name. "FindYourDoc" may conflict with existing "Find My Doc" filings and apps. Buy the domain, and commission a logo, only after the name is cleared. This is spend. **Only step 6 (email) and the public launch wait for this.** Steps 4, 5, 7 and 8 run on the address AWS gives the service, with `EMAIL_TRANSPORT="hold"`, so staging can be built and tested while the attorney works.
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
8. **Engineering:** Make a test booking to a staff address, then check the admin page's Automations section. It shows both the run and the email.

Steps 4, 5, 7 and 8 take about two days once steps 1 and 2 are done. Step 6 takes an hour once the domain exists, plus about a day for AWS to grant production access.

## Still needed before real patients

- Healthcare counsel reviews the terms, privacy policy and booking consent (Maryland first).
- An admin checks each clinician's license on the state board's own lookup before approving them.
- Email address verification.

### Not needed for launch (removed from the list on 2026-11-12)
- **Shared rate limits.** Only matters with more than one server. Launch runs one.
- **A separate database for the handle vault.** The vault is already a separate table that only the server can read. Splitting it out is hardening for later, when there's a team with database access.
