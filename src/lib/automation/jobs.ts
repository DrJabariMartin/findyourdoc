// FindYourDoc's automations. Each job is safe to run again at any time: it
// only acts on what is due, and every email has a dedupe key.
// Run them all with `npm run automations`, or on a schedule by calling
// POST /api/automations with the AUTOMATION_SECRET (see README).

import { db } from "../db";
import { lookupNpiStrict } from "../npi";
import {
  clinicianFitsJob,
  compareWithRegistry,
  DAY_MS,
  expiryReminderBand,
  messages,
  RECHECK_DAYS,
  recheckDue,
  visitNeedsRecording,
  type Message,
} from "./rules";
import { transport } from "./mailer";
import { sendDueReminders } from "../reminders";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Queues an email once. A second call with the same key does nothing. */
export async function enqueue(dedupeKey: string, toEmail: string, kind: string, msg: Message, sendAfter = new Date()) {
  await db.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: { dedupeKey, toEmail, kind, subject: msg.subject, body: msg.body, sendAfter },
  });
}

// ---------------------------------------------------------------------------
// Event hooks: called right after something happens in the app.
// ---------------------------------------------------------------------------

/** New clinician: check NPPES now and send a welcome email. */
export async function onClinicianSignup(clinicianId: string) {
  const c = await db.clinicianProfile.findUnique({ where: { id: clinicianId }, include: { user: true } });
  if (!c) return;
  await registryCheck(c.id, "SIGNUP");
  await enqueue(`welcome:${c.userId}`, c.user.email, "WELCOME", messages.welcome(c.user.name));
}

export async function onClinicianVerified(clinicianId: string) {
  const c = await db.clinicianProfile.findUnique({ where: { id: clinicianId }, include: { user: true } });
  if (!c) return;
  await enqueue(`verified:${c.id}:${c.verifiedAt?.toISOString()}`, c.user.email, "VERIFIED", messages.verified(c.user.name, appUrl()));
}

