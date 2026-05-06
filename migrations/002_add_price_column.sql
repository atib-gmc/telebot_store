-- Tambah kolom price ke game_accounts
ALTER TABLE game_accounts
ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;
