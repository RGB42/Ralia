import { create } from 'zustand';

export type ToastKind = 'default' | 'error' | 'success';

interface ToastState {
  message: string | null;
  kind: ToastKind;
  show: (message: string, kind?: ToastKind) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  kind: 'default',
  show: (message, kind = 'default') => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, kind });
    hideTimer = setTimeout(() => set({ message: null }), 3000);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));

/** Convenience for non-component code (data hooks, lib helpers). */
export const toast = {
  show: (message: string) => useToastStore.getState().show(message, 'default'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
  success: (message: string) => useToastStore.getState().show(message, 'success'),
};
