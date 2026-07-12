-- Migration: Buat tabel recommendation_session untuk menyimpan sesi rekomendasi
-- Fungsi: Menyimpan konteks, fingerprint, dan referensi playlist export dari tiap sesi

CREATE TABLE IF NOT EXISTS recommendation_session (
  id_session BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  activity TEXT NOT NULL,
  time_category TEXT NOT NULL,
  mood TEXT NOT NULL,
  duration_target INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  spotify_playlist_url TEXT,
  spotify_playlist_title TEXT,
  spotify_exported_at TIMESTAMPTZ,
  youtube_playlist_url TEXT,
  youtube_playlist_title TEXT,
  youtube_exported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_client ON recommendation_session(client_id);
CREATE INDEX IF NOT EXISTS idx_session_fingerprint ON recommendation_session(fingerprint);
