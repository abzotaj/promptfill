import { faker as defaultFaker, type Faker } from '@faker-js/faker';
import { sanitizeValues, type FieldDescriptor, type FieldValue } from '@promptfill/core';
import { infer, wordsOf, type Generator, type Inference } from './infer';

export type FakeMode = 'valid' | 'invalid' | 'edge';

export interface FakeOptions {
  /** A Faker instance, e.g. one built for another locale. Defaults to Faker's English instance. */
  faker?: Faker;
  /** Seed for reproducible output (same fields + seed = same values). */
  seed?: number;
  /**
   * valid   realistic data that should pass validation (default)
   * invalid plausible but wrong data, to exercise validation
   * edge    valid but extreme: max-length text, boundary numbers and dates, tricky names
   */
  mode?: FakeMode;
  /** Chance that an optional checkbox like "subscribe to newsletter" is ticked. Default 0.3. */
  optInRate?: number;
}

export interface FakeResult {
  values: Record<string, FieldValue>;
  /** Field key -> which generator was used and why. Handy for debugging a form. */
  inferences: Record<string, Inference>;
}

/**
 * Generate a value for every field using Faker. The generator for each field is
 * chosen from its autocomplete token, id, name, label, placeholder and input type.
 */
export function fakeValues(fields: FieldDescriptor[], opts: FakeOptions = {}): FakeResult {
  const faker = opts.faker ?? defaultFaker;
  if (opts.seed !== undefined) faker.seed(opts.seed);
  const ctx = new Context(faker, opts.mode ?? 'valid', opts.optInRate ?? 0.3);

  const raw: Record<string, unknown> = {};
  const inferences: Record<string, Inference> = {};
  for (const f of fields) {
    const inf = infer(f);
    inferences[f.key] = inf;
    const v = ctx.generate(f, inf.generator);
    if (v !== undefined) raw[f.key] = v;
  }
  return { values: sanitizeValues(fields, raw), inferences };
}

/** Shared across one form so that name, email and username agree with each other. */
class Context {
  private person?: { firstName: string; lastName: string; sex: 'male' | 'female' | 'generic' };

  constructor(
    readonly faker: Faker,
    readonly mode: FakeMode,
    readonly optInRate: number,
  ) {}

  private who(): NonNullable<Context['person']> {
    if (this.person) return this.person;
    const sex = this.faker.person.sexType();
    const person =
      this.mode === 'edge'
        ? { firstName: this.faker.helpers.arrayElement(EDGE_FIRST), lastName: this.faker.helpers.arrayElement(EDGE_LAST), sex }
        : { firstName: this.faker.person.firstName(sex), lastName: this.faker.person.lastName(sex), sex };
    this.person = person;
    return person;
  }

  generate(f: FieldDescriptor, g: Generator): unknown {
    const value = this.raw(f, g);
    return typeof value === 'string' ? this.fit(f, g, value) : value;
  }

  /** Respect maxLength: trim, or for edge mode fill right up to it. */
  private fit(f: FieldDescriptor, g: Generator, s: string): string {
    const max = f.maxLength && f.maxLength > 0 ? f.maxLength : undefined;
    if (this.mode === 'edge' && max && TEXTY.has(g)) {
      const filler = this.faker.lorem.paragraphs(3).replace(/\s+/g, ' ');
      return (s + ' ' + filler).slice(0, max).trimEnd();
    }
    if (max && s.length > max) {
      // Emails and URLs can't just be cut; regenerate short ones.
      if (g === 'email') return `${this.faker.string.alpha(3).toLowerCase()}@x.io`.slice(0, max);
      if (g === 'url') return 'https://x.io'.slice(0, max);
      return s.slice(0, max).trimEnd();
    }
    return s;
  }

