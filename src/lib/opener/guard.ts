// Rules that run BEFORE any AI model sees a message. They decide, with plain
// pattern matching, whether a message may be read by the AI at all.
//   crisis        -> 988/911 template, Dr. Martin alerted, no AI
//   keyword       -> the matching guide, no AI
//   health        -> patient template, no AI (unless it looks like a clinician
//                    talking shop, then Dr. Martin handles it by hand)
//   ai            -> safe to hand to the AI Opener

import { KEYWORDS } from "./templates";

export type Route =
  | { kind: "crisis" }
  | { kind: "keyword"; keyword: string }
  | { kind: "patient"; template: "general" | "healthDetails" }
  | { kind: "human" }
  | { kind: "ai" };

const CRISIS = /\b(suicid\w*|kill (myself|me)|end my life|want to die|self[- ]?harm|hurt myself|overdos\w*|can'?t breathe|chest pain|emergency)\b/i;

// Words that suggest someone is describing their own or a family member's health.
const HEALTH = /\b(pain|hurts?|hurting|symptoms?|diagnos\w*|medications?|meds|prescri\w*|insurance|appointment|sick|fever|rash|pregnan\w*|injur\w*|swollen|bleeding|lump|test results?|mri|x-?ray|surgery on|my (knee|back|hip|shoulder|neck|leg|arm|foot|ankle|wrist|head|son|daughter|child|kid|mom|mother|dad|father|wife|husband|partner|baby))\b/i;

// Words that suggest a clinician or practice talking about work (self-identification
// or job words; bare titles like "PT" are left out because patients use them too).
const WORK = /\b((i'?m|i am|as) an? (nurse|rn|np|pa|md|do|pt|ot|dpt|crna|pharmacist|physician|doctor|surgeon|resident|fellow|therapist|practice manager|medical director)|locums?|contract|recruiter|shift|residency|fellowship|hiring|credentialing|my patients|our patients|job)\b/i;

export function route(text: string): Route {
  const t = text.trim();
  if (CRISIS.test(t)) return { kind: "crisis" };
  const word = t.replace(/[^a-z]/gi, "").toUpperCase();
  if (word in KEYWORDS && t.split(/\s+/).length <= 3) return { kind: "keyword", keyword: word };
  if (HEALTH.test(t)) {
    if (WORK.test(t)) return { kind: "human" };
    // A short, generic ask ("how do I book?") gets the general template; anything describing health gets the privacy one.
    return { kind: "patient", template: /\b(book|booking|appointment)\b/i.test(t) && t.length < 60 ? "general" : "healthDetails" };
  }
  return { kind: "ai" };
}
