import { describe, expect, it } from 'vitest';
import type { FieldDescriptor } from '@promptfill/core';
import { fakeValues, fakerTransport, infer, modeFromPrompt } from '../src';
import { availableLocales, fakerForLocale } from '../src/locales';

const F = (f: Partial<FieldDescriptor> & { key: string }): FieldDescriptor => ({ kind: 'text', label: f.key, ...f });

const FORM: FieldDescriptor[] = [
  F({ key: 'firstName', label: 'First name' }),
  F({ key: 'lastName', label: 'Last name' }),
  F({ key: 'email', kind: 'email', label: 'Email' }),
  F({ key: 'phone', kind: 'tel', label: 'Phone' }),
  F({ key: 'company', label: 'Company' }),
  F({ key: 'addr1', label: 'Address', autocomplete: 'shipping address-line1' }),
  F({ key: 'city', label: 'City' }),
  F({ key: 'zip', label: 'Postal code', maxLength: 10 }),
  F({ key: 'country', kind: 'select', label: 'Country', options: [{ value: '', label: 'Pick' }, { value: 'AL', label: 'Albania' }, { value: 'CH', label: 'Switzerland' }] }),
  F({ key: 'seats', kind: 'number', label: 'Seats', min: '1', max: '50' }),
  F({ key: 'start', kind: 'date', label: 'Start date', min: '2026-01-01', max: '2026-12-31' }),
  F({ key: 'dob', kind: 'date', label: 'Date of birth' }),
  F({ key: 'ship', kind: 'radio', label: 'Shipping', options: [{ value: 'std', label: 'Standard' }, { value: 'exp', label: 'Express' }] }),
  F({ key: 'langs', kind: 'multiselect', label: 'Languages', options: [{ value: 'en', label: 'English' }, { value: 'de', label: 'German' }] }),
  F({ key: 'terms', kind: 'checkbox', label: 'I accept the terms' }),
  F({ key: 'newsletter', kind: 'checkbox', label: 'Subscribe to newsletter' }),
  F({ key: 'notes', kind: 'textarea', label: 'Notes', maxLength: 60 }),
  F({ key: 'website', label: 'Website' }),
  F({ key: 'code', label: 'Code', pattern: '[A-Z]{3}-[0-9]{4}' }),
];

describe('infer', () => {
  it('prefers autocomplete, then keywords in id/name/label, then the input type', () => {
    expect(infer(F({ key: 'x', label: 'Whatever', autocomplete: 'given-name' }))).toEqual({ generator: 'firstName', reason: 'autocomplete' });
    expect(infer(F({ key: 'billing_postal_code', label: 'Enter here' })).generator).toBe('zip');
    expect(infer(F({ key: 'f1', id: 'companyName', label: '' })).generator).toBe('company');
    expect(infer(F({ key: 'f2', label: 'Your name' })).generator).toBe('fullName');
    expect(infer(F({ key: 'f3', label: 'Email address' })).generator).toBe('email');
    expect(infer(F({ key: 'f4', label: 'Street address' })).generator).toBe('streetAddress');
    expect(infer(F({ key: 'f5', label: 'Job title' })).generator).toBe('jobTitle');
    expect(infer(F({ key: 'f6', label: 'Title' })).generator).toBe('title');
    expect(infer(F({ key: 'f7', kind: 'number', label: 'Age' })).generator).toBe('age');
    expect(infer(F({ key: 'f8', kind: 'number', label: 'Nickname' })).generator).toBe('number'); // type wins over a text keyword
    expect(infer(F({ key: 'f9', kind: 'date', label: 'Birthday' })).generator).toBe('birthdate');
    expect(infer(F({ key: 'f10', kind: 'tel', label: 'Anything' }))).toEqual({ generator: 'phone', reason: 'kind' });
    expect(infer(F({ key: 'f11', kind: 'select', label: 'First name', options: [] })).generator).toBe('option');
    expect(infer(F({ key: 'f12', label: 'Mystery' })).generator).toBe('text');
    expect(infer(F({ key: 'f13', label: 'Mystery', pattern: '\\d+' })).generator).toBe('pattern');
  });
});

