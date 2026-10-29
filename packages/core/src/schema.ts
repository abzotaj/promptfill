import type { FieldDescriptor, FieldValue } from './types';

type JsonSchema = Record<string, unknown>;

/**
 * Build the JSON schema for the model's tool input. Every property maps to one
 * scanned field, so the model cannot invent keys or select options that don't exist.
 */
export function buildFillSchema(fields: FieldDescriptor[]): JsonSchema {
  const properties: Record<string, JsonSchema> = {};

  for (const f of fields) {
    const description = describe(f);
    switch (f.kind) {
      case 'checkbox':
        properties[f.key] = { type: 'boolean', description };
        break;
      case 'number':
        properties[f.key] = {
          type: 'number',
          description,
          ...(f.min !== undefined && f.min !== '' ? { minimum: Number(f.min) } : {}),
          ...(f.max !== undefined && f.max !== '' ? { maximum: Number(f.max) } : {}),
        };
        break;
      case 'select':
      case 'radio':
        properties[f.key] = {
          type: 'string',
          description,
          enum: (f.options ?? []).map((o) => o.value),
        };
        break;
      case 'multiselect':
        properties[f.key] = {
          type: 'array',
          description,
          items: { type: 'string', enum: (f.options ?? []).map((o) => o.value) },
        };
        break;
      default:
        properties[f.key] = {
          type: 'string',
          description,
          ...(f.maxLength && f.maxLength > 0 ? { maxLength: f.maxLength } : {}),
        };
    }
  }

  return {
    type: 'object',
    properties: {
      values: {
        type: 'object',
        properties,
        additionalProperties: false,
        description: 'Values to put into the form, keyed by field key. Omit a field to leave it untouched.',
      },
      note: {
        type: 'string',
        description: 'Optional: one short sentence on any assumption you made. Empty if none.',
      },
    },
    required: ['values'],
    additionalProperties: false,
  };
}

function describe(f: FieldDescriptor): string {
  const parts = [`${f.label}`, `(${f.kind})`];
  if (f.name && f.name !== f.label) parts.push(`name="${f.name}"`);
  if (f.required) parts.push('required');
  if (f.placeholder) parts.push(`placeholder: "${f.placeholder}"`);
  if (f.pattern) parts.push(`pattern: ${f.pattern}`);
  if (f.min) parts.push(`min: ${f.min}`);
  if (f.max) parts.push(`max: ${f.max}`);
  if (f.kind === 'date') parts.push('format YYYY-MM-DD');
  if (f.kind === 'datetime-local') parts.push('format YYYY-MM-DDTHH:mm');
  if (f.kind === 'time') parts.push('format HH:mm');
  if (f.kind === 'month') parts.push('format YYYY-MM');
  if (f.options?.length) {
    parts.push('options: ' + f.options.map((o) => (o.label && o.label !== o.value ? `${o.value} ("${o.label}")` : o.value)).join(', '));
  }
  return parts.join(' · ');
}

/**
 * Validate and coerce what the model returned against the fields we sent.
 * Drops unknown keys and invalid options rather than trusting the model.
 */
export function sanitizeValues(
  fields: FieldDescriptor[],
  raw: unknown,
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  if (!raw || typeof raw !== 'object') return out;
  const byKey = new Map(fields.map((f) => [f.key, f]));

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const f = byKey.get(key);
    if (!f || value === null || value === undefined) continue;
    const allowed = new Set((f.options ?? []).map((o) => o.value));

    switch (f.kind) {
      case 'checkbox':
        if (typeof value === 'boolean') out[key] = value;
        else if (value === 'true' || value === 'false') out[key] = value === 'true';
        break;
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(n)) out[key] = n;
        break;
      }
      case 'select':
      case 'radio':
        if (typeof value === 'string' && allowed.has(value)) out[key] = value;
        break;
      case 'multiselect':
        if (Array.isArray(value)) {
          const picked = value.filter((v): v is string => typeof v === 'string' && allowed.has(v));
          out[key] = picked;
        }
        break;
      default:
        if (typeof value === 'string' || typeof value === 'number') {
          let s = String(value);
          if (f.maxLength && f.maxLength > 0) s = s.slice(0, f.maxLength);
          out[key] = s;
        }
    }
  }
  return out;
}
