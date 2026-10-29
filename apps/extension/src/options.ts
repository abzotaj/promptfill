import { loadSettings, saveSettings, type Settings } from './settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $<HTMLFormElement>('form');
const status = $<HTMLSpanElement>('status');

loadSettings().then((s) => {
  $<HTMLInputElement>('endpoint').value = s.endpoint;
  $<HTMLInputElement>('publishableKey').value = s.publishableKey;
  $<HTMLInputElement>('locale').value = s.locale;
  $<HTMLSelectElement>('theme').value = s.theme;
  $<HTMLInputElement>('confirm').checked = s.confirm;
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const settings: Settings = {
    endpoint: $<HTMLInputElement>('endpoint').value.trim().replace(/\/+$/, ''),
    publishableKey: $<HTMLInputElement>('publishableKey').value.trim(),
    locale: $<HTMLInputElement>('locale').value.trim(),
    theme: $<HTMLSelectElement>('theme').value as Settings['theme'],
    confirm: $<HTMLInputElement>('confirm').checked,
  };

  // The background worker needs host permission for the server to call it.
  // localhost is granted in the manifest; anything else is asked for here (requires a user click).
  let origin: string;
  try {
    origin = new URL(settings.endpoint).origin;
  } catch {
    status.textContent = 'That server URL is not valid.';
    return;
  }
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
  if (!granted) {
    status.textContent = `Saved, but without permission to reach ${origin} the extension can't call the server.`;
  }

  await saveSettings(settings);
  if (granted) status.textContent = 'Saved.';

  try {
    const res = await fetch(`${settings.endpoint}/health`);
    const body = await res.json();
    status.textContent += body.mock ? ' Server is up (mock mode).' : ' Server is up.';
  } catch {
    status.textContent += ` Couldn't reach ${settings.endpoint}/health.`;
  }
});
