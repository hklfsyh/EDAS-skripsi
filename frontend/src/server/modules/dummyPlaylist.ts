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

// normalize jawaban kuisioner biar endpoint bisa nerima format array ataupun object
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
    // skip aja
  }

  const parts = text.split(",").map((value) => Number(value.trim()));
  if (parts.some((value) => Number.isNaN(value))) {
    return null;
  }
  return parts;
}

// saring kandidat lagu biar playlist gak ada lagu yang durasinya terlalu pendek
// ini aturan kelayakan sebelum ranking pake edas
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

// jalanin pipeline awal: hitung preferensi, ranking pake edas,
// terus bikin playlist sesuai target durasi
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

  return { playlist, preferences, ranked, debug: debugPayload };
}

// debug cuma nyala di mode development biar gak kelihatan pas dipake normal
function isDebugEnabledFromQuery(raw: string | null): boolean {
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

// api dummy playlist (get)
export async function handleDummyPlaylistGet(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetMinutes = Number(searchParams.get("targetMinutes") ?? 30);
    const debug = process.env.NODE_ENV !== "production" && isDebugEnabledFromQuery(searchParams.get("debug"));
    const { tracks, source } = await loadTracksFromDatabase();
    const rawAnswers = normalizeAnswers(searchParams.get("answers"));
    const answers = rawAnswers ?? new Array(14).fill(3);
    const { playlist, preferences, ranked, debug: debugPayload } = buildEdasPlaylist(
      tracks,
      answers,
      Number.isFinite(targetMinutes) ? targetMinutes : 30,
      debug,
    );

    let table48: unknown[] | undefined;
    let table49: unknown[] | undefined;
    if (debugPayload) {
      table48 = Object.entries(preferences.parameters).map(([parameter, data]) => ({
        parameter,
        score: Number(data.score.toFixed(4)),
        weight: Number(data.weight.toFixed(4)),
        meanLikert: Number(data.meanLikert.toFixed(4)),
        criterion: data.criterion,
      }));
      table49 = ranked.slice(0, 5).map((row, index) => ({
        rank: index + 1,
        title: row.candidate.title,
        artist: row.candidate.artist,
        SP: Number(row.sp.toFixed(4)),
        SN: Number(row.sn.toFixed(4)),
        NSP: Number(row.nsp.toFixed(4)),
        NSN: Number(row.nsn.toFixed(4)),
        appraisalScore: Number(row.appraisalScore.toFixed(4)),
      }));
    }

    return NextResponse.json({
      source,
      totalTracks: tracks.length,
      playlist,
      ...(debugPayload ? { debug: debugPayload } : {}),
      ...(table48 ? { table48 } : {}),
      ...(table49 ? { table49 } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dari database" },
      { status: 500 },
    );
  }
}

// api dummy playlist (post)
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
    const { playlist, preferences, ranked, debug: debugPayload } = buildEdasPlaylist(
      tracks,
      answers,
      Number.isFinite(targetMinutes) ? targetMinutes : 30,
      debug,
    );

    let table48: unknown[] | undefined;
    let table49: unknown[] | undefined;
    if (debugPayload) {
      table48 = Object.entries(preferences.parameters).map(([parameter, data]) => ({
        parameter,
        score: Number(data.score.toFixed(4)),
        weight: Number(data.weight.toFixed(4)),
        meanLikert: Number(data.meanLikert.toFixed(4)),
        criterion: data.criterion,
      }));
      table49 = ranked.slice(0, 5).map((row, index) => ({
        rank: index + 1,
        title: row.candidate.title,
        artist: row.candidate.artist,
        SP: Number(row.sp.toFixed(4)),
        SN: Number(row.sn.toFixed(4)),
        NSP: Number(row.nsp.toFixed(4)),
        NSN: Number(row.nsn.toFixed(4)),
        appraisalScore: Number(row.appraisalScore.toFixed(4)),
      }));
    }

    return NextResponse.json({
      source,
      totalTracks: tracks.length,
      playlist,
      ...(debugPayload ? { debug: debugPayload } : {}),
      ...(table48 ? { table48 } : {}),
      ...(table49 ? { table49 } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dari database" },
      { status: 500 },
    );
  }
}
