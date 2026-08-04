import { supabase } from './supabase';
import type { Profile } from '@/types/database';

/** Mirrors PARTNER_RPC_ERROR_KEYS in the legacy web app's partner.js. */
const RPC_ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'Dieser Einladungscode ist ungültig.',
  cant_connect_self: 'Du kannst dich nicht mit dir selbst verbinden.',
  already_connected: 'Du bist bereits mit einem Partner verbunden.',
  partner_taken: 'Diese Person ist bereits mit jemand anderem verbunden.',
  not_authenticated: 'Sitzung abgelaufen. Bitte melde dich erneut an.',
};

function mapRpcError(message: string | undefined): string {
  if (!message) return RPC_ERROR_MESSAGES.invalid_code;
  return RPC_ERROR_MESSAGES[message] ?? RPC_ERROR_MESSAGES.invalid_code;
}

export async function connectPartner(inviteCode: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('connect_partner', { p_invite_code: inviteCode });
  if (error) throw new Error(mapRpcError(error.message));
  if (!data) throw new Error(RPC_ERROR_MESSAGES.invalid_code);
  return data as Profile;
}

export async function disconnectPartner(): Promise<void> {
  const { error } = await supabase.rpc('disconnect_partner');
  if (error) throw new Error(mapRpcError(error.message));
}

export async function setSharedAnniversary(date: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_shared_anniversary', { p_date: date });
  if (error) throw new Error(mapRpcError(error.message));
}
