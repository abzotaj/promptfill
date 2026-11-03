import { useEffect } from 'react';
import { init, type PromptFillInstance, type PromptFillOptions } from '@promptfill/widget';

declare global {
  interface Window {
    /** Dev only: drive the widget from the console or Playwright, e.g. promptfill.fillData({ email: 'a@b.c' }). */
    promptfill?: PromptFillInstance;
  }
}

/**
 * Mount the widget while `enabled` is true (e.g. a logged-in internal user)
 * and tear it down when it flips back. This is all the integration a React app needs.
 */
export function usePromptFill(enabled: boolean, options: PromptFillOptions) {
  useEffect(() => {
    if (!enabled) return;
    const widget = init(options);
    if (import.meta.env.DEV) window.promptfill = widget;
    return () => {
      widget.destroy();
      if (window.promptfill === widget) delete window.promptfill;
    };
    // Options are read once per mount; pass a stable object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
