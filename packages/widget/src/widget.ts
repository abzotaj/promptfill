import { LIMITS, type FieldValue, type FillResponse } from '@promptfill/core';
import { applyValues, restore, snapshot, type Snapshot } from './fill';
import { HOST_ATTR, scan, type ScanResult } from './scan';
import { styles } from './styles';
import { httpTransport, type HttpTransportOptions, type Transport } from './transport';

export interface Preset {
  /** Short title shown on the card. */
  label: string;
  /** The prompt sent when the card is clicked. */
  prompt: string;
  description?: string;
}

export interface PromptFillOptions extends Partial<HttpTransportOptions> {
  /** Custom transport. When set, endpoint/publishableKey/getAuthToken are ignored. */
  transport?: Transport;
  /** CSS selector for the form to fill. Defaults to auto-detect. */
  formSelector?: string;
  presets?: Preset[];
  position?: 'bottom-right' | 'bottom-left';
  theme?: 'dark' | 'light';
  /** Locale hint for generated data, e.g. "sq-AL". */
  locale?: string;
  /** Start with the panel open. */
  open?: boolean;
  /** Show a preview and require "Apply" (default true). False fills immediately. */
  confirm?: boolean;
  /** Keyboard shortcut to toggle the panel. Default "Alt+Shift+F". Pass "" to disable. */
  hotkey?: string;
  /** Title shown in the header. */
  title?: string;
  onFill?: (result: { filled: number; failed: string[]; values: Record<string, FieldValue> }) => void;
  onError?: (error: Error) => void;
}

export interface PromptFillInstance {
  open(): void;
  close(): void;
  toggle(): void;
  /** Re-scan the page (call after a form renders late). */
  rescan(): ScanResult;
  /** Run a prompt programmatically, e.g. from a test. */
  fill(prompt: string, opts?: { confirm?: boolean }): Promise<FillResponse>;
  undo(): void;
  destroy(): void;
}

const DEFAULT_PRESETS: Preset[] = [
  { label: 'Valid & realistic', prompt: 'Fill every field with realistic, valid data for a typical user.', description: 'Happy path' },
  { label: 'Edge cases', prompt: 'Fill with valid but extreme data: very long names with accents and apostrophes, max-length text, boundary numbers and dates.', description: 'Long, unicode, boundaries' },
  { label: 'Invalid input', prompt: 'Fill with plausible but invalid data that should fail validation: malformed email, wrong phone format, out-of-range numbers.', description: 'Test your validation' },
];

let active: PromptFillInstance | null = null;

