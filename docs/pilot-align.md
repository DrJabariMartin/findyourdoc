# Pilot setup: Align Orthopedic & Wellness (Columbia, MD)

The first pilot practice is owned by FindYourDoc's founder, so the pilot is free and the listing says so. The full plan (goals, metrics, timeline, Maryland rules, BAAs, questions for counsel) is in the "Align Orthopedic & Wellness pilot plan" doc. This page is the setup checklist for the app.

Real patients book only after: the AWS account and AWS BAA are in place, FindYourDoc and Align have signed a BAA, and healthcare counsel has reviewed the booking terms and the related-party questions. Until then, use staging and staff email addresses.

## What the app does for this pilot

- **Launch market:** `LAUNCH_STATES="MD,DC,VA"`. Search and booking are open only there.
- **Video visits:** a clinician opens slots as "Video". At booking the patient picks the state they'll be in, and only states where the clinician has a verified, unexpired license are accepted (Maryland requires a Maryland license for a patient located in Maryland, including by telehealth). The patient also agrees to the video visit terms. FindYourDoc doesn't host the call: the office sends its own secure link from a video tool covered by its own BAA.
- **In-person visits:** only at an office in a state where the clinician is licensed. The Columbia clinic opens January 1, 2027, so open in-person slots from then.
- **Licenses in more states:** Admin, "State licenses and pilot terms", "Add verified license". Add DC or Virginia only after checking that board's own lookup.
- **Free pilot:** in the same admin section, set the fee waiver to `Founder pilot, no charge`. Every booking fee is then recorded as $0.
- **Disclosure:** set the disclosure to `FindYourDoc's founder, Dr. Jabari Martin, owns this practice.` It shows on the profile and in search. Ranking stays availability-only.

## Public credentials on file (from Dr. Martin's records, checked Nov 12, 2026)

Only public, profile-level facts live here. SSN, date of birth, DEA, CDS, tax ID, Medicare/Medicaid IDs, logins and malpractice history stay in his own files and are never copied into the app, the repo or docs.

| Item | Value | Status |
|---|---|---|
| Individual NPI | 1760703557 | Active in NPPES, Orthopaedic Surgery (207X00000X). NPPES still lists the old Greenbelt address and a Tacoma, WA location; update requested Nov 12. |
| Align group NPI | 1750209896, Align Orthopedic & Wellness LLC | Active since Jul 7, 2026. NPPES still lists 1717 N St NW, Washington DC; update to Columbia requested Nov 12. |
| Older group NPI | 1730849613, Martin Orthopaedic & Wellness Group (Greenbelt) | Not Align. Don't use for the pilot. |
| Maryland license | D0092720, Physician and Surgeon | The only card on file shows expiry 9/30/2025. Maryland is his Compact home state and the Board is processing an IMLC letter (Nov 4), which needs an active license, so it was most likely renewed. Admin must confirm the current expiry on the Board's lookup before approving. |
| DC license | none found | Not licensed in DC yet. DC patients can't book until one is verified. |
| Virginia license | none found | Not licensed in Virginia yet. Same rule. |
| Board certification | American Board of Orthopaedic Surgery | Certified Jul 25, 2019, current through Dec 31, 2029; current ABOS letter received Nov 2, 2026. |
| Other licenses (outside launch market) | DE, NJ, PA, WA | Not used by the pilot. |
| Insurance | Credentialing in progress | Cigna contract signed Nov 8 (effective date pending); Aetna agreement signed; Medicare, CareFirst, UnitedHealthcare, Anthem and TRICARE pending. Profile says "ask the office" until each has an effective date. |
| Office | 10805 Hickory Ridge Rd, Suite 200, Columbia, MD 21044 · (737) 365-9355 · info@alignwell.app | |

`config/pilot/align.json` carries the individual NPI, and `npm run pilot:setup` refuses to run if the account's NPI doesn't match it.

## Steps

1. Dr. Martin signs up as a clinician (NPI 1760703557, Maryland license D0092720, Orthopaedic Surgery) and uploads ID, license, board certification, DEA, Maryland CDS registration and malpractice.
2. Admin checks the Maryland license on the Maryland Board of Physicians lookup and NPPES, then approves.
3. Admin adds any DC or Virginia license, the fee waiver and the disclosure.
4. Dr. Martin fills in the booking profile on `/schedule` (office 10805 Hickory Ridge Rd, Suite 200, Columbia, MD 21044; visit length; self-pay price; insurance) and opens video slots in time blocks kept for FindYourDoc, so they can't clash with Align's own calendar.
5. Run 10 test bookings to staff addresses: confirmation, 24-hour reminder, patient cancel, office cancel, and record-visit (fee shows $0).

## Align's own booking link (launch marketing)

Pathway 1 (the Columbia orthopedic clinic, opening 2027-01-01) is marketed through Align's own channels: welcome.alignwell.app, the Beacons link-in-bio page, Instagram and Facebook, Google Business Profile, emails, and a QR code at the front desk. Every one of those points to Align's own FindYourDoc booking link.

1. Signed in as the clinician, open **Patient booking** and press **Create my booking link**.
2. Copy the link (`/b/<code>`) or the ready-made **Book online** button HTML onto the website and link-in-bio page.
3. Bookings through that link are stored with source `PRACTICE_SITE` and never carry a booking fee, for Align and for every future practice. Search bookings stay `FINDYOURDOC`.
4. **Make a new link** replaces the code; the old link stops working.

Add `?utm_source=` tags only on the practice's own pages if wanted. FindYourDoc itself never puts ad pixels or tracking on patient pages.

## One-command setup

After Jabari signs up as a clinician, is verified, and has his Maryland license on file (admin page):

```
npm run pilot:setup -- <his sign-up email>
```

This reads `config/pilot/align.json` (office, self-pay price, bio, fee waiver, owner disclosure), makes the profile bookable, creates Align's own booking link and prints it. Running it again keeps the same link. Then open times on **Patient booking** and print the front-desk card from **Print a QR code** (`/schedule/qr`).
