import type { FieldValue } from '@promptfill/core';
import { applyValues, type ApplyResult } from './fill';
import { scan, type ScannedField, type ScanResult } from './scan';

/**
 * How a data key is matched to a field. Tried in this order unless `by` says otherwise.
 *
 *  selector      key looks like a CSS selector ("#email", "[name=email]", ".zip input")
 *  id            element id
 *  name          name attribute (radio groups match on the group name)
 *  key           the key the scanner assigned (what the LLM path uses)
 *  label         visible label text
 *  placeholder   placeholder attribute
 *  aria-label    aria-label attribute
 *  testid        data-testid, data-test, data-cy or data-qa
 *  autocomplete  autocomplete token, e.g. "given-name"
 *  fuzzy         every word of the key appears in the label, and exactly one field matches
 *
 * Every comparison is case-, whitespace- and punctuation-insensitive, so
 * "firstName", "first_name", "first-name" and "First name" are all the same key.
 */
export type MatchStrategy =
  | 'selector'
  | 'id'
  | 'name'
  | 'key'
  | 'label'
  | 'placeholder'
  | 'aria-label'
  | 'testid'
  | 'autocomplete'
  | 'fuzzy';

export const DEFAULT_STRATEGIES: MatchStrategy[] = [
  'selector',
  'id',
  'name',
  'key',
  'label',
  'placeholder',
  'aria-label',
  'testid',
  'autocomplete',
  'fuzzy',
];

export interface FillDataOptions {
  /** CSS selector for the form to fill. Defaults to auto-detect (focused form, else the largest). */
  formSelector?: string;
  /** Reuse a previous scan instead of scanning again. */
  scan?: ScanResult;
  /** Strategies to try, in priority order. Defaults to all of them. */
  by?: MatchStrategy[];
  /** Also fill password / card / OTP fields. Off by default. */
  includeSensitive?: boolean;
  /** Briefly outline the fields that were filled. */
  highlight?: boolean;
}

export interface FieldMatch {
  field: ScannedField;
  by: MatchStrategy;
  /** Set when the key named one radio button rather than its group. */
  option?: string;
}

export interface FillDataResult extends ApplyResult {
  /** Keys from the data that matched no field. */
  unmatched: string[];
  /** Data key -> the field it was matched to and how. */
  matches: Record<string, { key: string; label: string; by: MatchStrategy }>;
}

/**
 * Fill a form from a plain object. Keys are matched to fields by id, name,
 * label, placeholder, test id, autocomplete token or a CSS selector; values
 * for selects and radios may be given as option values or option labels.
 *
 *   fillData({ firstName: 'Elira', '#email': 'e@x.com', Country: 'Switzerland', ship: 'Express', terms: true });
 */
export function fillData(data: Record<string, FieldValue>, opts: FillDataOptions = {}): FillDataResult {
  const scanResult =
    opts.scan ?? scan(document, { selector: opts.formSelector, includeSensitive: opts.includeSensitive });
  const strategies = opts.by ?? DEFAULT_STRATEGIES;

  const byFieldKey: Record<string, FieldValue> = {};
  const unmatched: string[] = [];
  const matches: FillDataResult['matches'] = {};
  const taken = new Set<ScannedField>();

  for (const [dataKey, raw] of Object.entries(data)) {
    const m = resolveField(scanResult, dataKey, { by: strategies, exclude: taken });
    if (!m) {
      unmatched.push(dataKey);
      continue;
    }
    const value = coerceValue(m.field, raw, m.option);
    if (value === undefined) {
      unmatched.push(dataKey);
      continue;
    }
    taken.add(m.field);
    byFieldKey[m.field.descriptor.key] = value;
    matches[dataKey] = { key: m.field.descriptor.key, label: m.field.descriptor.label, by: m.by };
  }

  const applied = applyValues(scanResult.fields, byFieldKey, { highlight: opts.highlight });
  return { ...applied, unmatched, matches };
}

/** Find the field a data key refers to, or undefined. Exported for custom flows. */
export function resolveField(
  scanResult: ScanResult,
  dataKey: string,
  opts: { by?: MatchStrategy[]; exclude?: Set<ScannedField> } = {},
): FieldMatch | undefined {
  const fields = opts.exclude ? scanResult.fields.filter((f) => !opts.exclude!.has(f)) : scanResult.fields;
  const want = norm(dataKey);
  if (!want && !looksLikeSelector(dataKey)) return undefined;

  for (const by of opts.by ?? DEFAULT_STRATEGIES) {
    const found = matchBy(by, fields, dataKey, want, scanResult.root);
    if (found) return { ...found, by };
  }
  return undefined;
}

