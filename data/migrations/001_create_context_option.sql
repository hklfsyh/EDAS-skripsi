-- Migration: Buat tabel context_option untuk opsi konteks dinamis
-- Fungsi: User bisa nambah/ubah/atur opsi tanpa edit kode atau deploy ulang

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS context_option (
  id_context_option BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, value)
);

-- 2. SEED DATA AWAL

-- Aktivitas
INSERT INTO context_option (category, value, label, description, sort_order, is_active) VALUES
  ('activity', 'belajar', 'Belajar', 'Sesi fokus untuk belajar atau mengerjakan tugas', 1, true),
  ('activity', 'olahraga', 'Olahraga', 'Sesi bergerak atau beraktivitas fisik', 2, true),
  ('activity', 'relaksasi', 'Relaksasi', 'Waktu santai untuk melepas penat', 3, true),
  ('activity', 'bekerja', 'Bekerja', 'Sesi produktif untuk bekerja', 4, true),
  ('activity', 'bepergian', 'Bepergian', 'Saat dalam perjalanan', 5, true),
  ('activity', 'memasak', 'Memasak', 'Aktivitas memasak di dapur', 6, true),
  ('activity', 'membaca', 'Membaca', 'Sesi membaca buku atau artikel', 7, true),
  ('activity', 'bermain_game', 'Bermain Game', 'Sesi bermain video game', 8, true);

-- Waktu
INSERT INTO context_option (category, value, label, description, sort_order, is_active) VALUES
  ('time_category', 'pagi', 'Pagi', 'Pukul 05.00 - 10.59', 1, true),
  ('time_category', 'siang', 'Siang', 'Pukul 11.00 - 14.59', 2, true),
  ('time_category', 'sore', 'Sore', 'Pukul 15.00 - 17.59', 3, true),
  ('time_category', 'malam', 'Malam', 'Pukul 18.00 - 04.59', 4, true);

-- Suasana
INSERT INTO context_option (category, value, label, description, sort_order, is_active) VALUES
  ('mood', 'fokus', 'Fokus', 'Sedang dalam kondisi fokus dan konsentrasi', 1, true),
  ('mood', 'santai', 'Santai', 'Merasa rileks dan tidak terburu-buru', 2, true),
  ('mood', 'bersemangat', 'Bersemangat', 'Penuh energi dan antusiasme', 3, true),
  ('mood', 'netral', 'Netral', 'Suasana hati biasa, tidak terlalu ke arah mana pun', 4, true),
  ('mood', 'marah', 'Marah', 'Merasa kesal atau marah', 5, true),
  ('mood', 'sedih', 'Sedih', 'Merasa murung atau sendu', 6, true),
  ('mood', 'cemas', 'Cemas', 'Merasa gelisah atau khawatir', 7, true),
  ('mood', 'romantis', 'Romantis', 'Merasa romantis atau penuh kasih', 8, true),
  ('mood', 'bahagia', 'Bahagia', 'Merasa senang dan ceria', 9, true);

-- 3. CONTOH: INSERT opsi baru (tidak perlu deploy ulang, tinggal jalanin ini)
-- INSERT INTO context_option (category, value, label, description, sort_order, is_active)
-- VALUES ('activity', 'menulis', 'Menulis', 'Aktivitas menulis atau membuat catatan', 9, true);
