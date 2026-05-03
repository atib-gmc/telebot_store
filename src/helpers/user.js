import { supabase } from '../database.js';

export async function ensureUserExists(ctx) {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name || '';
  const username = ctx.from.username;
  const fullName = `${firstName} ${lastName}`.trim();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          user_id: userId,
          name: fullName,
          username: username || null,
        });

      if (insertError) {
        console.error('Error inserting user:', insertError);
      } else {
        console.log(`User baru ditambahkan ke database: ${fullName} (${userId})`);
      }
      return false;
    }

    if (error) {
      console.error('Error checking user:', error);
      return false;
    }

    console.log(`User sudah ada di database: ${fullName} (${userId})`);
    return true;
  } catch (err) {
    console.error('ensureUserExists failed:', err);
    return false;
  }
}
