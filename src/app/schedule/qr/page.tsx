import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { requireVerifiedClinician } from "@/lib/session";
import { appUrl } from "@/lib/email";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

// A printable card for the front desk, appointment cards and flyers. The QR
// code opens the practice's own booking link, so those bookings carry no fee.
export default async function BookingQr() {
  const user = await requireVerifiedClinician();
  const c = user.clinician;
  if (!c.bookingCode) redirect("/schedule");
  const link = appUrl(`/b/${c.bookingCode}`);
  const svg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#102A43", light: "#FFFFFF" } });
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="card flex flex-col items-center gap-4 w-full max-w-sm text-center print:shadow-none print:border-0">
        <p className="font-display font-extrabold text-2xl">{c.officeName ?? user.name}</p>
        <p className="text-ink-2">Scan to book your visit online</p>
        <div className="w-64 h-64" role="img" aria-label="QR code for online booking" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-sm font-mono break-all">{link}</p>
        <p className="text-xs text-muted">For an emergency, call 911.</p>
      </div>
      <PrintButton />
    </div>
  );
}
