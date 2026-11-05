// Sample data for local development only. Every person here is fictional.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const pw = await bcrypt.hash("demo-password-123", 10);
const day = 86_400_000;

async function reset() {
  for (const m of ["appointment", "availabilitySlot", "application", "job", "practiceMember", "practice", "post", "handleVault", "anonHandle", "room", "credential", "clinicianProfile", "user"]) {
    await db[m].deleteMany();
  }
}

const rooms = [
  ["orthopedics", "Orthopedics"], ["physicians", "Physicians: all specialties"], ["np-pa", "NPs and PAs"],
  ["nursing", "Nursing"], ["pt-ot", "PT and OT"], ["pharmacy", "Pharmacy"], ["pay", "Pay and contracts"],
];
const support = [["wellness", "Burnout and wellness"], ["legal-stress", "Malpractice and legal stress"], ["life", "Life outside medicine"]];

const clinicians = [
  { name: "Dr. Sample Okafor", email: "ortho@example.com", profession: "PHYSICIAN", specialty: "Orthopedic surgeon", state: "GA", city: "Atlanta", insurance: "Aetna, Blue Cross, Cigna, Medicare", selfPay: 180, bio: "Sports injuries, knee and shoulder." },
  { name: "Sample Rivera, DPT", email: "pt@example.com", profession: "PT", specialty: "Sports and knee rehab", state: "GA", city: "Atlanta", insurance: "Aetna, United", selfPay: 95, bio: "Post-op rehab and running injuries." },
  { name: "Sample Chen, FNP-C", email: "np@example.com", profession: "NP", specialty: "Family practice and urgent care", state: "GA", city: "Decatur", insurance: "Blue Cross, Medicaid, Medicare", selfPay: 85, bio: "Same-day visits for colds, flu, physicals and checkups." },
  { name: "Sample Patel, PharmD", email: "pharm@example.com", profession: "PHARMACIST", specialty: "Medication review", state: "GA", city: "Marietta", insurance: "", selfPay: 40, bio: "Medication reviews and questions about your prescriptions." },
];

await reset();
await db.user.create({ data: { name: "Verification Team", email: "admin@example.com", passwordHash: pw, role: "ADMIN" } });
for (const [i, [slug, name]] of rooms.entries()) await db.room.create({ data: { slug, name, sortOrder: i } });
for (const [i, [slug, name]] of support.entries()) await db.room.create({ data: { slug, name, support: true, sortOrder: 100 + i } });

const now = Date.now();
const start = new Date(now + day);
start.setUTCHours(14, 0, 0, 0); // 9 or 10 AM Eastern
for (const c of clinicians) {
  const u = await db.user.create({
    data: {
      name: c.name, email: c.email, passwordHash: pw, role: "CLINICIAN",
      clinician: { create: {
        profession: c.profession, specialty: c.specialty, licenseState: c.state, licenseNumber: "SAMPLE-0000", region: "Southeast",
        status: "VERIFIED", verifiedAt: new Date(), nextRecheckAt: new Date(now + 90 * day),
        bookable: true, bio: c.bio, officeName: `${c.city} Sample Clinic`, officeAddress: "100 Example Way", officeCity: c.city, officeState: c.state,
        insurance: c.insurance || null, selfPayCents: c.selfPay * 100, visitMinutes: 30,
        credentials: { create: ["ID", "LICENSE", "BOARD", "EDUCATION", "MALPRACTICE"].map((kind) => ({ kind, status: "VERIFIED", checkedAt: new Date() })) },
      } },
    },
    include: { clinician: true },
  });
  const slots = [];
  for (let d = 0; d < 3; d++) for (let h = 0; h < 4; h++) slots.push({ clinicianId: u.clinician.id, startsAt: new Date(start.getTime() + d * day + h * 90 * 60_000), minutes: 30 });
  await db.availabilitySlot.createMany({ data: slots });
}

await db.user.create({ data: { name: "Pending Sample, RN", email: "pending@example.com", passwordHash: pw, role: "CLINICIAN",
  clinician: { create: { profession: "NURSE", specialty: "OR circulating", licenseState: "FL", licenseNumber: "SAMPLE-1111", region: "Southeast",
    credentials: { create: [{ kind: "ID", status: "NEEDED" }, { kind: "LICENSE", status: "NEEDED" }] } } } } });

const practiceUser = await db.user.create({ data: { name: "Sample Practice Manager", email: "practice@example.com", passwordHash: pw, role: "PRACTICE",
  memberships: { create: { practice: { create: { name: "Peachtree Sample Orthopedics", city: "Atlanta", state: "GA", plan: "GROUP" } } } } },
  include: { memberships: true } });
const pid = practiceUser.memberships[0].practiceId;
await db.job.createMany({ data: [
  { practiceId: pid, type: "LOCUMS", profession: "PHYSICIAN", title: "Orthopedic surgeon, weekend call coverage", city: "Atlanta", state: "GA", description: "Two weekends a month, Level III trauma backup.", payUnit: "HOUR", payMinCents: 26800, payMaxCents: 26800 },
  { practiceId: pid, type: "PERMANENT", profession: "PA", title: "Orthopedic PA, clinic and first assist", city: "Atlanta", state: "GA", description: "Four-day week, no call. Productivity bonus terms shared before you apply.", payUnit: "YEAR", payMinCents: 12500000, payMaxCents: 14000000 },
  { practiceId: pid, type: "PER_DIEM", profession: "PT", title: "Outpatient physical therapist, Saturday clinic", city: "Atlanta", state: "GA", description: "Pick shifts week to week. Cancellations inside 24 hours pay half the shift.", payUnit: "HOUR", payMinCents: 6250, payMaxCents: 6250 },
] });

const ortho = await db.room.findUnique({ where: { slug: "orthopedics" } });
const okafor = await db.user.findUnique({ where: { email: "ortho@example.com" } });
const handle = await db.anonHandle.create({ data: { label: "Orthopedic surgeon, Southeast", vault: { create: { userId: okafor.id } } } });
await db.post.create({ data: { roomId: ortho.id, handleId: handle.id, title: "Post-op protocols after ACL reconstruction: how fast are you progressing?", body: "Our group differs a lot on when to start running. Curious what timelines others use." } });

console.log("Seeded. Log in with any @example.com account and password demo-password-123.");
await db.$disconnect();
