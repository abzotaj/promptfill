import { describe, expect, it } from 'vitest';
import { buildFillSchema, isSensitiveField, sanitizeValues, type FieldDescriptor } from '../src';

const fields: FieldDescriptor[] = [
  { key: 'name', kind: 'text', label: 'Name', maxLength: 5 },
  { key: 'qty', kind: 'number', label: 'Qty', min: '1', max: '9' },
  { key: 'country', kind: 'select', label: 'Country', options: [{ value: 'AL', label: 'Albania' }, { value: 'CH', label: 'Switzerland' }] },
  { key: 'tags', kind: 'multiselect', label: 'Tags', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  { key: 'ok', kind: 'checkbox', label: 'OK' },
];

describe('buildFillSchema', () => {
  it('constrains keys and options', () => {
    const s = buildFillSchema(fields) as any;
    const props = s.properties.values.properties;
    expect(s.properties.values.additionalProperties).toBe(false);
    expect(props.country.enum).toEqual(['AL', 'CH']);
    expect(props.tags.items.enum).toEqual(['a', 'b']);
    expect(props.qty).toMatchObject({ type: 'number', minimum: 1, maximum: 9 });
    expect(props.ok.type).toBe('boolean');
    expect(props.name.maxLength).toBe(5);
  });
});

describe('sanitizeValues', () => {
  it('drops unknown keys and invalid options, coerces types', () => {
    expect(
      sanitizeValues(fields, {
        name: 'Arbenita',
        qty: '4',
        country: 'XX',
        tags: ['a', 'z'],
        ok: 'true',
        hacker: 'x',
      }),
    ).toEqual({ name: 'Arben', qty: 4, tags: ['a'], ok: true });
  });
});

describe('isSensitiveField', () => {
  it.each([
    [{ type: 'password' }, true],
    [{ autocomplete: 'cc-number' }, true],
    [{ name: 'iban' }, true],
    [{ label: 'Security code (CVC)' }, true],
    [{ label: 'National ID number' }, true],
    [{ name: 'firstName', label: 'First name' }, false],
    [{ name: 'email', label: 'Email' }, false],
    [{ name: 'company', label: 'Company' }, false],
    [{ name: 'shipping', label: 'Shipping' }, false],
  ])('%o → %s', (input, expected) => {
    expect(isSensitiveField(input)).toBe(expected);
  });
});
