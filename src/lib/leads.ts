// Practice leads from ads and posts: which ad they came from, and the two
// emails that go out within a minute of sign-up (speed to lead). Pure
// functions only, so the rules can be unit-tested.
//
// Ad tags are kept for practices and clinicians only. Patients are never
// tagged with the ad or post that brought them (no ad tracking on patients).

import type { Message } from "./automation/rules";

/** Lowercase letters, digits, "-" and "_", at most 60 characters, or null. */
export function cleanTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60);
  return v || null;
}

export type AdTags = { utmSource: string | null; utmCampaign: string | null; utmContent: string | null };

export function adTags(role: string, raw: { utm_source?: unknown; utm_campaign?: unknown; utm_content?: unknown }): AdTags {
  if (role === "PATIENT") return { utmSource: null, utmCampaign: null, utmContent: null };
  return { utmSource: cleanTag(raw.utm_source), utmCampaign: cleanTag(raw.utm_campaign), utmContent: cleanTag(raw.utm_content) };
}

/** US numbers only, stored as +1 and 10 digits. Returns null if it isn't one. */
export function cleanUsPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let d = value.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d)) return null;
  return `+1${d}`;
}

export type LeadRow = {
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  depositIntent: boolean;
  contactConsent: boolean;
};

export type AngleStats = { source: string; campaign: string; content: string; leads: number; canContact: number; deposit: number };

/** Practice leads grouped by ad (source, campaign, content), most leads first. */
export function leadsByAd(rows: LeadRow[]): AngleStats[] {
  const by = new Map<string, AngleStats>();
  for (const r of rows) {
    const source = r.utmSource ?? "direct";
    const campaign = r.utmCampaign ?? "-";
    const content = r.utmContent ?? "-";
    const key = `${source}|${campaign}|${content}`;
    const s = by.get(key) ?? { source, campaign, content, leads: 0, canContact: 0, deposit: 0 };
    s.leads++;
    if (r.contactConsent) s.canContact++;
    if (r.depositIntent) s.deposit++;
    by.set(key, s);
  }
  return [...by.values()].sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source) || a.content.localeCompare(b.content));
}

export type PracticeLead = {
  email: string;
  state: string;
  city: string | null;
  phone: string | null;
  contactConsent: boolean;
  depositIntent: boolean;
} & AdTags;

/** Internal alert so a person can follow up the same business day. */
export function leadAlert(lead: PracticeLead, appUrl: string): Message {
  const from = [lead.utmSource, lead.utmCampaign, lead.utmContent].filter(Boolean).join(" / ") || "direct (no ad tag)";
  const contact = lead.phone
    ? `${lead.phone} (${lead.contactConsent ? "OK to call or text" : "no consent to call or text: email only"})`
    : "no phone given: email only";
  return {
    subject: `New practice lead in ${lead.state}: follow up today`,
    body: [
      `Email: ${lead.email}`,
      `Phone: ${contact}`,
      `Where: ${lead.city ? `${lead.city}, ` : ""}${lead.state}`,
      `Came from: ${from}`,
      `Would pay the founding deposit: ${lead.depositIntent ? "yes" : "no"}`,
      "",
      "Opener: \"You grabbed our empty-slot calculator. Are you still trying to fill that role?\" Then the Diagnose questions in the sales playbook. Paste their exact words into the Voice of customer worksheet.",
      "",
      `${appUrl}/admin/waitlist`,
    ].join("\n"),
  };
}

/** The email the practice gets straight away: the calculator and the call. */
export function practiceWelcome(appUrl: string): Message {
  return {
    subject: "Your empty provider slot calculator",
    body: [
      "Hi,",
      "",
      `Here's the calculator you asked for: ${appUrl}/calculator`,
      "",
      "It takes about two minutes: visits per day, times what you collect per visit, times clinic days in a month. Use your own numbers.",
      "",
      "If you'd like a second set of eyes on them, reply to this email and we'll set up a free 20-minute hiring-needs call. If we can't help, we'll tell you.",
      "",
      "This is an automated message. You're getting it once because you asked for the calculator.",
      "",
      "Dr. Jabari Martin",
      "FindYourDoc",
    ].join("\n"),
  };
}
