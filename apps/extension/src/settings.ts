export interface Settings {
  endpoint: string;
  publishableKey: string;
  locale: string;
  theme: 'dark' | 'light';
  confirm: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  endpoint: 'http://localhost:8787',
  publishableKey: 'pk_ext',
  locale: '',
  theme: 'dark',
  confirm: true,
};

export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as Settings;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.sync.set(s);
}

/** Messages between the content script and the background worker. */
export type Message =
  | { type: 'promptfill:fill'; request: import('@promptfill/core').FillRequest }
  | { type: 'promptfill:settings' };

export type MessageReply<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