function matchBy(
  by: MatchStrategy,
  fields: ScannedField[],
  dataKey: string,
  want: string,
  root: ParentNode,
): Omit<FieldMatch, 'by'> | undefined {
  switch (by) {
    case 'selector': {
      if (!looksLikeSelector(dataKey)) return;
      let el: Element | null = null;
      try {
        el = root.querySelector(dataKey) ?? document.querySelector(dataKey);
      } catch {
        return;
      }
      if (!el) return;
      return byElement(fields, (e) => e === el || e.contains(el!) || el!.contains(e));
    }
    case 'id':
      return byElement(fields, (e) => !!e.id && norm(e.id) === want);
    case 'name':
      return first(fields, (f) => !!f.descriptor.name && norm(f.descriptor.name) === want);
    case 'key':
      return first(fields, (f) => norm(f.descriptor.key) === want);
    case 'label':
      return (
        first(fields, (f) => norm(f.descriptor.label) === want) ??
        // A radio option's own label, e.g. { Express: true }.
        byElement(fields, (e) => e instanceof HTMLInputElement && e.type === 'radio' && norm(labelOf(e)) === want)
      );
    case 'placeholder':
      return byElement(fields, (e) => norm(e.getAttribute('placeholder') ?? '') === want);
    case 'aria-label':
      return byElement(fields, (e) => norm(e.getAttribute('aria-label') ?? '') === want);
    case 'testid':
      return byElement(fields, (e) =>
        ['data-testid', 'data-test', 'data-cy', 'data-qa'].some((a) => norm(e.getAttribute(a) ?? '') === want),
      );
    case 'autocomplete':
      return byElement(fields, (e) => {
        const tokens = (e.getAttribute('autocomplete') ?? '').split(/\s+/).filter(Boolean);
        return tokens.some((t) => norm(t) === want) || norm(tokens.join(' ')) === want;
      });
    case 'fuzzy': {
      const keyWords = words(dataKey);
      if (!keyWords.length || want.length < 3) return;
      const hits = fields.filter((f) => {
        const labelWords = new Set(words(f.descriptor.label));
        return keyWords.every((w) => labelWords.has(w));
      });
      return hits.length === 1 ? { field: hits[0] } : undefined;
    }
  }
}

function first(fields: ScannedField[], pred: (f: ScannedField) => boolean): Omit<FieldMatch, 'by'> | undefined {
  const f = fields.find(pred);
  return f ? { field: f } : undefined;
}

/** Match on an element; for a radio group, remember which option it was. */
function byElement(fields: ScannedField[], pred: (e: HTMLElement) => boolean): Omit<FieldMatch, 'by'> | undefined {
  for (const field of fields) {
    const el = field.elements.find(pred);
    if (!el) continue;
    if (field.descriptor.kind === 'radio' && field.elements.length > 1) {
      // The key named a specific radio only if it doesn't identify the whole group.
      const groupWide = field.elements.every(pred);
      return groupWide ? { field } : { field, option: (el as HTMLInputElement).value };
    }
    return { field };
  }
  return undefined;
}

/**
 * Turn user-friendly input into what applyValues expects:
 * option labels -> option values, "yes"/"on" -> true, numbers -> strings.
 * Returns undefined when the value can't be mapped onto the field.
 */
export function coerceValue(field: ScannedField, raw: FieldValue, option?: string): FieldValue | undefined {
  const { kind, options } = field.descriptor;

  if (kind === 'radio') {
    if (option !== undefined) return truthy(raw) ? option : undefined;
    return optionValue(options, raw);
  }
  if (kind === 'checkbox') return truthy(raw);
  if (kind === 'select') return optionValue(options, raw);
  if (kind === 'multiselect') {
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    const mapped = list.map((v) => optionValue(options, v.toString().trim())).filter((v): v is string => v !== undefined);
    return mapped.length || list.length === 0 ? mapped : undefined;
  }
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'boolean') return raw ? 'true' : '';
  return raw;
}

function optionValue(options: { value: string; label: string }[] | undefined, raw: FieldValue): string | undefined {
  if (!options) return String(raw);
  const s = String(raw);
  const exact = options.find((o) => o.value === s);
  if (exact) return exact.value;
  const n = norm(s);
  const loose = options.find((o) => norm(o.value) === n || norm(o.label) === n);
  return loose?.value;
}

function truthy(v: FieldValue): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  return !/^(|false|no|off|0|unchecked)$/i.test(v.trim());
}

function labelOf(el: HTMLInputElement): string {
  return el.labels?.[0]?.textContent ?? el.getAttribute('aria-label') ?? '';
}

function looksLikeSelector(s: string): boolean {
  return /^[#.[]|[>\s][#.[a-z]/i.test(s.trim()) && /[#.[\]=:>]/.test(s);
}

/** Words of a key or label: "firstName" / "first_name" / "First name" -> ["first", "name"]. */
function words(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map(norm)
    .filter(Boolean);
}

/** Lowercase alphanumerics only: "First name" / "first_name" / "firstName" -> "firstname". */
export function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