export function init(options: PromptFillOptions): PromptFillInstance {
  if (typeof document === 'undefined') throw new Error('PromptFill.init must run in a browser.');
  // One widget per page; re-init replaces the old one (handy with HMR).
  active?.destroy();

  const transport =
    options.transport ??
    (options.endpoint
      ? httpTransport({
          endpoint: options.endpoint,
          publishableKey: options.publishableKey,
          getAuthToken: options.getAuthToken,
          timeoutMs: options.timeoutMs,
        })
      : null);
  if (!transport) throw new Error('PromptFill: pass `endpoint` (your PromptFill server URL) or a custom `transport`.');

  const confirmByDefault = options.confirm !== false;
  const presets = options.presets ?? DEFAULT_PRESETS;

  // ---- DOM ---------------------------------------------------------------
  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.append(style);

  const root = h('div', { class: 'pf', 'data-position': options.position ?? 'bottom-right', 'data-theme': options.theme ?? 'dark' });
  const hotkey = options.hotkey ?? 'Alt+Shift+F';

  const launcher = h('button', { class: 'launcher', type: 'button', 'aria-label': 'Open PromptFill' }, [
    h('span', { class: 'spark' }, '✦'),
    'Fill with AI',
    hotkey ? h('kbd', {}, prettyHotkey(hotkey)) : null,
  ]);

  const scopeTitle = h('b');
  const scopeSub = h('small');
  const rescanBtn = h('button', { class: 'link', type: 'button' }, 'Re-scan');
  const scope = h('div', { class: 'scope' }, [h('div', {}, [scopeTitle, scopeSub]), rescanBtn]);

  const presetList = h('div', { class: 'presets' },
    presets.map((p) => h('button', { class: 'preset', type: 'button', 'data-prompt': p.prompt }, [
      h('b', {}, p.label),
      p.description ? h('small', {}, p.description) : null,
    ])),
  );

  const promptBox = h('textarea', {
    class: 'prompt',
    placeholder: 'Describe the data, e.g. "a German business customer with a Swiss VAT number"',
    maxlength: String(LIMITS.maxPromptChars),
  }) as HTMLTextAreaElement;
  const generateBtn = h('button', { class: 'btn primary', type: 'button' }, 'Generate') as HTMLButtonElement;

  const previewWrap = h('div', { hidden: '' });
  const previewList = h('div', { class: 'preview' });
  const noteEl = h('div', { class: 'note' });
  const applyBtn = h('button', { class: 'btn primary', type: 'button' }, 'Apply') as HTMLButtonElement;
  const discardBtn = h('button', { class: 'btn', type: 'button' }, 'Discard');
  previewWrap.append(
    h('div', { class: 'label' }, 'Preview'),
    previewList,
    noteEl,
    h('div', { class: 'row', style: 'margin-top:8px' }, [h('div', { class: 'grow' }), discardBtn, applyBtn]),
  );

  const undoBtn = h('button', { class: 'link', type: 'button', hidden: '' }, 'Undo last fill');
  const statusEl = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });

  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close' }, '✕');
  const panel = h('div', { class: 'panel', hidden: '', role: 'dialog', 'aria-label': 'PromptFill' }, [
    h('div', { class: 'head' }, [
      h('div', { class: 'brand' }, [options.title ?? 'PromptFill', h('span', {}, 'Developers')]),
      h('div', { class: 'grow' }),
      closeBtn,
    ]),
    h('div', { class: 'body' }, [
      scope,
      presets.length ? h('div', {}, [h('div', { class: 'label' }, 'Presets'), presetList]) : null,
      h('div', {}, [
        h('div', { class: 'label' }, 'Prompt'),
        promptBox,
        h('div', { class: 'row', style: 'margin-top:8px' }, [
          h('div', { class: 'grow hint' }, isMac() ? '⌘ + Enter to generate' : 'Ctrl + Enter to generate'),
          generateBtn,
        ]),
      ]),
      previewWrap,
      undoBtn,
    ]),
    statusEl,
  ]);

  root.append(launcher, panel);
  shadow.append(root);
  document.body.append(host);

  // ---- state -------------------------------------------------------------
  let pending: { response: FillResponse; scan: ScanResult } | null = null;
  let lastSnapshot: Snapshot | null = null;
  let busy = false;
  doScan();

  function doScan(): ScanResult {
    const result = scan(document, { selector: options.formSelector });
    const n = result.fields.length;
    scopeTitle.textContent = result.heading ?? (result.root === document ? 'This page' : 'Form');
    scopeSub.textContent =
      `${n} fillable field${n === 1 ? '' : 's'}` +
      (result.skippedSensitive ? ` · ${result.skippedSensitive} sensitive skipped` : '');
    return result;
  }

  function setStatus(text: string, tone: '' | 'ok' | 'warn' | 'err' = '') {
    statusEl.className = `status ${tone}`.trim();
    statusEl.textContent = text;
  }

  function setBusy(b: boolean) {
    busy = b;
    generateBtn.disabled = b;
    presetList.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = b));
    generateBtn.replaceChildren(...(b ? [h('span', { class: 'spinner' }), 'Generating'] : ['Generate']));
  }

  function showPreview(response: FillResponse, scanResult: ScanResult) {
    pending = { response, scan: scanResult };
    previewList.replaceChildren(
      ...scanResult.fields
        .filter((f) => f.descriptor.key in response.values)
        .map((f) => {
          const v = response.values[f.descriptor.key];
          const box = h('input', { type: 'checkbox', checked: '', 'data-key': f.descriptor.key });
          return h('label', { class: 'item' }, [
            box,
            h('div', {}, [h('div', { class: 'k' }, f.descriptor.label), h('div', { class: 'v' }, display(v, f.descriptor.options))]),
          ]);
        }),
    );
    noteEl.textContent = response.note ?? '';
    previewWrap.hidden = false;
    previewWrap.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  function clearPreview() {
    pending = null;
    previewWrap.hidden = true;
    previewList.replaceChildren();
  }

  function apply(values: Record<string, FieldValue>, scanResult: ScanResult) {
    lastSnapshot = snapshot(scanResult.fields);
    const result = applyValues(scanResult.fields, values, { highlight: true });
    undoBtn.hidden = false;
    if (result.failed.length) setStatus(`Filled ${result.filled}. Couldn't fill: ${result.failed.join(', ')}`, 'warn');
    else setStatus(`Filled ${result.filled} field${result.filled === 1 ? '' : 's'}.`, 'ok');
    options.onFill?.({ ...result, values });
    return result;
  }

  async function run(prompt: string, confirm = confirmByDefault): Promise<FillResponse> {
    const text = prompt.trim();
    if (!text) {
      setStatus('Write a prompt or pick a preset.', 'warn');
      throw new Error('Empty prompt');
    }
    if (busy) throw new Error('A request is already running');

    const scanResult = doScan();
    if (!scanResult.fields.length) {
      setStatus('No fillable fields found on this page.', 'warn');
      throw new Error('No fields');
    }

    clearPreview();
    setBusy(true);
    setStatus(`Asking the model about ${scanResult.fields.length} fields…`);
    try {
      const response = await transport!({
        prompt: text.slice(0, LIMITS.maxPromptChars),
        fields: scanResult.fields.map((f) => f.descriptor),
        page: { title: document.title, url: location.origin + location.pathname, formHeading: scanResult.heading },
        locale: options.locale ?? navigator.language,
      });
      const count = Object.keys(response.values ?? {}).length;
      if (!count) {
        setStatus(response.note || 'The model returned no values.', 'warn');
      } else if (confirm) {
        showPreview(response, scanResult);
        setStatus(`${count} value${count === 1 ? '' : 's'} ready. Review, then Apply.`);
      } else {
        apply(response.values, scanResult);
      }
      return response;
    } catch (e) {
      const err = e as Error;
      setStatus(err.message || 'Something went wrong.', 'err');
      options.onError?.(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  // ---- events ------------------------------------------------------------
  const open = () => {
    launcher.hidden = true;
    panel.hidden = false;
    doScan();
    promptBox.focus();
  };
  const close = () => {
    panel.hidden = true;
    launcher.hidden = false;
  };
  const toggle = () => (panel.hidden ? open() : close());

  launcher.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  rescanBtn.addEventListener('click', () => {
    doScan();
    setStatus('Re-scanned.');
  });
  generateBtn.addEventListener('click', () => void run(promptBox.value).catch(() => {}));
  presetList.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest('button[data-prompt]');
    if (!btn) return;
    promptBox.value = btn.getAttribute('data-prompt') ?? '';
    void run(promptBox.value).catch(() => {});
  });
  promptBox.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      void run(promptBox.value).catch(() => {});
    }
    // Keep page-level shortcuts from firing while typing in the widget.
    ev.stopPropagation();
  });
  applyBtn.addEventListener('click', () => {
    if (!pending) return;
    const chosen = new Set(
      Array.from(previewList.querySelectorAll<HTMLInputElement>('input[data-key]'))
        .filter((b) => b.checked)
        .map((b) => b.dataset.key!),
    );
    const values = Object.fromEntries(Object.entries(pending.response.values).filter(([k]) => chosen.has(k)));
    apply(values, pending.scan);
    clearPreview();
  });
  discardBtn.addEventListener('click', () => {
    clearPreview();
    setStatus('Discarded.');
  });
  const undo = () => {
    if (!lastSnapshot) return;
    restore(lastSnapshot);
    lastSnapshot = null;
    undoBtn.hidden = true;
    setStatus('Restored previous values.');
  };
  undoBtn.addEventListener('click', undo);

  const onKey = (ev: KeyboardEvent) => {
    if (hotkey && matchesHotkey(ev, hotkey)) {
      ev.preventDefault();
      toggle();
    } else if (ev.key === 'Escape' && !panel.hidden && ev.composedPath().includes(host)) {
      close();
    }
  };
  document.addEventListener('keydown', onKey);

  if (options.open) open();

  const instance: PromptFillInstance = {
    open,
    close,
    toggle,
    rescan: doScan,
    fill: (prompt, o) => run(prompt, o?.confirm ?? false),
    undo,
    destroy() {
      document.removeEventListener('keydown', onKey);
      host.remove();
      if (active === instance) active = null;
    },
  };
  active = instance;
  return instance;
}

