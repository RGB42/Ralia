import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nProvider.js';

export function useT(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT braucht einen I18nProvider im Baum');
  return value;
}
