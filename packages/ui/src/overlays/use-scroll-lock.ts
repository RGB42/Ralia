import { useEffect } from 'react';

/**
 * Sperrt das Scrollen des Dokuments, solange ein Overlay offen ist.
 *
 * Merkt sich den vorherigen Wert statt blind zurueckzusetzen: bei zwei
 * gestapelten Sheets darf das innere beim Schlieszen nicht das aeuszere entsperren.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
