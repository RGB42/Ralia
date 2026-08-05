import { createContext, useContext } from 'react';
import type { Outbox } from '@ralia/core';
import type { RuntimeConfig } from '@ralia/data';

/**
 * Was der Boot erarbeitet hat und der Rest der App braucht.
 *
 * Bisher behielt der `BootGate` beides für sich. Ab SP1 geht das nicht mehr: die
 * Anmeldung braucht `config`, um den Supabase-Client mit dem *Runtime*-Schlüssel
 * zu bauen — nicht mit dem eingebauten. Würde sie sich den Client selbst holen,
 * bevor `/config` geantwortet hat, liefe die ganze Sitzung auf dem
 * Bootstrap-Schlüssel.
 */
export interface BootValue {
  config: RuntimeConfig;
  outbox: Outbox;
}

export const BootContext = createContext<BootValue | null>(null);

export function useBoot(): BootValue {
  const value = useContext(BootContext);
  // Kein Rückfall auf `bootstrapConfig()`: das wäre genau der stille Fehler,
  // den dieser Context verhindern soll.
  if (!value) throw new Error('useBoot braucht einen fertigen BootGate im Baum');
  return value;
}
