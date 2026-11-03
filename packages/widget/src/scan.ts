import { isSensitiveField, LIMITS, type FieldDescriptor, type FieldKind } from '@promptfill/core';

export const HOST_ATTR = 'data-promptfill-host';
export const IGNORE_ATTR = 'data-promptfill-ignore';

/** One scanned field plus the element(s) it maps back to. */
export interface ScannedField {
  descriptor: FieldDescriptor;
  /** One element for most kinds; every radio in the group for 'radio'. */
  elements: (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
}

export interface ScanResult {
  fields: ScannedField[];
  /** How many fields were skipped because they looked sensitive. */
  skippedSensitive: number;
  /** The form (or root) that was scanned, if one was picked. */
  root: ParentNode;
  heading?: string;
}

const TEXTLIKE: Record<string, FieldKind> = {
  text: 'text',
  search: 'text',
  password: 'text', // only reachable with includeSensitive
  email: 'email',
  tel: 'tel',
  url: 'url',
  number: 'number',
  range: 'number',
  date: 'date',
  'datetime-local': 'datetime-local',
  time: 'time',
  month: 'month',
  checkbox: 'checkbox',
  radio: 'radio',
};

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file', 'color', 'week']);

type Fillable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Pick what to scan. Priority: explicit selector → the form containing the
 * focused element → the form with the most fillable fields → the whole document.
 */
export function pickRoot(doc: Document, selector?: string): ParentNode {
  if (selector) {
    const el = doc.querySelector(selector);
    if (el) return el;
  }
  const active = doc.activeElement;
  const activeForm = active && !isInsideWidget(active) ? active.closest('form') : null;
  if (activeForm) return activeForm;

  let best: HTMLFormElement | null = null;
  let bestCount = 0;
  doc.querySelectorAll('form').forEach((form) => {
    const n = candidates(form).length;
    if (n > bestCount) {
      best = form;
      bestCount = n;
    }
  });
  return best ?? doc;
}

export interface ScanOptions {
  /** CSS selector for the form/root to scan. Defaults to auto-detect. */
  selector?: string;
  /** Include password / card / OTP fields. Never used on the LLM path; only for fillData(). */
  includeSensitive?: boolean;
}

export function scan(doc: Document, opts: ScanOptions = {}): ScanResult {
  const root = pickRoot(doc, opts.selector);
  const fields: ScannedField[] = [];
  const usedKeys = new Set<string>();
  const radioGroups = new Map<string, ScannedField>();
  let skippedSensitive = 0;

  for (const el of candidates(root)) {
    const label = resolveLabel(el, doc);
    const type = el instanceof HTMLInputElement ? el.type.toLowerCase() : undefined;

    if (
      !opts.includeSensitive &&
      isSensitiveField({
        type,
        autocomplete: el.getAttribute('autocomplete'),
        name: el.getAttribute('name'),
        id: el.id,
        label,
      })
    ) {
      skippedSensitive++;
      continue;
    }

    // Radios: one descriptor per group, options from each radio.
    if (el instanceof HTMLInputElement && type === 'radio') {
      const groupName = el.name || el.id || `radio_${fields.length}`;
      let group = radioGroups.get(groupName);
      if (!group) {
        group = {
          descriptor: {
            key: uniqueKey(groupName, usedKeys),
            kind: 'radio',
            label: resolveGroupLabel(el) ?? label,
            name: el.name || undefined,
            required: el.required || undefined,
            options: [],
          },
          elements: [],
        };
        radioGroups.set(groupName, group);
        fields.push(group);
      }
      group.elements.push(el);
      group.descriptor.options!.push({ value: el.value, label });
      continue;
    }

    const kind = kindOf(el);
    if (!kind) continue;

    const descriptor: FieldDescriptor = {
      key: uniqueKey(el.getAttribute('name') || el.id || slug(label) || `field_${fields.length}`, usedKeys),
      kind,
      label,
      name: el.getAttribute('name') || undefined,
      required: el.required || undefined,
    };
    if (el.id && el.id !== descriptor.name) descriptor.id = el.id;
    const ac = el.getAttribute('autocomplete')?.trim().toLowerCase();
    if (ac && ac !== 'on' && ac !== 'off') descriptor.autocomplete = ac;

    if (el instanceof HTMLSelectElement) {
      descriptor.options = Array.from(el.options)
        .filter((o) => !o.disabled && !(o.value === '' && !el.multiple))
        .slice(0, LIMITS.maxOptions)
        .map((o) => ({ value: o.value, label: clip(o.label || o.text) }));
    }
    if (el instanceof HTMLInputElement) {
      if (el.min) descriptor.min = el.min;
      if (el.max) descriptor.max = el.max;
      if (el.pattern) descriptor.pattern = el.pattern;
    }
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.maxLength > 0) {
      descriptor.maxLength = el.maxLength;
    }
    const ph = el.getAttribute('placeholder');
    if (ph && ph !== label) descriptor.placeholder = clip(ph);

    fields.push({ descriptor, elements: [el] });
    if (fields.length >= LIMITS.maxFields) break;
  }