  private raw(f: FieldDescriptor, g: Generator): unknown {
    const { faker: fk, mode } = this;
    const invalid = mode === 'invalid';
    const edge = mode === 'edge';
    const words = wordsOf(f.name, f.id, f.key, f.label, f.placeholder);

    switch (g) {
      case 'firstName':
        return this.who().firstName;
      case 'lastName':
        return this.who().lastName;
      case 'middleName':
        return fk.person.middleName(this.who().sex);
      case 'fullName':
        return `${this.who().firstName} ${this.who().lastName}`;
      case 'prefix':
        return fk.person.prefix(this.who().sex);
      case 'username':
        return invalid ? 'no spaces allowed' : fk.internet.username({ firstName: this.who().firstName, lastName: this.who().lastName });
      case 'email': {
        const { firstName, lastName } = this.who();
        if (invalid) return `${firstName}.${lastName}@@example`.toLowerCase();
        return fk.internet.email({ firstName, lastName, provider: edge ? 'sub.domain.example-mail.co.uk' : undefined }).toLowerCase();
      }
      case 'phone':
        return invalid ? '12-34' : fk.phone.number({ style: edge ? 'international' : 'human' });
      case 'phoneCountryCode':
        return f.kind === 'number' ? fk.number.int({ min: 1, max: 998 }) : `+${fk.number.int({ min: 1, max: 998 })}`;
      case 'company':
        return fk.company.name() + (edge ? ' & Söhne GmbH & Co. KG' : '');
      case 'jobTitle':
        return fk.person.jobTitle();
      case 'department':
        return fk.commerce.department();
      case 'streetAddress':
        return fk.location.streetAddress();
      case 'secondaryAddress':
        return fk.location.secondaryAddress();
      case 'city':
        return fk.location.city();
      case 'state':
        return fk.location.state();
      case 'zip':
        if (invalid) return 'ABCDE';
        return f.kind === 'number' ? fk.number.int({ min: 1000, max: 99999 }) : fk.location.zipCode();
      case 'country':
        return fk.location.country();
      case 'countryCode':
        return fk.location.countryCode('alpha-2');
      case 'url':
        return invalid ? 'not a url' : fk.internet.url();
      case 'domain':
        return fk.internet.domainName();
      case 'ip':
        return invalid ? '999.1.1' : fk.internet.ipv4();
      case 'birthdate': {
        if (invalid) return f.kind === 'date' ? '2024-13-45' : '31/02/1990';
        const d = fk.date.birthdate(edge ? { mode: 'age', min: 100, max: 110 } : { mode: 'age', min: 18, max: 75 });
        return f.kind === 'date' ? iso(d) : f.kind === 'datetime-local' ? isoMinutes(d) : iso(d);
      }
      case 'age':
        return invalid ? this.outOfRange(f) : this.int(f, edge ? { min: 0, max: 120, edge: true } : { min: 18, max: 75 });
      case 'sex':
        return fk.person.sex();
      case 'language':
        return fk.helpers.arrayElement(['English', 'German', 'French', 'Italian', 'Albanian', 'Spanish']);
      case 'amount':
        return invalid ? this.outOfRange(f) : this.number(f, { min: 1, max: 5000, dec: f.kind === 'number' ? 0 : 2 });
      case 'currencyCode':
        return fk.finance.currencyCode();
      case 'quantity':
        return invalid ? this.outOfRange(f) : this.int(f, { min: 1, max: 12, edge });
      case 'vatNumber':
        return invalid ? 'VAT' : `${fk.location.countryCode('alpha-2')}${fk.string.numeric(9)}`;
      case 'promoCode':
        return fk.string.alpha({ length: 6, casing: 'upper' }) + fk.string.numeric(2);
      case 'reference':
        return fk.string.alphanumeric({ length: 10, casing: 'upper' });
      case 'productName':
        return fk.commerce.productName();
      case 'sku':
        return fk.string.alphanumeric({ length: 8, casing: 'upper' });
      case 'uuid':
        return invalid ? 'not-a-uuid' : fk.string.uuid();
      case 'slug':
        return fk.helpers.slugify(fk.lorem.words(3)).toLowerCase();
      case 'color':
        return /\bhex\b|#/.test(words) ? fk.color.rgb({ format: 'hex' }) : fk.color.human();
      case 'latitude':
        return f.kind === 'number' ? fk.location.latitude() : String(fk.location.latitude());
      case 'longitude':
        return f.kind === 'number' ? fk.location.longitude() : String(fk.location.longitude());
      case 'title':
        return capitalize(fk.lorem.words(edge ? 12 : 4));
      case 'paragraph':
        return edge ? fk.lorem.paragraphs(3) : fk.lorem.sentences(2);
      case 'words':
        return fk.lorem.words(2);
      case 'year':
        return f.kind === 'number' ? this.int(f, { min: 1950, max: 2030, edge }) : String(fk.date.past({ years: 30 }).getFullYear());
      case 'month':
        if (f.kind === 'month') return isoMonth(this.date(f));
        return f.kind === 'number' ? this.int(f, { min: 1, max: 12, edge }) : fk.date.month();
      case 'date':
        if (invalid) return f.kind === 'date' ? '2024-13-45' : 'yesterday-ish';
        return iso(this.date(f));
      case 'time':
        return invalid ? '25:61' : `${pad(fk.number.int({ min: 7, max: 19 }))}:${fk.helpers.arrayElement(['00', '15', '30', '45'])}`;
      case 'datetime':
        return invalid ? '2024-13-45T25:00' : isoMinutes(this.date(f));
      case 'number':
        return invalid ? this.outOfRange(f) : this.number(f, { min: 1, max: 100, dec: 0 });
      case 'option': {
        const opts = (f.options ?? []).filter((o) => o.value !== '');
        return opts.length ? fk.helpers.arrayElement(opts).value : undefined;
      }
      case 'options': {
        const opts = (f.options ?? []).filter((o) => o.value !== '');
        if (!opts.length) return [];
        const n = edge ? opts.length : Math.min(opts.length, fk.number.int({ min: 1, max: 3 }));
        return fk.helpers.arrayElements(opts, n).map((o) => o.value);
      }
      case 'checkbox':
        // Consent-style boxes get ticked (forms usually need them); marketing opt-ins mostly not.
        if (/\b(newsletter|marketing|subscribe|promotions?|offers|updates|sms|remember)\b/.test(words)) {
          return fk.datatype.boolean({ probability: this.optInRate });
        }
        return invalid && /\b(terms|agree|accept|consent|privacy|policy)\b/.test(words) ? false : true;
      case 'pattern':
        try {
          return fk.helpers.fromRegExp(f.pattern!);
        } catch {
          return fk.lorem.word();
        }
      case 'text':
        return capitalize(fk.lorem.words(2));
    }
  }

