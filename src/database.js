import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// ===== SETUP SUPABASE =====
// Baca URL dan Key dari file .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

// Buat client Supabase untuk query database
export const supabase = createClient(supabaseUrl, supabaseKey);

// ===== Pastikan user ada di database =====
// Fungsi ini dipanggil setiap ada user baru chat
// Kalau user sudah ada → skip, kalau belum → insert ke tabel users
export async function ensureUserExists(ctx) {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name || '';
  const username = ctx.from.username;
  const fullName = `${firstName} ${lastName}`.trim();

  // Coba cari user di database
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  // PGRST116 = tidak ditemukan, berarti user baru → insert
  if (error && error.code === 'PGRST116') {
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        name: fullName,
        username: username || null,
      });

    if (insertError) {
      console.error('Error insert user:', insertError);
    } else {
      console.log(`User baru: ${fullName} (${userId})`);
    }
    return;
  }

  if (error) {
    console.error('Error check user:', error);
  }
}

// ===== Simpan/update game account =====
// Fungsi ini menyimpan akun game ke tabel game_accounts
// Kalau akun sudah ada → update password, kalau belum → insert baru
export async function upsertGameAccount(accountId, level) {
  // Step 1: Cek apakah akun sudah ada di database
  const { data: existing } = await supabase
    .from('game_accounts')
    .select('id')
    .eq('account_id', accountId)
    .single();

  // Step 2: Kalau sudah ada → update password/level
  if (existing) {
    const { data, error } = await supabase
      .from('game_accounts')
      .update({ level })
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) throw error;
    return { ...data, isNew: false }; // flag: ini bukan akun baru
  }

  // Step 3: Kalau belum ada → insert sebagai akun baru
  const { data, error } = await supabase
    .from('game_accounts')
    .insert({ account_id: accountId, level })
    .select()
    .single();

  if (error) throw error;
  return { ...data, isNew: true }; // flag: ini akun baru
}

// ===== Update harga akun =====
// Fungsi ini dipanggil di step 2 proses setor
// Setelah user kirim harga, fungsi ini update kolom price di game_accounts
export async function updateAccountPrice(accountId, price) {
  const { data, error } = await supabase
    .from('game_accounts')
    .update({ authenticator: price })
    .eq('account_id', accountId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
