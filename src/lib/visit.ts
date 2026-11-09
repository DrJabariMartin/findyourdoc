import { fmtSlot } from "./time";
import { appUrl } from "./email";

type ApptWithClinician = {
  accessToken: string;
  slot: {
    startsAt: Date;
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
  return {
    when: fmtSlot(a.slot.startsAt, c.officeState, "long"),
    clinician: c.user.name,
    office: [c.officeName, c.officeAddress, [c.officeCity, c.officeState].filter(Boolean).join(", ")].filter(Boolean).join("\n"),
    manageUrl: appUrl(`/appointments/${a.accessToken}`),
  };
}
