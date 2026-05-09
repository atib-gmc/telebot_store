import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// ===== SETUP SUPABASE =====
// Baca URL dan Key dari file .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

// Buat client Supabase untuk query database
export const supabase = createClient(supabaseUrl, supabaseKey);

// ===== Pastikan user ada di database =====
// Fungsi ini dipanggil setiap ada user baru chat
// Kalau user sudah ada → skip, kalau belum → insert ke tabel users
export async function ensureUserExists(ctx) {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  const lastName = ctx.from.last_name || "";
  const username = ctx.from.username;
  const fullName = `${firstName} ${lastName}`.trim();

  // Coba cari user di database
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  // PGRST116 = tidak ditemukan, berarti user baru → insert
  if (error && error.code === "PGRST116") {
    const { error: insertError } = await supabase.from("users").insert({
      user_id: userId,
      name: fullName,
      username: username || null,
    });

    if (insertError) {
      console.error("Error insert user:", insertError);
    } else {
      console.log(`User baru: ${fullName} (${userId})`);
    }
    return;
  }

  if (error) {
    console.error("Error check user:", error);
  }
}

// ===== Simpan/update game account =====
// Fungsi ini menyimpan akun game ke tabel game_accounts
// Kalau akun sudah ada → update password, kalau belum → insert baru
export async function upsertGameAccount(email, level, userId) {
  // Step 1: Cek apakah akun sudah ada di database
  const { data: existing } = await supabase
    .from("game_accounts")
    .select("id")
    .eq("email", email)
    .single();

  // Step 2: Kalau sudah ada → update password/level
  if (existing) {
    const { data, error } = await supabase
      .from("game_accounts")
      .update({ level })
      .eq("email", email)
      .select()
      .single();

    if (error) throw error;
    return { ...data, isNew: false }; // flag: ini bukan akun baru
  }

  // Step 3: Kalau belum ada → insert sebagai akun baru
  const { data, error } = await supabase
    .from("game_accounts")
    .insert({ email, level, user_id: userId, status: "pending" })
    .select()
    .single();

  if (error) throw error;
  return { ...data, isNew: true }; // flag: ini akun baru
}

// ===== Update harga akun =====
// Fungsi ini dipanggil di step 2 proses setor
// Setelah user kirim harga, fungsi ini update kolom price di game_accounts
export async function updateAccountPrice(email, price) {
  const { data, error } = await supabase
    .from("game_accounts")
    .update({ authenticator: price })
    .eq("email", email)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ===== Ambil data user untuk profile =====
export async function getUserProfile(userId) {
  const { data, error } = await supabase.from("users").select("*").eq("user_id", userId).single();

  if (error) throw error;
  return data;
}

// ===== Ambil semua akun game user =====
export async function getUserGameAccounts(userId) {
  const { data, error } = await supabase
    .from("game_accounts")
    .select("email, status")
    .eq("user_id", userId);

  if (error) throw error;
  return data || [];
}

// ===== Cek apakah user adalah admin =====
export function isAdmin(userId) {
  const adminIds = [process.env.ADMIN_ID_1, process.env.ADMIN_ID_2]
    .filter(Boolean)
    .map((id) => parseInt(id));

  return adminIds.includes(userId);
}

// ===== Ambil semua game accounts =====
export async function getAllGameAccounts(statusFilter = null) {
  let query = supabase
    .from("game_accounts")
    .select("id, email, level, authenticator, status, user_id")
    .order("id", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// ===== Update status akun =====
export async function updateAccountStatus(accountId, status, userId) {
  if (status.toLowerCase() === "approved") {
    //tambahakan balance user
    const { error: incrementError } = await supabase.rpc("increment_balance", {
      target_user_id: userId,
      amount: 1500,
    });
  }
  const { data, error } = await supabase
    .from("game_accounts")
    .update({ status })
    .eq("id", accountId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserPendingWithdrawals(userId) {
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) throw error;
  return data || [];
}

export async function createWithdrawal(userId, bankName, accountName, accountNumber, amount) {
  const { data, error } = await supabase
    .from("withdrawals")
    .insert({
      user_id: userId,
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      amount,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deductUserBalance(userId, amount) {
  const { data: user } = await supabase
    .from("users")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const currentBalance = Number(user.balance) || 0;
  const newBalance = currentBalance - amount;

  if (newBalance < 0) {
    throw new Error("Saldo tidak mencukupi");
  }

  const { data, error } = await supabase
    .from("users")
    .update({ balance: newBalance })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function refundUserBalance(userId, amount) {
  const { data: user } = await supabase
    .from("users")
    .select("balance")
    .eq("user_id", userId)
    .single();

  const currentBalance = Number(user.balance) || 0;
  const newBalance = currentBalance + amount;

  const { data, error } = await supabase
    .from("users")
    .update({ balance: newBalance })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAllWithdrawals(statusFilter = null) {
  let query = supabase
    .from("withdrawals")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function updateWithdrawalStatus(withdrawalId, status, note = null) {
  const updateData = { status };
  if (note !== null) {
    updateData.note = note;
  }

  const { data, error } = await supabase
    .from("withdrawals")
    .update(updateData)
    .eq("id", withdrawalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserWithdrawalHistory(userId) {
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