describe('fakeValues', () => {
  it('fills every field with a value that fits its constraints', () => {
    const { values, inferences } = fakeValues(FORM, { seed: 7 });
    expect(Object.keys(values).sort()).toEqual(FORM.map((f) => f.key).sort());
    expect(inferences.addr1).toEqual({ generator: 'streetAddress', reason: 'autocomplete' });

    expect(values.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
    expect(String(values.email)).toContain(String(values.lastName).toLowerCase().replace(/[^a-z]/g, '').slice(0, 3));
    expect(String(values.zip).length).toBeLessThanOrEqual(10);
    expect(['AL', 'CH']).toContain(values.country);
    expect(values.seats).toBeGreaterThanOrEqual(1);
    expect(values.seats).toBeLessThanOrEqual(50);
    expect(Number.isInteger(values.seats)).toBe(true);
    expect(values.start).toMatch(/^2026-\d{2}-\d{2}$/);
    expect(values.dob).toMatch(/^(19|20)\d{2}-\d{2}-\d{2}$/);
    expect(new Date().getFullYear() - Number(String(values.dob).slice(0, 4))).toBeGreaterThanOrEqual(18);
    expect(['std', 'exp']).toContain(values.ship);
    expect(values.langs).toBeInstanceOf(Array);
    expect((values.langs as string[]).every((v) => ['en', 'de'].includes(v))).toBe(true);
    expect(values.terms).toBe(true);
    expect(typeof values.newsletter).toBe('boolean');
    expect(String(values.notes).length).toBeLessThanOrEqual(60);
    expect(values.website).toMatch(/^https?:\/\//);
    expect(values.code).toMatch(/^[A-Z]{3}-[0-9]{4}$/);
  });

  it('is reproducible with a seed', () => {
    expect(fakeValues(FORM, { seed: 1 }).values).toEqual(fakeValues(FORM, { seed: 1 }).values);
    expect(fakeValues(FORM, { seed: 1 }).values).not.toEqual(fakeValues(FORM, { seed: 2 }).values);
  });

  it('invalid mode breaks formats but keeps enum fields legal', () => {
    const { values } = fakeValues(FORM, { seed: 3, mode: 'invalid' });
    expect(values.email).toContain('@@');
    expect(values.phone).toBe('12-34');
    expect(values.seats).toBe(51);
    expect(values.start).toBe('2024-13-45');
    expect(values.website).toBe('not a url');
    expect(values.terms).toBe(false);
    expect(['AL', 'CH']).toContain(values.country);
  });

  it('edge mode sits on the boundaries and fills text to maxLength', () => {
    const { values } = fakeValues(FORM, { seed: 4, mode: 'edge' });
    expect([1, 50]).toContain(values.seats);
    expect(['2026-01-01', '2026-12-31']).toContain(values.start);
    expect(String(values.notes).length).toBe(60);
    expect(values.langs).toEqual(expect.arrayContaining(['en', 'de']));
    expect(String(values.lastName)).toMatch(/[^\x00-\x7F]|'|-/);
  });

  it('never emits sensitive keys the server would drop, and drops empty selects', () => {
    const { values } = fakeValues([F({ key: 'empty', kind: 'select', label: 'Nothing', options: [] })]);
    expect(values).toEqual({});
  });
});

describe('locales', () => {
  it('builds a localized faker with fallbacks', () => {
    const de = fakerForLocale('de-CH');
    de.seed(1);
    expect(de.phone.number()).toMatch(/^(0041|\+41|0\d{2})/);
    expect(fakerForLocale('xx-YY').person.firstName()).toBeTruthy(); // falls back to English
    expect(availableLocales).toContain('fr');
    expect(availableLocales).toContain('de_CH');
  });
});

describe('fakerTransport', () => {
  it('acts as a widget transport and reads the mode from the prompt', async () => {
    const t = fakerTransport({ seed: 9, faker: fakerForLocale });
    const res = await t({ prompt: 'a realistic customer', fields: FORM, locale: 'sq-AL' });
    expect(res.model).toBe('faker');
    expect(res.note).toContain('sq-AL');
    expect(Object.keys(res.values)).toHaveLength(FORM.length);

    const bad = await t({ prompt: 'plausible but INVALID data', fields: FORM });
    expect(bad.values.phone).toBe('12-34');
    expect(modeFromPrompt('very long edge cases')).toBe('edge');
  });
});
