export * from './types';
export { buildFillSchema, sanitizeValues } from './schema';
export { isSensitiveField } from './sensitive';
export type { SensitivityInput } from './sensitive';

/** Limits shared by the widget (to pre-trim) and the server (to enforce). */
export const LIMITS = {
  maxFields: 150,
  maxPromptChars: 4000,
  maxLabelChars: 200,
  maxOptions: 200,
} as const;
