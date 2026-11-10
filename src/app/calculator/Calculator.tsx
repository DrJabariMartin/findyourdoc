"use client";

import { useState } from "react";
import { slotCost } from "@/lib/slot-cost";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const FIELDS = [
  ["visitsPerDay", "Visits per day the clinician would see"],
  ["perVisit", "Average collected per visit ($)"],
  ["daysPerMonth", "Clinic days per month"],
  ["monthsOpen", "Months the slot has been open"],
] as const;

type Key = (typeof FIELDS)[number][0];

export default function Calculator() {
  // The starting values are an illustration, not a benchmark.
  const [v, setV] = useState<Record<Key, string>>({ visitsPerDay: "18", perVisit: "110", daysPerMonth: "18", monthsOpen: "4" });
  const r = slotCost({
    visitsPerDay: Number(v.visitsPerDay),
    perVisit: Number(v.perVisit),
    daysPerMonth: Number(v.daysPerMonth),
    monthsOpen: Number(v.monthsOpen),
  });
  return (
    <div className="card flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {FIELDS.map(([k, label]) => (
          <label key={k} className="label">
            {label}
            <input
              className="field"
              inputMode="decimal"
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div role="status" className="bg-brand-soft! text-brand-dark rounded-lg p-4 flex flex-col gap-1">
        <p>Revenue lost each month: <strong>{usd(r.monthly)}</strong></p>
        <p>Revenue lost so far: <strong>{usd(r.soFar)}</strong></p>
      </div>
      <p className="text-sm text-muted">The starting numbers are an example. Replace them with your own.</p>
    </div>
  );
}
