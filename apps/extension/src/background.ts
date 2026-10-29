import type { FillResponse } from '@promptfill/core';
import { loadSettings, type Message, type MessageReply } from './settings';

// Toolbar click (or Alt+Shift+F): inject the widget into the current tab, or toggle it.
// activeTab grants access to the tab for this click only, so no "read all sites" permission.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !/^https?:|^file:/.test(tab.url)) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) {
    console.warn('[promptfill] could not inject into this page:', (e as Error).message);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

// The content script can't call the server itself: it runs under the page's CORS and CSP.
// The background worker can, as long as we have host permission for the server.
chrome.runtime.onMessage.addListener((msg: Message, _sender, reply: (r: MessageReply<unknown>) => void) => {
  if (msg.type === 'promptfill:settings') {
    loadSettings().then((s) => reply({ ok: true, data: s }));
    return true;
  }
  if (msg.type === 'promptfill:fill') {
    callServer(msg.request)
      .then((data) => reply({ ok: true, data }))
      .catch((e: Error & { code?: string }) => reply({ ok: false, error: e.message, code: e.code }));
    return true; // keep the channel open for the async reply
  }
  return false;
});

async function callServer(request: unknown): Promise<FillResponse> {
  const s = await loadSettings();
  const base = s.endpoint.replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/v1/fill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-promptfill-key': s.publishableKey },
      body: JSON.stringify(request),
    });
  } catch {
    const has = await chrome.permissions.contains({ origins: [`${new URL(base).origin}/*`] });
    throw Object.assign(
      new Error(has ? `Could not reach ${base}. Is the server running?` : `No permission for ${base}. Open PromptFill options and click Save.`),
      { code: 'upstream' },
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Server error (${res.status})`), { code: body.code });
  return body as FillResponse;
}
