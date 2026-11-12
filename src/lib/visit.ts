import { fmtSlot } from "./time";
import { appUrl } from "./email";

type ApptWithClinician = {
  accessToken: string;
  patientState?: string | null;
  slot: {
    startsAt: Date;
    mode?: string;
    clinician: {
      officeName: string | null;
      officeAddress: string | null;
      officeCity: string | null;
      officeState: string | null;
      user: { name: string };
    };
  };
};

/** The non-sensitive facts an appointment email may contain. */
export function visitFacts(a: ApptWithClinician) {
  const c = a.slot.clinician;
  // A video visit is timed in the patient's state (licensure follows the patient).
  const video = a.slot.mode === "VIDEO";
  const tzState = video && a.patientState ? a.patientState : c.officeState;
  return {
    when: fmtSlot(a.slot.startsAt, tzState, "long"),
    clinician: c.user.name,
    office: video
      ? `Video visit. ${c.officeName ?? "The office"} will send you a secure video link before the visit.\nPlease be in ${a.patientState ?? "the state you chose"} for the whole visit and have a photo ID ready.`
      : [c.officeName, c.officeAddress, [c.officeCity, c.officeState].filter(Boolean).join(", ")].filter(Boolean).join("\n"),
    manageUrl: appUrl(`/appointments/${a.accessToken}`),
  };
}
