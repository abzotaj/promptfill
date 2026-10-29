import { useEffect } from 'react';
import { init, type PromptFillOptions } from '@promptfill/widget';

/**
 * Mount the widget while `enabled` is true (e.g. a logged-in internal user)
 * and tear it down when it flips back. This is all the integration a React app needs.
 */
export function usePromptFill(enabled: boolean, options: PromptFillOptions) {
  useEffect(() => {
    if (!enabled) return;
    const widget = init(options);
    return () => widget.destroy();
    // Options are read once per mount; pass a stable object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