// ---- helpers ---------------------------------------------------------------

type Child = Node | string | null | undefined;

function h(tag: string, attrs: Record<string, string> = {}, children?: Child | Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) if (c !== null && c !== undefined) el.append(c);
  return el;
}

function display(v: FieldValue, options?: { value: string; label: string }[]): string {
  const label = (x: string) => options?.find((o) => o.value === x)?.label ?? x;
  if (typeof v === 'boolean') return v ? '✓ checked' : '☐ unchecked';
  if (Array.isArray(v)) return v.map(label).join(', ') || '(none)';
  return options ? label(String(v)) : String(v);
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}

function prettyHotkey(hk: string): string {
  return hk
    .split('+')
    .map((p) => (isMac() ? ({ Alt: '⌥', Shift: '⇧', Ctrl: '⌃', Meta: '⌘', Cmd: '⌘' } as Record<string, string>)[p] ?? p : p))
    .join(isMac() ? '' : '+');
}

function matchesHotkey(ev: KeyboardEvent, hk: string): boolean {
  const parts = hk.toLowerCase().split('+');
  const key = parts.pop();
  const want = (m: string) => parts.includes(m);
  return (
    ev.altKey === want('alt') &&
    ev.shiftKey === want('shift') &&
    ev.ctrlKey === want('ctrl') &&
    ev.metaKey === (want('meta') || want('cmd')) &&
    // ev.code is layout-independent (Alt changes ev.key on macOS).
    (ev.code.toLowerCase() === `key${key}` || ev.key.toLowerCase() === key)
  );
}
