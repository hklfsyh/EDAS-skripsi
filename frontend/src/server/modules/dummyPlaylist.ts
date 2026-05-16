import { NextResponse } from "next/server";

import sql from "@/server/db";
import { mapQuestionnaireToPreferences } from "@/server/utils/preferenceMapping";
import { buildPlaylistFromRanking, runEdasRanking, type SongCandidate } from "@/server/utils/edas";

// Normalisasi input jawaban kuesioner
function normalizeAnswers(raw?: string | string[] | null): number[] | null {
  if (!raw) return null;

  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as number[];
    if (typeof parsed === "object" && parsed) {
      return Object.values(parsed).map(Number);
    }
  } catch {
    // fallthrough
  }

  const parts = text.split(",").map((value) => Number(value.trim()));
  if (parts.some((value) => Number.isNaN(value))) {
    return null;
  }
  return parts;
}

// Ambil daftar lagu dari database
async function loadTracksFromDatabase(): Promise<{ tracks: SongCandidate[]; source: string }> {
  const rows = await sql<SongCandidate[]>`
    select
      id_song,
      title,
      artist,
      duration_ms,
      tempo,
      energy,
      danceability,
      happiness,
      popularity,
      acousticness,
      instrumentalness,
      speechiness
    from songs
    where duration_ms > 0
  `;

  const tracks = rows
    .map((row) => ({
      ...row,
      duration_ms: row.duration_ms ?? 0,
      popularity: row.popularity ?? 0,
      tempo: row.tempo ?? 0,
      energy: row.energy ?? 0,
      danceability: row.danceability ?? 0,
      happiness: row.happiness ?? 0,
      acousticness: row.acousticness ?? 0,
      instrumentalness: row.instrumentalness ?? 0,
      speechiness: row.speechiness ?? 0,
    }))
    .filter((track) => track.duration_ms > 0);

  return { tracks, source: "songs (database)" };
}

// Jalankan EDAS lalu bentuk playlist berdasarkan durasi target
function buildEdasPlaylist(tracks: SongCandidate[], answers: number[], targetMinutes: number) {
  const preferences = mapQuestionnaireToPreferences(answers);
  const ranked = runEdasRanking(tracks, preferences);
  const playlist = buildPlaylistFromRanking(ranked, targetMinutes);

  return { playlist, preferences };
}

// API dummy playlist (GET)
export async function handleDummyPlaylistGet(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetMinutes = Number(searchParams.get("targetMinutes") ?? 30);
    const { tracks, source } = await loadTracksFromDatabase();
    const rawAnswers = normalizeAnswers(searchParams.get("answers"));
    const answers = rawAnswers ?? new Array(14).fill(3);
    const { playlist } = buildEdasPlaylist(
      tracks,
      answers,
      Number.isFinite(targetMinutes) ? targetMinutes : 30,
    );

    return NextResponse.json({
      source,
      totalTracks: tracks.length,
      playlist,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dummy dari database" },
      { status: 500 },
    );
  }
}

// API dummy playlist (POST)
export async function handleDummyPlaylistPost(request: Request) {
  try {
    const body = (await request.json()) as {
      answers?: number[] | Record<number, number>;
      targetMinutes?: number;
    };

    const targetMinutes = Number(body.targetMinutes ?? 30);
    const rawAnswers = normalizeAnswers(JSON.stringify(body.answers ?? []));
    const answers = rawAnswers && rawAnswers.length > 0 ? rawAnswers : new Array(14).fill(3);

    const { tracks, source } = await loadTracksFromDatabase();
    const { playlist } = buildEdasPlaylist(
      tracks,
      answers,
      Number.isFinite(targetMinutes) ? targetMinutes : 30,
    );

    return NextResponse.json({
      source,
      totalTracks: tracks.length,
      playlist,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dummy dari database" },
      { status: 500 },
    );
  }
}
