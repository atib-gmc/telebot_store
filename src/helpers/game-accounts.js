import { supabase } from '../database.js';

export async function upsertGameAccount(accountId, level) {
  const { data: existing } = await supabase
    .from('game_accounts')
    .select('id')
    .eq('account_id', accountId)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('game_accounts')
      .update({ level })
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) throw error;
    return { ...data, isNew: false };
  }

  const { data, error } = await supabase
    .from('game_accounts')
    .insert({ account_id: accountId, level })
    .select()
    .single();

  if (error) throw error;
  return { ...data, isNew: true };
}