  return { fields, skippedSensitive, root, heading: findHeading(root, doc) };
}

function candidates(root: ParentNode): Fillable[] {
  return Array.from(root.querySelectorAll<Fillable>('input, select, textarea')).filter((el) => {
    if (isInsideWidget(el)) return false;
    if (el.closest(`[${IGNORE_ATTR}]`)) return false;
    if (el.disabled || (el as HTMLInputElement).readOnly) return false;
    if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type.toLowerCase())) return false;
    return isVisible(el);
  });
}

function kindOf(el: Fillable): FieldKind | undefined {
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLSelectElement) return el.multiple ? 'multiselect' : 'select';
  return TEXTLIKE[el.type.toLowerCase()];
}

function isInsideWidget(el: Element): boolean {
  return !!el.closest(`[${HOST_ATTR}]`);
}

function isVisible(el: HTMLElement): boolean {
  if (el.hidden || el.closest('[hidden]') || el.closest('[aria-hidden="true"]')) return false;
  const win = el.ownerDocument.defaultView;
  if (!win) return true;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const s = win.getComputedStyle(node);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
  }
  // Visually-hidden custom checkboxes/radios are common and still fillable via click,
  // so we don't require a non-zero box for them.
  return true;
}

export function resolveLabel(el: Fillable, doc: Document): string {
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (text) return clip(text);
  }
  const fromLabels = el.labels?.[0] ? labelText(el.labels[0]) : '';
  if (fromLabels) return clip(fromLabels);
  const aria = el.getAttribute('aria-label');
  if (aria) return clip(aria);
  const ph = el.getAttribute('placeholder');
  if (ph) return clip(ph);
  const title = el.getAttribute('title');
  if (title) return clip(title);
  return clip(humanize(el.getAttribute('name') || el.id || el.type || 'field'));
}

/** A label's own text, without the text of controls nested inside it (e.g. a select's options). */
function labelText(label: HTMLLabelElement): string {
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('input, select, textarea, button').forEach((n) => n.remove());
  return copy.textContent?.trim() ?? '';
}

function resolveGroupLabel(el: HTMLInputElement): string | undefined {
  const fieldset = el.closest('fieldset');
  const legend = fieldset?.querySelector('legend')?.textContent?.trim();
  if (legend) return clip(legend);
  const group = el.closest('[role="radiogroup"]');
  const aria = group?.getAttribute('aria-label');
  if (aria) return clip(aria);
  return el.name ? clip(humanize(el.name)) : undefined;
}

function findHeading(root: ParentNode, doc: Document): string | undefined {
  const scope = root instanceof Element ? root : doc.body;
  const inside = scope?.querySelector('legend, h1, h2, h3');
  const around =
    root instanceof Element ? root.closest('section, main, article')?.querySelector('h1, h2, h3') : null;
  const text = (inside ?? around ?? doc.querySelector('h1'))?.textContent?.trim();
  return text ? clip(text) : undefined;
}

function uniqueKey(base: string, used: Set<string>): string {
  const clean = base.replace(/[^\w.-]/g, '_').slice(0, 60) || 'field';
  let key = clean;
  for (let i = 2; used.has(key); i++) key = `${clean}_${i}`;
  used.add(key);
  return key;
}

function humanize(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.[\]]+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

function clip(s: string): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > LIMITS.maxLabelChars ? one.slice(0, LIMITS.maxLabelChars) + '…' : one;
}
