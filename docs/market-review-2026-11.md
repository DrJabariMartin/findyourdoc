# Market review, November 2026

What the leading competitors do on each side of FindYourDoc, what users
complain about, and what this repository does about it. The full write-up
with sources is the "FindYourDoc market review" doc in the project.

## Patient booking

| | Zocdoc | Sesame / Solv / Healthgrades | FindYourDoc |
|---|---|---|---|
| Reach | 200K providers, 10K insurance plans; since Sept 2026 its booking is syndicated into Google Gemini, Amazon Health AI, Yelp and Healthgrades | Sesame: cash prices; Solv: urgent care; Healthgrades booking now runs on Zocdoc | DMV launch, every verified profession |
| Practice pays | Per new-patient booking, charged at booking, even if the patient cancels or no-shows; existing patients free | Varies | $40 only after a completed new-patient visit; nothing for no-shows, cancellations, existing patients, own-site bookings or government plans |
| Reviews | Patients report reviews changed and no way to edit or delete | Ad-funded rating sites | Verified patients only, every review shown, patient can edit or delete, one public clinician reply, report-only-for-rule-breaks (this PR) |
| Insurance accuracy | Top patient complaint: office didn't take the plan shown | Same problem in payer directories (CMS: about half inaccurate) | "Confirmed by the office on date", unconfirmed after 90 days (this PR) |
| Changing a visit | Patients report being penalised when the office cancelled | | Patient reschedules or cancels free from the booking link; never penalised (this PR) |
| AI assistants | Structured data and partner booking | | schema.org data on every profile (this PR); partner booking API still to build |

## Jobs and practice hiring

Doximity Talent Solutions sells locums, permanent placement and sourcing on top
of 3M+ clinicians. Agencies (CompHealth, AMN) mark up 20-40%. Digital
marketplaces (DirectShifts, Nomad, Aya) sell on speed and lower cost.
FindYourDoc's edge is price transparency: pay always shown, flat $9,500 hire
fee falling to $0 after 12 months, no non-competes. Still to build: reuse of a
clinician's verified credentials for the practice's credentialing (with
consent), practice-to-applicant messaging, and a practice response-time score
(ghosting is the top job-seeker complaint).

## Community

Doximity (DoxGPT, fax, dialer, prescribing), Sermo (anonymous, paid surveys),
Figure 1 (images), OpenEvidence (AI answers, ad-funded). FindYourDoc's edge:
every profession, verified, anonymous through the handle vault, conversations
never sold. The Lounge had posts but no replies; this PR adds replies with the
same identifier check and anonymity. Still to build: reply notifications and
search.

## Second round (same PR)

- Credential passport: with the clinician's consent (on by default, can be
  turned off any time), a practice the clinician applied to can open their
  verified documents for its own credentialing.
- Practice-applicant messaging on each application, with email alerts that
  carry a link only.
- Practice response time on every listing ("Usually responds within a day"),
  where unanswered applications count against the practice.
- Sign-up fills name, profession, specialty and license from the NPI registry.
- Patients can ask to hear about an earlier time with the same clinician.
- Lounge: email to the post's author on a new reply (anonymous authors are
  reached through the handle vault, server-side), and search across rooms.
- Profiles show the date we last checked the license.
- `GET /api/availability`: public JSON feed of bookable clinicians and their
  next open times, for search engines, AI assistants, plans and practice sites.
- Pricing page compares each fee with the usual way of buying the service.

## Vendor decisions

- Text messages: AWS End User Messaging SMS, under the same AWS BAA. About
  $46-58 one-time for 10DLC registration, then roughly $5-15 a month at pilot
  volume. Email stays the only channel until registration is approved.
- Calendar sync: built in-house against Google Calendar and Microsoft 365,
  reading busy times only. No vendor cost.
- EHR sync: no vendor until about 10 practices ask for it.
