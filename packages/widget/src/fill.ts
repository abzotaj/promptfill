import type { FieldValue } from '@promptfill/core';
import type { ScannedField } from './scan';

type Fillable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** What a field looked like before we touched it, so the user can undo. */
export type Snapshot = Array<{ el: Fillable; value: string; checked?: boolean; selected?: boolean[] }>;

/**
 * Set a value the way a user would, so React / Vue / Angular see the change.
 *
 * React wraps each input's `value` property to track the last value it saw.
 * Assigning `el.value = x` updates that tracker too, so React thinks nothing
 * changed and ignores the input event. Calling the prototype's native setter
 * bypasses the tracker; the event that follows then reads as a real change.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function fire(el: Element, type: 'input' | 'change' | 'blur' | 'focus'): void {
  const Ctor = type === 'blur' || type === 'focus' ? FocusEvent : Event;
  el.dispatchEvent(new Ctor(type, { bubbles: type !== 'focus' && type !== 'blur' }));
}

/** Toggle via click() so frameworks that listen for click/change both update. */
function setChecked(el: HTMLInputElement, checked: boolean): void {
  if (el.checked !== checked) el.click();
  // Some custom components swallow click; fall back to the property + event.
  if (el.checked !== checked) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
    setter?.call(el, checked);
    fire(el, 'input');
    fire(el, 'change');
  }
}

export function snapshot(fields: ScannedField[]): Snapshot {
  const snap: Snapshot = [];
  for (const f of fields) {
    for (const el of f.elements) {
      snap.push({
        el,
        value: el.value,
        checked: el instanceof HTMLInputElement ? el.checked : undefined,
        selected: el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => o.selected) : undefined,
      });
    }
  }
  return snap;
}

export function restore(snap: Snapshot): void {
  for (const s of snap) {
    const el = s.el;
    if (!el.isConnected) continue;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      setChecked(el, !!s.checked);
    } else if (el instanceof HTMLSelectElement && el.multiple && s.selected) {
      Array.from(el.options).forEach((o, i) => (o.selected = s.selected![i] ?? false));
      fire(el, 'input');
      fire(el, 'change');
    } else {
      setNativeValue(el, s.value);
      fire(el, 'input');
      fire(el, 'change');
    }
  }
}

export interface ApplyResult {
  filled: number;
  failed: string[];
}

export function applyValues(
  fields: ScannedField[],
  values: Record<string, FieldValue>,
  opts: { highlight?: boolean } = {},
): ApplyResult {
  let filled = 0;
  const failed: string[] = [];

  for (const field of fields) {
    const { key, kind } = field.descriptor;
    if (!(key in values)) continue;
    const value = values[key];
    try {
      const ok = applyOne(field, kind, value);
      if (ok) {
        filled++;
        if (opts.highlight) flash(field.elements);
      } else failed.push(field.descriptor.label);
    } catch {
      failed.push(field.descriptor.label);
    }
  }
  return { filled, failed };
}

function applyOne(field: ScannedField, kind: string, value: FieldValue): boolean {
  const [first] = field.elements;
  if (!first || !first.isConnected) return false;

  if (kind === 'radio') {
    const target = field.elements.find((el) => el.value === String(value)) as HTMLInputElement | undefined;
    if (!target) return false;
    setChecked(target, true);
    return target.checked;
  }

  if (kind === 'checkbox' && first instanceof HTMLInputElement) {
    setChecked(first, value === true || value === 'true');
    return true;
  }

  if (kind === 'multiselect' && first instanceof HTMLSelectElement) {
    const wanted = new Set(Array.isArray(value) ? value : [String(value)]);
    Array.from(first.options).forEach((o) => (o.selected = wanted.has(o.value)));
    fire(first, 'input');
    fire(first, 'change');
    return true;
  }

  const str = String(value);
  if (first instanceof HTMLSelectElement && !Array.from(first.options).some((o) => o.value === str)) {
    return false;
  }
  first.focus({ preventScroll: true });
  setNativeValue(first, str);
  fire(first, 'input');
  fire(first, 'change');
  first.blur();
  // Browsers silently reject malformed values (e.g. a bad date) by clearing the field.
  return str === '' || first.value !== '';
}

function flash(elements: Element[]): void {
  for (const el of elements) {
    // Custom checkboxes are often visually hidden, so outline the label instead.
    const isToggle = el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox');
    const target = isToggle ? ((el as HTMLInputElement).labels?.[0] ?? el) : el;
    const h = target as HTMLElement;
    const prev = h.style.outline;
    const prevOffset = h.style.outlineOffset;
    h.style.outline = '2px solid #7c5cff';
    h.style.outlineOffset = '2px';
    setTimeout(() => {
      h.style.outline = prev;
      h.style.outlineOffset = prevOffset;
    }, 1400);
  }
}
