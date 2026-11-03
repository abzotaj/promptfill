import type { FieldDescriptor } from '@promptfill/core';

/** What kind of data a field wants, inferred from its id, name, label, autocomplete and type. */
export type Generator =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'fullName'
  | 'prefix'
  | 'username'
  | 'email'
  | 'phone'
  | 'phoneCountryCode'
  | 'company'
  | 'jobTitle'
  | 'department'
  | 'streetAddress'
  | 'secondaryAddress'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  | 'countryCode'
  | 'url'
  | 'domain'
  | 'ip'
  | 'birthdate'
  | 'age'
  | 'sex'
  | 'language'
  | 'amount'
  | 'currencyCode'
  | 'quantity'
  | 'vatNumber'
  | 'promoCode'
  | 'reference'
  | 'productName'
  | 'sku'
  | 'uuid'
  | 'slug'
  | 'color'
  | 'latitude'
  | 'longitude'
  | 'title'
  | 'paragraph'
  | 'words'
  | 'year'
  | 'month'
  | 'date'
  | 'time'
  | 'datetime'
  | 'number'
  | 'option'
  | 'options'
  | 'checkbox'
  | 'pattern'
  | 'text';

/** Autocomplete tokens are the most reliable hint a page can give. */
const AUTOCOMPLETE: Record<string, Generator> = {
  'given-name': 'firstName',
  'additional-name': 'middleName',
  'family-name': 'lastName',
  name: 'fullName',
  'honorific-prefix': 'prefix',
  nickname: 'username',
  username: 'username',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'tel-local': 'phone',
  'tel-country-code': 'phoneCountryCode',
  organization: 'company',
  'organization-title': 'jobTitle',
  'street-address': 'streetAddress',
  'address-line1': 'streetAddress',
  'address-line2': 'secondaryAddress',
  'address-line3': 'secondaryAddress',
  'address-level1': 'state',
  'address-level2': 'city',
  'address-level3': 'city',
  'postal-code': 'zip',
  country: 'countryCode',
  'country-name': 'country',
  bday: 'birthdate',
  'bday-year': 'year',
  'bday-month': 'month',
  sex: 'sex',
  url: 'url',
  language: 'language',
  'transaction-currency': 'currencyCode',
  'transaction-amount': 'amount',
  impp: 'url',
};

/**
 * Keyword rules, most specific first. They run against the field's words
 * (name, id, key, label, placeholder), split on case and punctuation.
 */
const RULES: [RegExp, Generator][] = [
  [/\be ?mail\b/, 'email'],
  [/\b(first|given|fore) ?name\b|\bfname\b|\bvorname\b|\bprenom\b|\bemri\b/, 'firstName'],
  [/\b(last|family|sur) ?name\b|\blname\b|\bnachname\b|\bmbiemri\b/, 'lastName'],
  [/\bmiddle ?name\b/, 'middleName'],
  [/\b(user ?name|login|handle|nick ?name)\b/, 'username'],
  [/\b(phone|tel|telephone|mobile|cell|fax|whatsapp)\b/, 'phone'],
  [/\b(company|organi[sz]ation|employer|business|firm)\b/, 'company'],
  [/\b(job|position|occupation|profession)\b|\bjob ?title\b/, 'jobTitle'],
  [/\b(department|team|category)\b/, 'department'],
  [/\b(vat|ust|tva|mwst)\b/, 'vatNumber'],
  [/\b(promo|coupon|voucher|discount|referral) ?(code)?\b/, 'promoCode'],
  [/\b(order|invoice|reference|ref|tracking|booking|ticket) ?(number|no|num|id)?\b/, 'reference'],
  [/\b(sku|part ?number|article ?number)\b/, 'sku'],
  [/\b(product|item)\b/, 'productName'],
  [/\b(uuid|guid)\b/, 'uuid'],
  [/\bslug\b/, 'slug'],
  [/\b(ip|ip ?address)\b/, 'ip'],
  [/\b(domain|hostname)\b/, 'domain'],
  [/\b(web ?site|url|homepage|home ?page|link|linkedin|github|twitter|portfolio)\b/, 'url'],
  [/\b(street|address ?(line)? ?1|addr|address|strasse|rruga)\b/, 'streetAddress'],
  [/\b(address ?(line)? ?[23]|apartment|apt|suite|unit|floor|building)\b/, 'secondaryAddress'],
  [/\b(city|town|locality|ort|qyteti)\b/, 'city'],
  [/\b(zip|postal|post ?code|postcode|plz)\b/, 'zip'],
  [/\b(state|region|province|county|canton|kanton)\b/, 'state'],
  [/\bcountry ?code\b/, 'countryCode'],
  [/\b(country|land|shteti)\b/, 'country'],
  [/\b(birth ?(day|date)?|dob|born|geburtstag|datelindja)\b/, 'birthdate'],
  [/\bage\b/, 'age'],
  [/\b(gender|sex)\b/, 'sex'],
  [/\b(language|lang)\b/, 'language'],
  [/\bcurrency\b/, 'currencyCode'],
  [/\b(price|amount|total|cost|salary|budget|fee|balance|revenue|income)\b/, 'amount'],
  [/\b(quantity|qty|count|seats|people|guests|persons|units|employees|headcount|rooms|nights)\b/, 'quantity'],
  [/\b(colou?r)\b/, 'color'],
  [/\b(lat|latitude)\b/, 'latitude'],
  [/\b(lng|lon|long|longitude)\b/, 'longitude'],
  [/\b(full|display|contact|customer|user|patient|account|your|cardholder|recipient|legal)? ?name\b/, 'fullName'],
  [/\b(description|comment|comments|notes?|message|bio|about|remarks|feedback|summary|details|reason|instructions)\b/, 'paragraph'],
  [/\b(subject|headline|heading|title)\b/, 'title'],
  [/\byear\b/, 'year'],
  [/\bmonth\b/, 'month'],
  [/\b(date|day|deadline|expir(y|es|ation)|start|end|until|from|to)\b/, 'date'],
  [/\btime\b/, 'time'],
  [/\b(search|query|keyword|keywords|tags?)\b/, 'words'],
];

