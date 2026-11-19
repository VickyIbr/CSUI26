import { useEffect, useRef } from 'react';

type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  const mapRef = useRef(shortcuts);

  useEffect(() => {
    mapRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      const handler = mapRef.current[key];
      if (!handler) return;
      if (isTyping(event.target) && key !== 'Escape') return;
      handler(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
