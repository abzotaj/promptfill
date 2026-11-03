/** The kinds of field the widget knows how to fill. */
export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'month'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio';

/**
 * A fillable field as described to the model. This is all the server ever
 * sees about the page: no values, no DOM, nothing from sensitive fields.
 */
export interface FieldDescriptor {
  /** Stable key for this scan, used to map the answer back to the element. */
  key: string;
  kind: FieldKind;
  /** Human label: <label>, aria-label, placeholder or name, in that order. */
  label: string;
  /** The element's name attribute, when it has one. Helps the model. */
  name?: string;
  /** The element's id, when it has one and differs from the name. */
  id?: string;
  /** The autocomplete token(s), e.g. "given-name" or "shipping postal-code". A strong hint. */
  autocomplete?: string;
  required?: boolean;
  /** Allowed values for select / multiselect / radio. */
  options?: { value: string; label: string }[];
  min?: string;
  max?: string;
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
}

export type FieldValue = string | number | boolean | string[];

export interface FillRequest {
  prompt: string;
  fields: FieldDescriptor[];
  /** Page context so the model knows what kind of form this is. */
  page?: { title?: string; url?: string; formHeading?: string };
  /** Optional locale hint, e.g. "sq-AL" or "de-CH". */
  locale?: string;
}

export interface FillResponse {
  /** key -> value. Keys the model chose to leave empty are omitted. */
  values: Record<string, FieldValue>;
  /** Optional one-line note from the model about assumptions it made. */
  note?: string;
  model?: string;
}

export interface FillError {
  error: string;
  code?: 'unauthorized' | 'bad_request' | 'rate_limited' | 'upstream' | 'origin_not_allowed';
}
