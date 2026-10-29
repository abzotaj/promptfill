/**
 * Fields PromptFill must never fill and never describe to the model.
 * Matched against type, autocomplete, name, id and label.
 */
const SENSITIVE_AUTOCOMPLETE = new Set([
  'current-password',
  'new-password',
  'one-time-code',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-name',
  'cc-type',
]);

const SENSITIVE_PATTERN =
  /pass(word|wd|code)?\b|\bpwd\b|\botp\b|\bpin\b|\bcvc\b|\bcvv\b|\bcsc\b|card.?(number|no)|credit.?card|\biban\b|\bswift\b|\bbic\b|account.?(number|no)|routing|\bssn\b|social.?security|passport|national.?id|tax.?id|secret|api.?key|token/i;

export interface SensitivityInput {
  type?: string | null;
  autocomplete?: string | null;
  name?: string | null;
  id?: string | null;
  label?: string | null;
}

export function isSensitiveField(f: SensitivityInput): boolean {
  if ((f.type ?? '').toLowerCase() === 'password') return true;
  const ac = (f.autocomplete ?? '').toLowerCase().split(/\s+/);
  if (ac.some((t) => SENSITIVE_AUTOCOMPLETE.has(t))) return true;
  const haystack = [f.name, f.id, f.label].filter(Boolean).join(' ');
  return SENSITIVE_PATTERN.test(haystack);
}
