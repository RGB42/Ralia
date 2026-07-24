import { create } from 'zustand';

import type { FeatureKey } from '@/lib/premium';

interface UpgradeModalState {
  visible: boolean;
  featureKey: FeatureKey | null;
  open: (featureKey: FeatureKey) => void;
  close: () => void;
}

export const useUpgradeModalStore = create<UpgradeModalState>((set) => ({
  visible: false,
  featureKey: null,
  open: (featureKey) => set({ visible: true, featureKey }),
  close: () => set({ visible: false, featureKey: null }),
}));

/** requireProFeature() equivalent — guard clause for feature-gated actions outside a component. */
export function requireProFeature(hasPro: boolean, featureKey: FeatureKey): boolean {
  if (hasPro) return true;
  useUpgradeModalStore.getState().open(featureKey);
  return false;
}
