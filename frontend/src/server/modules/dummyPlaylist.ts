import { NextResponse } from "next/server";

import sql from "@/server/db";
import {
  mapQuestionnaireToPreferences,
  normalizeQuestionnaireAnswers,
} from "@/server/utils/preferenceMapping";
import {
  buildEdasDebugSummary,
  buildPlaylistFromRanking,
  MIN_PLAYLIST_SONG_DURATION_MS,
  runEdasRanking,
  type SongCandidate,
} from "@/server/utils/edas";

type DummyPlaylistDebug = {
  enabled: boolean;
  normalizedAnswers: number[];
  preferences: ReturnType<typeof mapQuestionnaireToPreferences>;
  topSongs: ReturnType<typeof buildEdasDebugSummary>;
};

// Menormalkan jawaban kuesioner agar endpoint menerima format array maupun object secara konsisten.
function normalizeAnswers(raw?: string | string[] | null): number[] | null {
  if (!raw) return null;

  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) || (typeof parsed === "object" && parsed)) {
      const normalized = normalizeQuestionnaireAnswers(
        parsed as number[] | Record<number, number>,
      );
      return normalized.length > 0 ? normalized : null;
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

// Menyaring kandidat lagu agar playlist tidak berisi lagu dengan durasi terlalu pendek.
// Filter ini merupakan aturan kelayakan kandidat sebelum proses ranking EDAS.
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
    where duration_ms >= ${MIN_PLAYLIST_SONG_DURATION_MS}
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
    .filter((track) => track.duration_ms >= MIN_PLAYLIST_SONG_DURATION_MS);

  return { tracks, source: "songs (database)" };
}

// Menjalankan pipeline generate awal: pembobotan preferensi, ranking EDAS,
// lalu pembentukan playlist sesuai target durasi.
function buildEdasPlaylist(
  tracks: SongCandidate[],
  answers: number[],
  targetMinutes: number,
  debug = false,
) {
  const preferences = mapQuestionnaireToPreferences(answers);
  const ranked = runEdasRanking(tracks, preferences, { debug });
  const playlist = buildPlaylistFromRanking(ranked, targetMinutes);

  const debugPayload: DummyPlaylistDebug | undefined = debug
    ? {
        enabled: true,
        normalizedAnswers: answers,
        preferences,
        topSongs: buildEdasDebugSummary(ranked, 10),
      }
    : undefined;

  return { playlist, preferences, debug: debugPayload };
}

// Mengaktifkan debug hanya pada mode development agar tidak tampil pada penggunaan normal.
function isDebugEnabledFromQuery(raw: string | null): boolean {
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

// API dummy playlist (GET)
export async function handleDummyPlaylistGet(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetMinutes = Number(searchParams.get("targetMinutes") ?? 30);
    const debug = process.env.NODE_ENV !== "production" && isDebugEnabledFromQuery(searchParams.get("debug"));
    const { tracks, source } = await loadTracksFromDatabase();
    const rawAnswers = normalizeAnswers(searchParams.get("answers"));
    const answers = rawAnswers ?? new Array(14).fill(3);
    const { playlist, debug: debugPayload } = buildEdasPlaylist(
      tracks,
      answers,
      Number.isFinite(targetMinutes) ? targetMinutes : 30,
      debug,
    );

    return NextResponse.json({
      source,
      totalTracks: tracks.length,
      playlist,
      ...(debugPayload ? { debug: debugPayload } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dari database" },
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
      debug?: boolean;
    };

    const targetMinutes = Number(body.targetMinutes ?? 30);
    const debug = process.env.NODE_ENV !== "production" && body.debug === true;
    const rawAnswers = normalizeAnswers(JSON.stringify(body.answers ?? []));
    const answers = rawAnswers && rawAnswers.length > 0 ? rawAnswers : new Array(14).fill(3);

    const { tracks, source } = await loadTracksFromDatabase();
    const { playlist, debug: debugPayload } = buildEdasPlaylist(
      tracks,
      answers,
      Number.isFinite(targetMinutes) ? targetMinutes : 30,
      debug,
    );

    return NextResponse.json({
      source,
      totalTracks: tracks.length,
      playlist,
      ...(debugPayload ? { debug: debugPayload } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dari database" },
      { status: 500 },
    );
  }
}
