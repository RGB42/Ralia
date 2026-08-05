import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';

/** Vorlage Z. 1189–1196: 480 ms Schwelle. */
export const LONG_PRESS_MS = 480;

/**
 * Langes Druecken als Zweitaktion auf derselben Flaeche.
 *
 * Erweiterung gegenueber der Vorlage: nach dem Ausloesen wird der folgende
 * `click` unterdrueckt. Sonst faehrt dieselbe Geste zusaetzlich die
 * Kurzaktion — ein langes Druecken zum Bearbeiten wuerde den Eintrag auch
 * abhaken.
 */
export function useLongPress(onLongPress: () => void, delayMs = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const handler = useRef(onLongPress);
  handler.current = onLongPress;

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        handler.current();
      }, delayMs);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onClickCapture: (event: MouseEvent) => {
      if (fired.current) {
        event.preventDefault();
        event.stopPropagation();
        fired.current = false;
      }
    },
  };
}