/** New job: alert every verified clinician whose profession and license state fit. */
export async function onJobPosted(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) return 0;
  const candidates = await db.clinicianProfile.findMany({
    where: { status: "VERIFIED", profession: job.profession, licenseState: job.state },
    include: { user: true },
  });
  let n = 0;
  for (const c of candidates) {
    if (!clinicianFitsJob(job, c)) continue;
    await enqueue(`job:${job.id}:${c.id}`, c.user.email, "JOB_MATCH", messages.jobMatch(c.user.name, job, appUrl()));
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Registry check, used at sign-up and every 90 days.
// ---------------------------------------------------------------------------

async function registryCheck(clinicianId: string, kind: "SIGNUP" | "RECHECK") {
  const c = await db.clinicianProfile.findUnique({ where: { id: clinicianId }, include: { user: true } });
  if (!c) return null;
  let outcome;
  try {
    const registry = c.npi ? await lookupNpiStrict(c.npi) : null;
    outcome = compareWithRegistry({ ...c, name: c.user.name }, registry);
  } catch (e) {
    outcome = { result: "ERROR" as const, issues: [`Registry lookup failed: ${(e as Error).message}`] };
  }
  await db.verificationCheck.create({
    data: { clinicianId, kind, source: "NPPES", result: outcome.result, issues: outcome.issues.join("\n") },
  });
  return outcome;
}

// ---------------------------------------------------------------------------
// Scheduled jobs.
// ---------------------------------------------------------------------------

type JobResult = string;

/** Members without a completed registry check (none yet, or the registry was down) get one. */
async function precheckPending(): Promise<JobResult> {
  const pending = await db.clinicianProfile.findMany({ where: { status: "PENDING", checks: { none: { result: { not: "ERROR" } } } }, select: { id: true } });
  for (const p of pending) await registryCheck(p.id, "SIGNUP");
  return `${pending.length} new member${pending.length === 1 ? "" : "s"} checked against NPPES`;
}

/**
 * 90-day re-check. A clean result renews the date. Anything else pauses the
 * profile (LAPSED) for a person to review: protective and reversible.
 */
async function recheckLicenses(): Promise<JobResult> {
  const now = new Date();
  const due = await db.clinicianProfile.findMany({
    where: { status: "VERIFIED", nextRecheckAt: { lte: now } },
    include: { user: true },
  });
  let renewed = 0;
  let paused = 0;
  let manual = 0;
  for (const c of due) {
    if (!recheckDue(c.nextRecheckAt, now)) continue;
    if (!c.npi) {
      // Nothing to check automatically: stays verified and shows on the admin
      // page as due for a manual re-check against the state board.
      manual++;
      continue;
    }
    const outcome = await registryCheck(c.id, "RECHECK");
    if (!outcome) continue;
    if (outcome.result === "MATCH") {
      await db.clinicianProfile.update({ where: { id: c.id }, data: { nextRecheckAt: new Date(now.getTime() + RECHECK_DAYS * DAY_MS) } });
      renewed++;
    } else if (outcome.result === "ERROR") {
      // Registry down: try again next run, don't punish the member.
    } else {
      await db.clinicianProfile.update({ where: { id: c.id }, data: { status: "LAPSED", bookable: false } });
      await enqueue(`lapsed:${c.id}:${c.nextRecheckAt?.toISOString()}`, c.user.email, "RECHECK_LAPSED", messages.recheckLapsed(c.user.name));
      paused++;
    }
  }
  return `${renewed} renewed, ${paused} paused for review, ${manual} need a manual board check`;
}

async function credentialReminders(): Promise<JobResult> {
  const now = new Date();
  const soon = await db.credential.findMany({
    where: { expiresAt: { not: null, lte: new Date(now.getTime() + 60 * DAY_MS) }, status: { in: ["VERIFIED", "PENDING"] } },
    include: { clinician: { include: { user: true } } },
  });
  let n = 0;
  for (const cr of soon) {
    const band = expiryReminderBand(cr.expiresAt!, now);
    if (band === null) continue;
    if (band === 0) await db.credential.update({ where: { id: cr.id }, data: { status: "EXPIRED" } });
    await enqueue(
      `cred:${cr.id}:${cr.expiresAt!.toISOString()}:${band}`,
      cr.clinician.user.email,
      "CREDENTIAL_EXPIRING",
      messages.credentialExpiring(cr.clinician.user.name, cr.kind, band),
    );
    n++;
  }
  return `${n} credential reminder${n === 1 ? "" : "s"} queued`;
}

/** One reminder per booked visit in the next 24 hours (see src/lib/reminders.ts). */
async function appointmentReminders(): Promise<JobResult> {
  const n = await sendDueReminders(db);
  return `${n} patient reminder${n === 1 ? "" : "s"} sent`;
}

/** Nudge clinicians to record past visits, once a day each. */
async function recordVisitNudges(): Promise<JobResult> {
  const now = new Date();
  const stale = await db.appointment.findMany({
    where: { status: "BOOKED", slot: { startsAt: { lt: now } } },
    include: { slot: { include: { clinician: { include: { user: true } } } } },
  });
  const byClinician = new Map<string, { email: string; name: string; count: number }>();
  for (const a of stale) {
    if (!visitNeedsRecording(a.slot.startsAt, a.slot.minutes, now)) continue;
    const c = a.slot.clinician;
    const row = byClinician.get(c.id) ?? { email: c.user.email, name: c.user.name, count: 0 };
    row.count++;
    byClinician.set(c.id, row);
  }
  const day = now.toISOString().slice(0, 10);
  for (const [id, r] of byClinician) await enqueue(`record:${id}:${day}`, r.email, "RECORD_VISIT", messages.recordVisit(r.name, r.count, appUrl()));
  return `${byClinician.size} clinician${byClinician.size === 1 ? "" : "s"} reminded to record visits`;
}

/** Daily summary to admins of anything that still needs a person. */
async function adminDigest(): Promise<JobResult> {
  const [pending, mismatched, lapsed, flagged, admins, manualDue] = await Promise.all([
    db.clinicianProfile.count({ where: { status: "PENDING" } }),
    db.clinicianProfile.count({ where: { status: "PENDING", checks: { some: { result: { in: ["MISMATCH", "NOT_FOUND"] } } } } }),
    db.clinicianProfile.count({ where: { status: "LAPSED" } }),
    db.post.count({ where: { flagged: true } }),
    db.user.findMany({ where: { role: "ADMIN" } }),
    db.clinicianProfile.count({ where: { status: "VERIFIED", nextRecheckAt: { lte: new Date() } } }),
  ]);
  const total = pending + lapsed + flagged + manualDue;
  if (total === 0) return "nothing needs a person today";
  const day = new Date().toISOString().slice(0, 10);
  const msg = {
    subject: `FindYourDoc: ${total} ${total === 1 ? "item needs" : "items need"} a person today`,
    body: `Verification queue: ${pending} (${mismatched} with registry mismatches)\nPaused at 90-day re-check: ${lapsed}\nDue for a manual state-board re-check (no NPI): ${manualDue}\nLounge posts held for patient identifiers: ${flagged}\n\n${appUrl()}/admin`,
  };
  for (const a of admins) await enqueue(`digest:${a.id}:${day}`, a.email, "ADMIN_DIGEST", msg);
  return `digest queued for ${admins.length} admin${admins.length === 1 ? "" : "s"}`;
}

/** Sends due emails through the configured transport. */
async function deliverOutbox(): Promise<JobResult> {
  const t = transport();
  const due = await db.notification.findMany({
    where: { status: "PENDING", sendAfter: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  let held = 0;
  let failed = 0;
  for (const m of due) {
    try {
      const ok = await t.send({ to: m.toEmail, subject: m.subject, body: m.body });
      if (ok) {
        await db.notification.update({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } } });
        sent++;
      } else held++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await db.notification.update({
        where: { id: m.id },
        data: { attempts, error: (e as Error).message.slice(0, 500), status: attempts >= 5 ? "FAILED" : "PENDING" },
      });
      failed++;
    }
  }
  return `${sent} sent, ${held} held (transport: ${t.name}), ${failed} failed`;
}

export const JOBS: Record<string, () => Promise<JobResult>> = {
  "precheck-pending": precheckPending,
  "recheck-licenses": recheckLicenses,
  "credential-reminders": credentialReminders,
  "appointment-reminders": appointmentReminders,
  "record-visit-nudges": recordVisitNudges,
  "admin-digest": adminDigest,
  "deliver-outbox": deliverOutbox,
};

/** Runs one job (or all, in order), logging each run for the admin page. */
export async function runJobs(which: string = "all") {
  const names = which === "all" ? Object.keys(JOBS) : [which];
  const results: { job: string; ok: boolean; summary: string }[] = [];
  for (const job of names) {
    const fn = JOBS[job];
    if (!fn) {
      results.push({ job, ok: false, summary: "unknown job" });
      continue;
    }
    const run = await db.automationRun.create({ data: { job } });
    let ok = false;
    let summary: string;
    try {
      summary = await fn();
      ok = true;
    } catch (e) {
      summary = `error: ${(e as Error).message}`.slice(0, 500);
    }
    await db.automationRun.update({ where: { id: run.id }, data: { ok, summary, finishedAt: new Date() } });
    results.push({ job, ok, summary });
  }
  return results;
}

/** Event hooks must never break the user's action, so failures are logged. */
export async function safely(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    console.error("[automation]", e);
  }
}
