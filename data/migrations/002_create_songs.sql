-- Migration: Buat tabel songs untuk dataset lagu
-- Fungsi: Menyimpan fitur audio lagu dari dataset million song dataset

CREATE TABLE IF NOT EXISTS songs (
  id_song BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  tempo REAL,
  energy REAL,
  danceability REAL,
  happiness REAL,
  acousticness REAL,
  instrumentalness REAL,
  speechiness REAL,
  popularity INTEGER DEFAULT 0
);

-- Import data lagu dari CSV:
--   python backend/src/import_songs.py
-- atau via psql:
--   \copy songs (title, artist, duration_ms, tempo, energy, danceability, happiness, acousticness, instrumentalness, speechiness, popularity)
--   FROM 'data/output.csv' DELIMITER ',' CSV HEADER;
