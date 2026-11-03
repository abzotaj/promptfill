import { Faker, allLocales, type LocaleDefinition } from '@faker-js/faker';

/**
 * Build a Faker for a BCP 47 tag like "de-CH", "sq-AL" or "en". Falls back
 * from region to language to English, so names, cities and phone numbers
 * look right for the user's locale. Imports every locale, so use it on the
 * server or where bundle size doesn't matter; in the browser prefer importing
 * the one locale you need from "@faker-js/faker/locale/<code>".
 */
export function fakerForLocale(tag?: string): Faker {
  const key = (tag ?? 'en').trim().replace('-', '_');
  const lang = key.split('_')[0].toLowerCase();
  const all = allLocales as Record<string, LocaleDefinition>;
  const chain = [all[key], all[`${lang}_${key.split('_')[1]?.toUpperCase() ?? ''}`], all[lang], all.en, all.base].filter(
    (l, i, arr): l is LocaleDefinition => !!l && arr.indexOf(l) === i,
  );
  const faker = new Faker({ locale: chain });
  return faker;
}

/** Locale codes Faker ships, e.g. ["af_ZA", "ar", ..., "zh_TW"]. */
export const availableLocales = Object.keys(allLocales).filter((k) => k !== 'base');
