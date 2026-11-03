import type { Faker } from '@faker-js/faker';
import type { FillRequest, FillResponse } from '@promptfill/core';
import { fakeValues, type FakeMode, type FakeOptions } from './generate';

export interface FakerTransportOptions extends Omit<FakeOptions, 'faker'> {
  /**
   * A Faker instance, or a function that builds one for the request's locale
   * (pass `fakerForLocale` from "@promptfill/faker/locales"). Defaults to English.
   */
  faker?: Faker | ((locale?: string) => Faker);
}

/** Reads the prompt for hints like "invalid" or "edge cases" so the widget presets still mean something. */
export function modeFromPrompt(prompt: string): FakeMode {
  const p = prompt.toLowerCase();
  if (/\b(invalid|malformed|wrong|broken|fail|bad)\b/.test(p)) return 'invalid';
  if (/\b(long|edge|extreme|boundary|boundaries|max(imum)?|unicode|stress)\b/.test(p)) return 'edge';
  return 'valid';
}

/**
 * A widget `transport` that never calls a server: values come from Faker.
 *
 *   init({ transport: fakerTransport() });
 *   init({ transport: fakerTransport({ faker: fakerForLocale, seed: 42 }) });
 */
export function fakerTransport(opts: FakerTransportOptions = {}) {
  return async (req: FillRequest): Promise<FillResponse> => {
    const faker = typeof opts.faker === 'function' ? opts.faker(req.locale) : opts.faker;
    const mode = opts.mode ?? modeFromPrompt(req.prompt);
    const { values } = fakeValues(req.fields, { ...opts, faker, mode });
    const where = req.locale && typeof opts.faker === 'function' ? ` (${req.locale})` : '';
    return { values, note: `Generated offline with Faker${where}, ${mode} mode.`, model: 'faker' };
  };
}
