// A first-pass check for patient identifiers before a Lounge post goes live.
// It catches the obvious cases. A flagged post is held for a moderator; it is
// never silently published. This is not a full de-identification system.

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "phone number", re: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
  { name: "Social Security number", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "email address", re: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { name: "medical record number", re: /\b(MRN|medical record)\s*#?:?\s*\d{4,}/i },
  { name: "full date", re: /\b\d{1,2}\/\d{1,2}\/(19|20)\d{2}\b/ },
  { name: "date of birth", re: /\b(DOB|date of birth)\b/i },
  { name: "street address", re: /\b\d{2,5}\s+\w+(\s\w+)?\s(St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane)\b/i },
];

export function findIdentifiers(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}
