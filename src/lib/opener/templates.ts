// Fixed replies the AI Opener sends without calling any AI model.
// Patients only ever get these (no AI reads patient messages until there is a
// BAA with the model provider). Links come from the environment so they can
// change without a code change.

export const DISCLOSURE = "I'm FindYourDoc's AI assistant. Dr. Martin reads every conversation.";

function link(name: string, fallback: string) {
  return process.env[name] || fallback;
}

export const patient = {
  general: () =>
    `Thanks for reaching out! You can search by the care you need and book a verified clinician here: ${link("OPENER_BOOKING_LINK", "https://findyourdoc.com/find")}. We can't give medical advice in messages, but the clinician you book can help.`,
  healthDetails: () =>
    `Thanks for trusting us with that. To protect your privacy, please don't share health details here. You can book a verified clinician privately here: ${link("OPENER_BOOKING_LINK", "https://findyourdoc.com/find")}. If this is an emergency, call 911.`,
  crisis: () =>
    "We're really glad you reached out. Please call or text 988 (Suicide and Crisis Lifeline) right now, or call 911 if you're in danger.",
};

/** Comment and DM keywords from the content calendar, each with its guide. */
export const KEYWORDS: Record<string, { audience: "clinician" | "practice" | "patient"; reply: () => string }> = {
  RATE: {
    audience: "clinician",
    reply: () => `Here's the word-for-word script for asking any agency for the bill rate: ${link("OPENER_LINK_RATE", "[RATE guide link]")}. Are you doing locums now, or thinking about it?`,
  },
  CONTRACT: {
    audience: "clinician",
    reply: () => `Here's the 12-clause locums contract checklist: ${link("OPENER_LINK_CONTRACT", "[CONTRACT guide link]")}. It's general information, not legal advice. Are you looking at a contract right now?`,
  },
  HIRE: {
    audience: "practice",
    reply: () => `Here's the one-page empty provider slot calculator: ${link("OPENER_LINK_HIRE", "[HIRE calculator link]")}. Are you filling a role right now or just following along?`,
  },
  CREDENTIAL: {
    audience: "practice",
    reply: () => `Here's the 30-day credentialing checklist: ${link("OPENER_LINK_CREDENTIAL", "[CREDENTIAL checklist link]")}. Do you have a new hire starting soon?`,
  },
  PRACTICE: {
    audience: "practice",
    reply: () => `Easiest is a free 20-minute hiring-needs call with Dr. Martin. Pick a time here: ${link("OPENER_CALENDAR_LINK", "[calendar link]")}. What role are you trying to fill?`,
  },
  BOOK: { audience: "patient", reply: () => patient.general() },
};
