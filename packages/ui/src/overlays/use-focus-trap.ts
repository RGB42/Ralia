import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Bewusst ohne Layout-Abfrage. `offsetParent === null` waere der uebliche
 * Sichtbarkeitstest, ist in jsdom aber immer wahr — jsdom rechnet kein Layout.
 * Die Falle wuerde in Tests still auf „kein fokussierbares Kind" fallen und
 * ihre eigenen Tests grundlos bestehen. Geprueft wird deshalb nur, was
 * ausdruecklich im Markup steht.
 */
function isHidden(el: HTMLElement): boolean {
  if (el.closest('[hidden],[aria-hidden="true"]') !== null) return true;
  return el.style.display === 'none' || el.style.visibility === 'hidden';
}

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !isHidden(el) || el === document.activeElement,
  );
}

/**
 * Haelt den Tastaturfokus in einem Overlay und gibt ihn beim Schlieszen zurueck.
 *
 * Die Vorlage hat das nicht: dort bleibt alles hinter dem Backdrop per Tab
 * erreichbar. Fuer einen modalen Dialog ist das ein Fehler.
 */
export function useFocusTrap(active: boolean): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const first = focusable(container)[0];
    (first ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      const activeEl = document.activeElement;

      if (event.shiftKey && (activeEl === firstItem || activeEl === container)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && activeEl === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      restoreTo.current?.focus();
    };
  }, [active]);

  return ref;
}
