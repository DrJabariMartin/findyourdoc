// Runs FindYourDoc's automations on a schedule. Any scheduler (Vercel Cron,
// GitHub Actions, a Claude scheduled task, cron on the server) can call:
//   POST /api/automations?job=all   with header  Authorization: Bearer <AUTOMATION_SECRET>
// Every job is safe to run repeatedly; hourly is a good default.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { JOBS, runJobs } from "@/lib/automation/jobs";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret || secret.length < 24) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const job = new URL(req.url).searchParams.get("job") ?? "all";
  if (job !== "all" && !JOBS[job]) return NextResponse.json({ error: "unknown job", jobs: Object.keys(JOBS) }, { status: 400 });
  const results = await runJobs(job);
  return NextResponse.json({ results }, { status: results.every((r) => r.ok) ? 200 : 500 });
}

// GET is accepted too because some schedulers (Vercel Cron) only send GET.
export const GET = handle;
export const POST = handle;
