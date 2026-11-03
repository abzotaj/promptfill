import { beforeEach, describe, expect, it } from 'vitest';
import { fillData, resolveField } from '../src/match';
import { scan } from '../src/scan';
import { init } from '../src/widget';

const FORM = `
  <form id="f">
    <label>First name <input name="firstName" required></label>
    <label for="email">Email address</label><input id="email" name="email" type="email">
    <input name="phone" type="tel" placeholder="Phone number">
    <input id="postal" data-testid="zip-input" autocomplete="postal-code">
    <input name="age" type="number" min="0" max="120">
    <label>Country
      <select name="country"><option value="">Select…</option><option value="AL">Albania</option><option value="CH">Switzerland</option></select>
    </label>
    <label>Languages
      <select name="langs" multiple><option value="en">English</option><option value="de">German</option><option value="sq">Albanian</option></select>
    </label>
    <fieldset><legend>Shipping</legend>
      <label><input type="radio" name="ship" id="ship-std" value="std"> Standard</label>
      <label><input type="radio" name="ship" id="ship-exp" value="exp"> Express</label>
    </fieldset>
    <label><input type="checkbox" name="terms"> Accept terms</label>
    <label>Password <input type="password" name="pw"></label>
    <textarea name="notes" aria-label="Order notes"></textarea>
  </form>`;

const q = (s: string) => document.querySelector(s) as HTMLInputElement;

describe('resolveField', () => {
  beforeEach(() => (document.body.innerHTML = FORM));

  it('matches by id, name, label, placeholder, aria-label, testid, autocomplete and selector', () => {
    const r = scan(document);
    const by = (k: string, strategies?: Parameters<typeof resolveField>[2] extends infer O ? (O extends { by?: infer B } ? B : never) : never) => {
      const m = resolveField(r, k, { by: strategies });
      return m && [m.field.descriptor.key, m.by];
    };
    expect(by('email')).toEqual(['email', 'id']);
    expect(by('firstName')).toEqual(['firstName', 'name']);
    expect(by('First name')).toEqual(['firstName', 'name']); // normalised: same as the name attr
    expect(by('Email address')).toEqual(['email', 'label']);
    expect(by('Phone number')).toEqual(['phone', 'label']); // placeholder doubles as the label
    expect(by('Phone number', ['placeholder'])).toEqual(['phone', 'placeholder']);
    expect(by('zip-input')).toEqual(['postal', 'testid']);
    expect(by('postal-code')).toEqual(['postal', 'autocomplete']);
    expect(by('Order notes')).toEqual(['notes', 'label']); // aria-label doubles as the label
    expect(by('Order notes', ['aria-label'])).toEqual(['notes', 'aria-label']);
    expect(by('#postal')).toEqual(['postal', 'selector']);
    expect(by('[name="country"]')).toEqual(['country', 'selector']);
    expect(by('nothing-here')).toBeUndefined();
  });

  it('falls back to a fuzzy label match only when it is unambiguous', () => {
    const r = scan(document);
    expect(resolveField(r, 'notes')?.field.descriptor.key).toBe('notes'); // name
    expect(resolveField(r, 'Shipping method')).toBeUndefined();
    expect(resolveField(r, 'terms accept')?.by).toBe('fuzzy');
    expect(resolveField(r, 'name')?.field.descriptor.key).toBe('firstName'); // only label containing the word
    expect(resolveField(r, 'Accept')?.by).toBe('fuzzy');
    expect(resolveField(r, 'Accept')?.field.descriptor.key).toBe('terms');
  });

  it('can be restricted to specific strategies', () => {
    const r = scan(document);
    expect(resolveField(r, 'Email address', { by: ['id', 'name'] })).toBeUndefined();
    expect(resolveField(r, 'Email address', { by: ['label'] })?.by).toBe('label');
  });
});

describe('fillData', () => {
  beforeEach(() => (document.body.innerHTML = FORM));

  it('fills a form from a plain object using mixed keys and option labels', () => {
    const res = fillData({
      firstName: 'Elira',
      '#email': 'elira@example.com',
      'Phone number': '+355 69 000 0000',
      'zip-input': '1000',
      age: 34,
      Country: 'Switzerland', // option label, not value
      Languages: ['English', 'sq'], // mixed labels and values
      ship: 'Express',
      terms: 'yes',
      'Order notes': 'Leave at the door',
    });

    expect(res.unmatched).toEqual([]);
    expect(res.failed).toEqual([]);
    expect(res.filled).toBe(10);
    expect(res.matches.Country).toEqual({ key: 'country', label: 'Country', by: 'name' });
    expect(res.matches['Order notes'].by).toBe('label');

    expect(q('[name=firstName]').value).toBe('Elira');
    expect(q('#email').value).toBe('elira@example.com');
    expect(q('[name=phone]').value).toBe('+355 69 000 0000');
    expect(q('#postal').value).toBe('1000');
    expect(q('[name=age]').value).toBe('34');
    expect(q('[name=country]').value).toBe('CH');
    expect(Array.from((q('[name=langs]') as unknown as HTMLSelectElement).selectedOptions).map((o) => o.value)).toEqual(['en', 'sq']);
    expect(q('#ship-exp').checked).toBe(true);
    expect(q('[name=terms]').checked).toBe(true);
    expect(q('[name=notes]').value).toBe('Leave at the door');
  });

  it('selects a radio by its own id or label with a truthy value', () => {
    fillData({ 'ship-std': true });
    expect(q('#ship-std').checked).toBe(true);
    fillData({ Express: 'on' });
    expect(q('#ship-exp').checked).toBe(true);
    const res = fillData({ 'ship-std': false });
    expect(res.unmatched).toEqual(['ship-std']);
    expect(q('#ship-exp').checked).toBe(true);
  });

  it('reports keys that match nothing and values that fit no option', () => {
    const res = fillData({ nope: 'x', Country: 'Mars', terms: false });
    expect(res.unmatched).toEqual(['nope', 'Country']);
    expect(res.filled).toBe(1);
    expect(q('[name=terms]').checked).toBe(false);
  });

  it('skips sensitive fields unless explicitly asked', () => {
    expect(fillData({ pw: 'hunter2' }).unmatched).toEqual(['pw']);
    expect(q('[name=pw]').value).toBe('');
    expect(fillData({ pw: 'hunter2' }, { includeSensitive: true }).filled).toBe(1);
    expect(q('[name=pw]').value).toBe('hunter2');
  });

  it('fires input/change so frameworks notice', () => {
    const events: string[] = [];
    document.querySelector('#f')!.addEventListener('input', (e) => events.push((e.target as HTMLInputElement).name));
    document.querySelector('#f')!.addEventListener('change', (e) => events.push('change:' + (e.target as HTMLInputElement).name));
    fillData({ firstName: 'A', Country: 'Albania' });
    expect(events).toEqual(['firstName', 'change:firstName', 'country', 'change:country']);
  });
});

describe('instance.fillData', () => {
  beforeEach(() => (document.body.innerHTML = FORM));

  it('fills, reports via onFill and supports undo', () => {
    const calls: unknown[] = [];
    const w = init({ transport: async () => ({ values: {} }), hotkey: '', onFill: (r) => calls.push(r) });
    const res = w.fillData({ firstName: 'Ana', terms: true });
    expect(res.filled).toBe(2);
    expect(calls).toHaveLength(1);
    expect(q('[name=firstName]').value).toBe('Ana');
    w.undo();
    expect(q('[name=firstName]').value).toBe('');
    expect(q('[name=terms]').checked).toBe(false);
    w.destroy();
  });
});
