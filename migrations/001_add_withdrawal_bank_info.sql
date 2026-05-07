-- Tambah kolom untuk info rekening di tabel withdrawals
ALTER TABLE withdrawals
  ADD COLUMN account_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN account_number TEXT NOT NULL DEFAULT '';
