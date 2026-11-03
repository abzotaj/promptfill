import { init, PromptFillError, type PromptFillInstance, type Transport } from '@promptfill/widget';
import { fakerTransport } from '@promptfill/faker';
import type { FillResponse } from '@promptfill/core';
import type { MessageReply, Settings } from './settings';

declare global {
  interface Window {
    __promptfill?: PromptFillInstance;
  }
}

// Injected on every toolbar click. Content scripts share one isolated world per
// extension, so the instance from an earlier click is still here: just toggle it.
(async () => {
  if (window.__promptfill) {
    window.__promptfill.toggle();
    return;
  }

  const settings = await send<Settings>({ type: 'promptfill:settings' });

  // Offline: Faker runs right here in the page, picking a generator per field from its
  // id / name / label / autocomplete. Server: the background worker calls your API.
  const transport: Transport =
    settings.source === 'offline'
      ? fakerTransport()
      : async (request) => send<FillResponse>({ type: 'promptfill:fill', request });

  window.__promptfill = init({
    transport,
    title: settings.source === 'offline' ? 'PromptFill · offline' : 'PromptFill',
    theme: settings.theme,
    locale: settings.locale || undefined,
    confirm: settings.confirm,
    // The extension owns the shortcut via chrome.commands, so the widget doesn't bind one.
    hotkey: '',
    open: true,
  });
})();

function send<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (reply: MessageReply<T> | undefined) => {
      if (chrome.runtime.lastError) return reject(new PromptFillError(chrome.runtime.lastError.message ?? 'Extension error'));
      if (!reply) return reject(new PromptFillError('No reply from the extension.'));
      if (reply.ok) resolve(reply.data);
      else reject(new PromptFillError(reply.error, reply.code as never));
    });
  });
}
