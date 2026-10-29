import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyValues, setNativeValue } from '../src/fill';
import { scan } from '../src/scan';
import { init } from '../src/widget';

function mount(html: string) {
  document.body.innerHTML = html;
}

const FORM = `
  <h2>Checkout</h2>
  <form id="f">
    <label>First name <input name="firstName" required></label>
    <label for="email">Email</label><input id="email" name="email" type="email">
    <input name="phone" type="tel" placeholder="Phone number">
    <label>Country
      <select name="country"><option value="">Select…</option><option value="AL">Albania</option><option value="CH">Switzerland</option></select>
    </label>
    <fieldset><legend>Shipping</legend>
      <label><input type="radio" name="ship" value="std"> Standard</label>
      <label><input type="radio" name="ship" value="exp"> Express</label>
    </fieldset>
    <label><input type="checkbox" name="terms"> Accept terms</label>
    <label>Password <input type="password" name="pw"></label>
    <label>Card number <input name="card" autocomplete="cc-number"></label>
    <input type="hidden" name="csrf" value="x">
    <label style="display:none">Hidden <input name="ghost"></label>
    <textarea name="notes" maxlength="20" aria-label="Notes"></textarea>
  </form>`;

describe('scan', () => {
  beforeEach(() => mount(FORM));

  it('finds fillable fields with good labels and skips sensitive / hidden ones', () => {
    const r = scan(document);
    const byKey = Object.fromEntries(r.fields.map((f) => [f.descriptor.key, f.descriptor]));
    expect(Object.keys(byKey)).toEqual(['firstName', 'email', 'phone', 'country', 'ship', 'terms', 'notes']);
    expect(byKey.firstName.label).toBe('First name');
    expect(byKey.firstName.required).toBe(true);
    expect(byKey.email.label).toBe('Email');
    expect(byKey.phone.label).toBe('Phone number');
    // Label text must not include the select's option text.
    expect(byKey.country.label).toBe('Country');
    expect(byKey.country.options?.map((o) => o.value)).toEqual(['AL', 'CH']);
    expect(byKey.ship.kind).toBe('radio');
    expect(byKey.ship.label).toBe('Shipping');
    expect(byKey.ship.options?.map((o) => o.value)).toEqual(['std', 'exp']);
    expect(byKey.notes.maxLength).toBe(20);
    expect(r.skippedSensitive).toBe(2);
    expect(r.heading).toBe('Shipping'); // first legend/heading inside the form
  });
});

describe('fill', () => {
  beforeEach(() => mount(FORM));

  it('fills every kind and fires input/change events', () => {
    const r = scan(document);
    const events: string[] = [];
    document.querySelector('#f')!.addEventListener('input', (e) => events.push(`input:${(e.target as HTMLInputElement).name}`));

    const res = applyValues(r.fields, {
      firstName: 'Elira',
      email: 'elira@example.com',
      country: 'CH',
      ship: 'exp',
      terms: true,
      notes: 'hi',
    });

    expect(res).toEqual({ filled: 6, failed: [] });
    const q = (s: string) => document.querySelector(s) as HTMLInputElement;
    expect(q('[name=firstName]').value).toBe('Elira');
    expect(q('[name=country]').value).toBe('CH');
    expect(q('[value=exp]').checked).toBe(true);
    expect(q('[name=terms]').checked).toBe(true);
    expect(events).toContain('input:firstName');
  });

  it('rejects select values that are not real options', () => {
    const r = scan(document);
    const res = applyValues(r.fields, { country: 'XX' });
    expect(res.failed).toEqual(['Country']);
  });

  it('bypasses an instance-level value setter the way React needs', () => {
    // Simulate React's value tracker: an own `value` property on the element.
    const el = document.querySelector('[name=firstName]') as HTMLInputElement;
    let tracked = '';
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() { return proto.get!.call(this); },
      set(v) { tracked = v; proto.set!.call(this, v); },
    });
    setNativeValue(el, 'Arben');
    expect(el.value).toBe('Arben');
    expect(tracked).toBe(''); // tracker untouched → React sees the change on 'input'
  });
});

describe('init', () => {
  beforeEach(() => mount(FORM));

  it('mounts in a shadow root, calls the transport and fills', async () => {
    const transport = vi.fn(async (req) => {
      expect(req.fields.some((f: { key: string }) => f.key === 'pw')).toBe(false);
      return { values: { firstName: 'Ana', terms: true } };
    });
    const onFill = vi.fn();
    const w = init({ transport, onFill, hotkey: '' });

    const host = document.querySelector('[data-promptfill-host]')!;
    expect(host.shadowRoot).toBeTruthy();

    await w.fill('anything');
    expect(transport).toHaveBeenCalledOnce();
    expect((document.querySelector('[name=firstName]') as HTMLInputElement).value).toBe('Ana');
    expect(onFill).toHaveBeenCalledWith(expect.objectContaining({ filled: 2 }));

    w.undo();
    expect((document.querySelector('[name=firstName]') as HTMLInputElement).value).toBe('');
    expect((document.querySelector('[name=terms]') as HTMLInputElement).checked).toBe(false);

    w.destroy();
    expect(document.querySelector('[data-promptfill-host]')).toBeNull();
  });

  it('never scans its own UI', () => {
    const w = init({ transport: async () => ({ values: {} }), hotkey: '', open: true });
    const r = scan(document);
    expect(r.fields.every((f) => !f.elements.some((e) => e.closest('[data-promptfill-host]')))).toBe(true);
    w.destroy();
  });
});