  private int(f: FieldDescriptor, o: { min: number; max: number; edge?: boolean }): number {
    const min = num(f.min) ?? o.min;
    const max = num(f.max) ?? o.max;
    if (o.edge) return this.faker.helpers.arrayElement([min, max]);
    return this.faker.number.int({ min: Math.min(min, max), max: Math.max(min, max) });
  }

  private number(f: FieldDescriptor, o: { min: number; max: number; dec: number }): number {
    const min = num(f.min) ?? o.min;
    const max = num(f.max) ?? o.max;
    if (this.mode === 'edge') return this.faker.helpers.arrayElement([min, max]);
    return this.faker.number.float({ min: Math.min(min, max), max: Math.max(min, max), fractionDigits: o.dec });
  }

  private outOfRange(f: FieldDescriptor): number {
    const max = num(f.max);
    const min = num(f.min);
    if (max !== undefined) return max + 1;
    if (min !== undefined) return min - 1;
    return -1;
  }

  /** A date inside min/max when given, else around now; edge mode sits on the bounds. */
  private date(f: FieldDescriptor): Date {
    const fk = this.faker;
    const min = f.min ? new Date(f.min) : undefined;
    const max = f.max ? new Date(f.max) : undefined;
    const ok = (d?: Date): d is Date => !!d && !Number.isNaN(d.getTime());
    if (this.mode === 'edge') {
      if (ok(min) && ok(max)) return fk.helpers.arrayElement([min, max]);
      if (ok(min)) return min;
      if (ok(max)) return max;
    }
    if (ok(min) && ok(max)) return fk.date.between({ from: min, to: max });
    if (ok(min)) return fk.date.between({ from: min, to: new Date(min.getTime() + 365 * 864e5) });
    if (ok(max)) return fk.date.between({ from: new Date(max.getTime() - 365 * 864e5), to: max });
    return fk.date.soon({ days: 60 });
  }
}

const TEXTY = new Set<Generator>(['text', 'words', 'title', 'paragraph', 'fullName', 'firstName', 'lastName', 'company', 'streetAddress', 'city']);

const EDGE_FIRST = ['Maximiliana-Krystyna', "D'Arcy", 'Zoë-Anaïs', 'Łukasz', 'Jean-Baptiste', 'Nguyễn Thị', 'Søren'];
const EDGE_LAST = ["O'Connor-Wójcik de la Fuente", 'van der Berg-Ólafsdóttir', 'Nakamura-Müller', 'Çela', 'St. John-Smythe'];

const num = (s?: string) => (s !== undefined && s !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined);
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoMonth = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const isoMinutes = (d: Date) => `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
