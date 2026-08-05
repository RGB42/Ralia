import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthProvider.js';

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth braucht einen AuthProvider im Baum');
  return value;
}
