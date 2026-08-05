import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Misst die Hoehe eines Elements laufend.
 *
 * Ersetzt die Prototyp-Rechnung der Vorlage, die aus `window.innerHeight - 90`
 * auf die Rasterhoehe schloss — die 90 px waren deren eigene Kopfleiste.
 */
export function useElementHeight(): [(node: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    if (typeof ResizeObserver !== 'function') {
      setHeight(node.getBoundingClientRect().height);
      return;
    }
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, height];
}
