import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeProvider.js';

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme braucht einen ThemeProvider im Baum');
  return value;
}