export interface Inference {
  generator: Generator;
  /** What decided it: the autocomplete token, the matching rule, or the field kind. */
  reason: 'autocomplete' | 'keyword' | 'kind';
}

/** Split identifiers and labels into lowercase words: "billingPostal_code" -> "billing postal code". */
export function wordsOf(...parts: (string | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function infer(f: FieldDescriptor): Inference {
  // Choice fields are decided by their options, whatever they are called.
  if (f.kind === 'select' || f.kind === 'radio') return { generator: 'option', reason: 'kind' };
  if (f.kind === 'multiselect') return { generator: 'options', reason: 'kind' };
  if (f.kind === 'checkbox') return { generator: 'checkbox', reason: 'kind' };

  for (const token of (f.autocomplete ?? '').toLowerCase().split(/\s+/)) {
    const g = AUTOCOMPLETE[token];
    if (g) return { generator: g, reason: 'autocomplete' };
  }

  // Typed inputs with no better hint: the type is already specific.
  if (f.kind === 'email') return { generator: 'email', reason: 'kind' };
  if (f.kind === 'tel') return { generator: 'phone', reason: 'kind' };
  if (f.kind === 'url') return { generator: 'url', reason: 'kind' };
  if (f.kind === 'time') return { generator: 'time', reason: 'kind' };
  if (f.kind === 'month') return { generator: 'month', reason: 'kind' };
  if (f.kind === 'datetime-local') return { generator: 'datetime', reason: 'kind' };

  const words = wordsOf(f.name, f.id, f.key, f.label, f.placeholder);
  for (const [re, g] of RULES) {
    if (!re.test(words)) continue;
    // A keyword can't override the input type: "age" on a date input is still a date.
    if (f.kind === 'date') return { generator: g === 'birthdate' ? 'birthdate' : 'date', reason: 'keyword' };
    if (f.kind === 'number') {
      const numeric: Generator[] = ['age', 'amount', 'quantity', 'year', 'month', 'zip', 'latitude', 'longitude', 'phoneCountryCode'];
      return numeric.includes(g) ? { generator: g, reason: 'keyword' } : { generator: 'number', reason: 'kind' };
    }
    return { generator: g, reason: 'keyword' };
  }

  if (f.kind === 'date') return { generator: 'date', reason: 'kind' };
  if (f.kind === 'number') return { generator: 'number', reason: 'kind' };
  if (f.kind === 'textarea') return { generator: 'paragraph', reason: 'kind' };
  if (f.pattern) return { generator: 'pattern', reason: 'kind' };
  return { generator: 'text', reason: 'kind' };
}
