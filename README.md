# PromptFill

Fill any web form from a prompt. Think Stripe's test-mode "Magic fill", but for **your** forms and driven by an LLM:

> *"A purchasing manager at a mid-size company in Zurich, ordering for 12 people, express shipping"*

PromptFill scans the form, asks Claude for values constrained to the real fields and options, shows you a preview, and fills it in a way React, Vue and Angular actually notice.

It ships in two forms that share one engine:

| | Use it for | How it's loaded |
|---|---|---|
| **`@promptfill/widget`** (npm) | Your own apps. Show it to logged-in developers / QA only. | `init()` from your code, or one `<script>` tag |
| **Chrome extension** | Third-party sites you don't control. | Toolbar icon or `Alt+Shift+F` on any page |

Both talk to **`@promptfill/server`**, a small API that holds the Anthropic key. The browser never sees it.

There is also a fully **offline mode** built on [`@faker-js/faker`](https://www.npmjs.com/package/@faker-js/faker): **`@promptfill/faker`** looks at each field's id, name, label, placeholder, `autocomplete` token and input type, picks the matching Faker generator (first name, street address, postal code, IBAN-free VAT number, …) and fills the form with no server and no model. The extension uses it by default; the widget takes it as a `transport`; the server uses it for mock mode.

```
┌────────────── your page ──────────────┐
│  form fields ──scan──▶ widget (Shadow │      POST /v1/fill        ┌──────────────┐     tool use      ┌────────┐
│                         DOM, isolated)│ ───────────────────────▶ │  PromptFill  │ ────────────────▶ │ Claude │
│  form fields ◀─fill──  preview/apply  │ ◀─────────────────────── │   server     │ ◀──────────────── │  API   │
└───────────────────────────────────────┘   { values: {...} }      └──────────────┘  schema-locked    └────────┘
         ▲ extension: same widget, calls routed through its background worker
```

## Repo layout

An [Nx](https://nx.dev) monorepo on top of npm workspaces. Nx infers a target from every `package.json` script, orders builds by the dependency graph (`core → widget → extension`, …) and caches results.

```
packages/
  core/       @promptfill/core      shared types, JSON-schema builder, sensitive-field rules, validation
  faker/      @promptfill/faker     offline values via @faker-js/faker, generator inferred per field
  widget/     @promptfill/widget    the embeddable widget (ESM + CJS + a script-tag build)
  server/     @promptfill/server    Express API + framework-agnostic generateFill() for NestJS etc.
apps/
  extension/  @promptfill/extension Chrome extension (Manifest V3), reuses the widget
  demo/       @promptfill/demo      Vite + React app with a fake login and two controlled forms
nx.json                             target defaults, caching inputs/outputs
vitest.workspace.ts                 runs every package's own vitest.config.ts
```

```
core ──▶ widget ──▶ extension ◀── faker
  │         └─────▶ demo      ◀── faker
  └─────▶ server              ◀── faker
```

## Quick start (5 minutes)

Requires Node 20+.

```bash
npm install
npm run build

# 1. API server. With no key it runs in mock mode: values come from Faker, matched to each field.
cp packages/server/.env.example packages/server/.env    # add ANTHROPIC_API_KEY for real generations
npm run dev:server                                       # http://localhost:8787

# 2. Demo app (in another terminal)
npm run dev:demo                                         # http://localhost:5173
```

Open the demo and **sign in as developer**. The ✦ *Fill with AI* button appears bottom-right; as *customer* it doesn't. Pick a preset or type a prompt, review, **Apply**, then **Complete order**. The *Submitted payload* panel shows React's state, which proves the values really landed.

### Load the extension

1. `npx nx build @promptfill/extension`
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `apps/extension/dist`
3. The options page opens. **Data source** defaults to *Offline (Faker)*, which needs nothing else. Switch to *PromptFill server* and keep `http://localhost:8787` / `pk_ext` to use Claude.
4. On any page with a form, click the PromptFill icon (or press `Alt+Shift+F`).

## Using the widget in your app

```bash
npm install @promptfill/widget
```

```ts
import { init } from '@promptfill/widget';

// After login, and only for users who should have it:
if (user.isInternal) {
  const widget = init({
    endpoint: 'https://promptfill.your-company.com',
    publishableKey: 'pk_staging',
    getAuthToken: () => auth.getAccessToken(), // sent as Bearer; verify it server-side
    presets: [
      { label: 'Swiss B2B buyer', prompt: 'A company in Zurich with a valid CHE VAT number ordering 12 seats' },
    ],
  });
  // on logout: widget.destroy()
}
```

React (see `apps/demo/src/usePromptFill.ts`):

```tsx
usePromptFill(user?.role === 'developer', { endpoint, publishableKey, getAuthToken });
```

Or with no build step:

```html
<script src="https://unpkg.com/@promptfill/widget/dist/promptfill.global.js"
        data-endpoint="https://promptfill.your-company.com" data-key="pk_staging" defer></script>
```

### Options

| Option | Default | |
|---|---|---|
| `endpoint` | required* | PromptFill server URL |
| `publishableKey` | | Identifies the site; checked against allowed origins |
| `getAuthToken` | | Returns the user's token, sent as `Authorization: Bearer` |
| `transport` | | Replace the HTTP call entirely (*then `endpoint` isn't needed) |
| `formSelector` | auto | Which form to fill. Auto = focused form, else the biggest one |
| `presets` | 3 testing presets | Cards shown in the panel |
| `confirm` | `true` | Show a preview before filling |
| `locale` | browser language | Hint for names, addresses, phone formats |
| `theme` / `position` | `dark` / `bottom-right` | |
| `hotkey` | `Alt+Shift+F` | `''` to disable |
| `onFill` / `onError` | | Callbacks |

The instance has `open()`, `close()`, `toggle()`, `rescan()`, `fill(prompt)`, `fillData(data)`, `undo()` and `destroy()`. `fill()` and `fillData()` make it usable from Playwright or Cypress:

```ts
// e.g. in your app: if (import.meta.env.DEV) window.promptfill = init({...})
await page.evaluate(() => window.promptfill.fill('A customer with an expired card date'));
await page.evaluate(() => window.promptfill.fillData({ email: 'qa@example.com', Country: 'Albania', terms: true }));
```

Mark anything the widget should ignore with `data-promptfill-ignore`.

### Offline fill with Faker (no model, no server)

```bash
npm install @promptfill/widget @promptfill/faker
```

```ts
import { init } from '@promptfill/widget';
import { fakerTransport } from '@promptfill/faker';

init({ transport: fakerTransport() });                       // English data, random each time
init({ transport: fakerTransport({ seed: 42, mode: 'edge' }) }); // reproducible, boundary values
```

For localized data on the server or in Node, `fakerForLocale('de-CH')` builds a Faker with region → language → English fallbacks (it imports all 77 locales, so in the browser import the one you need from `@faker-js/faker/locale/<code>` and pass it as `faker`):

```ts
import { fakerForLocale } from '@promptfill/faker/locales';
init({ transport: fakerTransport({ faker: fakerForLocale }) }); // uses the widget's `locale`
```

How a generator is chosen for each field, in order:

1. **`autocomplete`** token: `given-name`, `family-name`, `email`, `tel`, `organization`, `street-address`, `address-line2`, `address-level2` (city), `postal-code`, `country`, `bday`, …
2. **Specific input types**: `email`, `tel`, `url`, `time`, `month`, `datetime-local`; `select`, `radio`, `multiselect` pick from their real options; checkboxes are ticked unless they look like a marketing opt-in.
3. **Keywords** in the id, name, label and placeholder, split on case and punctuation (`billingPostal_code` → *billing postal code*): first/last/full name, username, phone, company, job title, street, city, zip, state, country, website, birthday, age, gender, price/amount, quantity, VAT, promo code, order/invoice number, SKU, UUID, slug, IP, colour, lat/lng, title/subject, description/notes, date/time, …
4. **Constraints**: `min`/`max` for numbers and dates, `maxLength` (trimmed, or filled to the limit in edge mode), `pattern` via `faker.helpers.fromRegExp`.
5. Otherwise a couple of lorem words.

Names, email and username in one form agree with each other. `fakeValues(fields, opts)` returns the values plus, per field, which generator was used and why, which is useful when a field gets the wrong kind of data: give it an `autocomplete` attribute or a clearer `name`. Modes: `valid` (default), `invalid` (malformed email/phone/date, out-of-range numbers, consent unchecked) and `edge` (boundary numbers and dates, max-length text, names with accents and apostrophes). The transport infers the mode from the prompt, so the "Invalid input" and "Edge cases" presets still work offline.

In the demo, `VITE_PROMPTFILL_OFFLINE=1 npm run dev:demo` uses this transport instead of the server.

### Filling from data (no model)

`fillData()` fills a form from a plain object. Each key is matched to a field by, in order: **CSS selector**, **id**, **name**, scan key, **label**, **placeholder**, **aria-label**, **test id** (`data-testid`, `data-test`, `data-cy`, `data-qa`), **autocomplete** token, and finally a word-based fuzzy label match when it is unambiguous. Matching ignores case, spaces and punctuation, so `firstName`, `first_name` and `"First name"` are the same key.

```ts
import { fillData } from '@promptfill/widget';   // or widget.fillData(...) on an instance, or window.PromptFill.fillData

const result = fillData({
  firstName: 'Elira',                // name attribute
  '#email': 'elira@example.com',     // CSS selector
  'Phone number': '+355 69 000 0000',// label / placeholder
  'zip-input': '1000',               // data-testid
  'postal-code': '1000',             // autocomplete token
  Country: 'Switzerland',            // select: option label or value both work
  Languages: ['English', 'sq'],      // multi-select, mixed labels and values
  ship: 'Express',                   // radio group by name, option by label
  'ship-exp': true,                  // or a single radio by its id / label
  terms: 'yes',                      // checkbox: true/false, yes/no, on/off
});
// { filled: 9, failed: [], unmatched: [], matches: { firstName: { key: 'firstName', label: 'First name', by: 'name' }, … } }
```

Values go through the same React-safe setter and fire `input` / `change`. Options: `formSelector`, `by` (restrict or reorder strategies, e.g. `['id', 'name']`), `includeSensitive` (also fill password / card fields, off by default), `highlight`. On a widget instance, `fillData()` also records a snapshot so **Undo** works, and calls `onFill`.

`resolveField(scan, key)` and `coerceValue(field, value)` are exported if you want the matching without the filling.

## Running the server

```bash
ANTHROPIC_API_KEY=sk-ant-... \
PROMPTFILL_SITES="pk_staging=https://*.staging.acme.com;pk_ext=chrome-extension://<your-extension-id>" \
npx promptfill-server
```

| Env var | |
|---|---|
| `ANTHROPIC_API_KEY` | Unset = mock mode: values from `@promptfill/faker`, localized by the request's `locale` |
| `PROMPTFILL_MODEL` | Default `claude-sonnet-5-5`. A Haiku model is cheaper and fine for most forms |
| `PROMPTFILL_SITES` | `key=origin,origin;key2=origin`. Trailing `*` wildcards allowed |
| `PROMPTFILL_RATE_LIMIT` | Requests per minute per IP + key (default 20) |
| `PORT` | Default 8787 |

### Inside an existing NestJS / Express backend

The model call is a plain function, so you don't need the bundled server:

```ts
import { generateFill, parseFillRequest } from '@promptfill/server';

@Post('promptfill/v1/fill')
@UseGuards(JwtAuthGuard, InternalUserGuard)
async fill(@Body() body: unknown) {
  return generateFill(parseFillRequest(body), { apiKey: this.config.get('ANTHROPIC_API_KEY') });
}
```

For Express, `createFillHandler({ sites, authorize })` gives you the handler with CORS, rate limiting and an `authorize(req, { token })` hook.

## How it works

- **Scan.** Collects visible, enabled inputs, selects, textareas, checkboxes and radio groups. Labels come from `<label>`, `aria-labelledby`, `aria-label`, placeholder or name, in that order. Only labels, types and constraints are sent, never current values.
- **Generate.** The server turns the fields into a JSON schema (keys = fields, `enum` = real options, `min`/`max`/`maxLength`) and forces Claude to call a `fill_form` tool with it. The model can't invent fields or options, and its answer is validated again before it's returned.
- **Fill.** React tracks each input's last value, so `el.value = x` is silently ignored. PromptFill calls the native prototype setter and dispatches `input` / `change`, and toggles checkboxes and radios with `click()`. Previous values are snapshotted for **Undo**.
- **Isolation.** The UI lives in a Shadow DOM, so your CSS can't break it and its CSS can't leak.

## Security

- **Sensitive fields are never read or filled:** passwords, card fields, CVC, IBAN, SSN, national ID, OTP, API keys and tokens. Detection uses `type`, `autocomplete`, name and label, in the widget *and* again on the server.
- **The API key stays on the server.** The publishable key is not a secret: the server only honours it from the origins you list.
- **Gate who gets the widget** in your app (role, feature flag, non-production env), and verify `getAuthToken()` in `authorize`.
- **Prompt injection.** Field labels and page titles are untrusted text. They're passed as data, the system prompt says so, and the schema limits what the model can return either way.
- **The extension** asks for host access only to the server you configure, and gets page access per click through `activeTab`. In production, pin `PROMPTFILL_SITES` to your extension's ID instead of `chrome-extension://*`. In offline mode it makes no network requests at all.

## Development

Everything goes through Nx. Root scripts are thin wrappers:

```bash
npm run build          # nx run-many -t build      (dependency order, cached)
npm test               # nx run-many -t test       (vitest per package; widget runs in jsdom)
npm run typecheck      # nx run-many -t typecheck  (tsc per project)
npm run dev:server     # nx dev @promptfill/server
npm run dev:demo       # nx dev @promptfill/demo
npm run affected       # only what changed vs. main: build, typecheck, test
npm run graph          # open the project graph in the browser
```

Target a single project with `npx nx <target> <project>`, e.g. `npx nx test @promptfill/widget`, or list what's available with `npx nx show project @promptfill/widget`. Outputs live in each project's `dist/`; the Nx cache is in `.nx/` (git-ignored). Add `--skip-nx-cache` to force a rerun.

Adding a project: create it under `packages/` or `apps/`, add it to the `workspaces` list in the root `package.json`, give it `build` / `test` / `typecheck` scripts, and Nx picks it up. Declare cross-package imports as (dev)dependencies so the graph knows the build order.

## Roadmap ideas

- Multi-step / wizard forms and forms inside iframes
- Adapters for custom components (MUI, Ant Design, react-select, date pickers)
- Saved per-site presets and a prompt history
- Streaming values into the form as they're generated
- Firefox build of the extension

## License

MIT
