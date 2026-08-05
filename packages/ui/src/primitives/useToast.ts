import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from './ToastProvider.js';

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast braucht einen ToastProvider im Baum');
  return value;
}
