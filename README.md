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

```
┌────────────── your page ──────────────┐
│  form fields ──scan──▶ widget (Shadow │      POST /v1/fill        ┌──────────────┐     tool use      ┌────────┐
│                         DOM, isolated)│ ───────────────────────▶ │  PromptFill  │ ────────────────▶ │ Claude │
│  form fields ◀─fill──  preview/apply  │ ◀─────────────────────── │   server     │ ◀──────────────── │  API   │
└───────────────────────────────────────┘   { values: {...} }      └──────────────┘  schema-locked    └────────┘
         ▲ extension: same widget, calls routed through its background worker
```

## Repo layout

```
packages/
  core/       shared types, JSON-schema builder, sensitive-field rules, validation
  widget/     the embeddable widget (ESM + CJS + a script-tag build)
  server/     Express API + framework-agnostic generateFill() for NestJS etc.
apps/
  extension/  Chrome extension (Manifest V3), reuses the widget
  demo/       Vite + React app with a fake login and two controlled forms
```

## Quick start (5 minutes)

Requires Node 20+.

```bash
npm install
npm run build

# 1. API server. With no key it runs in mock mode and returns fake data.
cp packages/server/.env.example packages/server/.env    # add ANTHROPIC_API_KEY for real generations
npm run dev:server                                       # http://localhost:8787

# 2. Demo app (in another terminal)
npm run dev:demo                                         # http://localhost:5173
```

Open the demo and **sign in as developer**. The ✦ *Fill with AI* button appears bottom-right; as *customer* it doesn't. Pick a preset or type a prompt, review, **Apply**, then **Complete order**. The *Submitted payload* panel shows React's state, which proves the values really landed.

### Load the extension

1. `npm run build -w @promptfill/extension`
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `apps/extension/dist`
3. The options page opens: keep `http://localhost:8787` and key `pk_ext`, click **Save**.
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

The instance has `open()`, `close()`, `toggle()`, `rescan()`, `fill(prompt)`, `undo()` and `destroy()`. `fill()` makes it usable from Playwright or Cypress:

```ts
// e.g. in your app: if (import.meta.env.DEV) window.promptfill = init({...})
await page.evaluate(() => window.promptfill.fill('A customer with an expired card date'));
```

Mark anything the widget should ignore with `data-promptfill-ignore`.

## Running the server

```bash
ANTHROPIC_API_KEY=sk-ant-... \
PROMPTFILL_SITES="pk_staging=https://*.staging.acme.com;pk_ext=chrome-extension://<your-extension-id>" \
npx promptfill-server
```

| Env var | |
|---|---|
| `ANTHROPIC_API_KEY` | Unset = mock mode |
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
- **The extension** asks for host access only to the server you configure, and gets page access per click through `activeTab`. In production, pin `PROMPTFILL_SITES` to your extension's ID instead of `chrome-extension://*`.

## Development

```bash
npm test            # vitest: core, widget (jsdom), server
npm run typecheck
npm run build
```

## Roadmap ideas

- Multi-step / wizard forms and forms inside iframes
- Adapters for custom components (MUI, Ant Design, react-select, date pickers)
- Saved per-site presets and a prompt history
- Streaming values into the form as they're generated
- Firefox build of the extension

## License

MIT
