-- Migration: Buat tabel recommendation_song untuk menyimpan lagu hasil rekomendasi
-- Fungsi: Menyimpan daftar lagu yang direkomendasikan di tiap sesi beserta skor appraisal

CREATE TABLE IF NOT EXISTS recommendation_song (
  id_recommendation_song BIGSERIAL PRIMARY KEY,
  id_session BIGINT NOT NULL REFERENCES recommendation_session(id_session) ON DELETE CASCADE,
  id_song BIGINT NOT NULL REFERENCES songs(id_song),
  rank_order INTEGER NOT NULL,
  appraisal_score REAL,
  UNIQUE(id_session, id_song)
);
