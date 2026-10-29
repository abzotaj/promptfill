/**
 * Script-tag build. Exposes `window.PromptFill` and auto-initialises when the
 * tag carries a data-endpoint attribute:
 *
 *   <script src="promptfill.global.js" data-endpoint="https://fill.example.com"
 *           data-key="pk_demo" defer></script>
 */
import * as PromptFill from './index';

declare global {
  interface Window {
    PromptFill: typeof PromptFill;
  }
}

window.PromptFill = PromptFill;

const script = document.currentScript as HTMLScriptElement | null;
const endpoint = script?.dataset.endpoint;
if (endpoint) {
  const start = () =>
    PromptFill.init({
      endpoint,
      publishableKey: script?.dataset.key,
      formSelector: script?.dataset.form,
      theme: script?.dataset.theme === 'light' ? 'light' : 'dark',
      position: script?.dataset.position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
    });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
