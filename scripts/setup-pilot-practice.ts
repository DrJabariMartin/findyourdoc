// Sets up a pilot practice's booking profile in one step, after the clinician
// has signed up and an admin has verified them.
//
//   npm run pilot:setup -- <clinician email> [config/pilot/align.json]
//
// It fills the booking profile, sets the pilot terms (fee waiver and owner
// disclosure), makes the bookable flag true, creates the practice's own
// booking link if there isn't one, and prints the link. It never creates
// patients or appointments and never changes verification.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { newBookingCode } from "../src/lib/booking-link";
import { licensedStates } from "../src/lib/market";

type Config = {
  npi?: string; // the clinician's individual NPI; checked against the account
  officeName: string; officeAddress: string; officeCity: string; officeState: string;
  insurance: string | null; selfPayDollars: number | null; visitMinutes: number; bio: string;
  feeWaiver?: string; ownerDisclosure?: string;
};

const [email, file = "config/pilot/align.json"] = process.argv.slice(2);
if (!email) {
  console.error("Usage: npm run pilot:setup -- <clinician email> [config file]");
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(file, "utf8")) as Config;
const db = new PrismaClient();

async function main() {
try {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { clinician: { include: { licenses: true } } } });
  const c = user?.clinician;
  if (!c) throw new Error(`No clinician account for ${email}. Sign up first at /signup.`);
  if (c.status !== "VERIFIED") throw new Error("This clinician isn't verified yet. Approve them on /admin first.");
  if (cfg.npi && c.npi !== cfg.npi) throw new Error(`This account's NPI (${c.npi ?? "none"}) doesn't match the config (${cfg.npi}). Check the email or the config.`);
  if (!licensedStates(c).includes(cfg.officeState)) throw new Error(`No verified ${cfg.officeState} license on file. Add it on /admin first.`);
  const updated = await db.clinicianProfile.update({
    where: { id: c.id },
    data: {
      bookable: true,
      officeName: cfg.officeName, officeAddress: cfg.officeAddress, officeCity: cfg.officeCity, officeState: cfg.officeState,
      insurance: cfg.insurance, selfPayCents: cfg.selfPayDollars ? Math.round(cfg.selfPayDollars * 100) : null,
      visitMinutes: cfg.visitMinutes, bio: cfg.bio.slice(0, 600),
      feeWaiver: cfg.feeWaiver?.slice(0, 200) || null, ownerDisclosure: cfg.ownerDisclosure?.slice(0, 200) || null,
      bookingCode: c.bookingCode ?? newBookingCode(),
    },
  });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`Ready: ${cfg.officeName}`);
  console.log(`Profile:          ${base}/find/${updated.id}`);
  console.log(`Own booking link: ${base}/b/${updated.bookingCode}`);
  console.log(`Licensed in:      ${licensedStates(c).join(", ")}`);
  console.log("Next: open times on /schedule, print the QR code from /schedule/qr.");
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
}

void main();
