import "server-only";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { lookupNpi } from "./npi";
import { anonLabel } from "./labels";
import { onClinicianSignup, safely } from "./automation/jobs";

export type NewClinician = {
  name: string;
  email: string;
  password: string;
  profession: string;
  specialty: string;
  licenseState: string;
  licenseNumber: string;
  npi?: string;
  office?: { officeName: string; officeCity: string; officeState: string };
};

/** Creates a clinician account with its credential checklist and starts the registry check. */
export async function createClinicianAccount(d: NewClinician) {
  const npiInfo = d.npi ? await lookupNpi(d.npi) : null;
  const user = await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: "CLINICIAN",
      clinician: {
        create: {
          npi: d.npi || null,
          profession: d.profession,
          specialty: d.specialty,
          licenseState: d.licenseState,
          licenseNumber: d.licenseNumber,
          region: anonLabel(d.specialty, d.profession, d.licenseState).split(", ")[1],
          ...(d.office ?? {}),
          credentials: {
            create: [
              { kind: "ID", status: "NEEDED" },
              { kind: "LICENSE", status: npiInfo?.licenseNumber === d.licenseNumber ? "PENDING" : "NEEDED" },
              { kind: "BOARD", status: "NEEDED" },
              { kind: "EDUCATION", status: "NEEDED" },
              { kind: "MALPRACTICE", status: "NEEDED" },
            ],
          },
        },
      },
    },
    include: { clinician: true },
  });
  // Registry check + welcome email run straight away; a person still approves.
  if (user.clinician) await safely(onClinicianSignup(user.clinician.id));
  return user;
}
