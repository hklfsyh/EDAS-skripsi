// NextResponse untuk respons API, sql untuk database, preferenceMapping + edas untuk ranking
import { NextResponse } from "next/server";
import sql from "@/server/db";
import {
  mapQuestionnaireToPreferences,
  normalizeQuestionnaireAnswers,
} from "@/server/utils/preferenceMapping";
import {
  runEdasRanking,
  selectRankedSongsForDuration,
  type SongCandidate,
} from "@/server/utils/edas";

// ReplaceRequest — tipe payload request untuk mengganti lagu
type ReplaceRequest = {
  excludedIds: number[];
  answers?: number[] | Record<number, number>;
  currentPlaylistSongIds: number[];
  gapDurationSec: number;
};

// ReplacementSong — tipe data lagu pengganti yang dikembalikan ke client
type ReplacementSong = {
  id_song?: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

// normalizeRow — pastikan semua properti numerik SongCandidate memiliki nilai default
function normalizeRow(row: SongCandidate & { id_song?: number }): SongCandidate {
  return {
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
  };
}

// loadCandidates — ambil kandidat lagu dari database, exclude lagu yang sudah dipakai
async function loadCandidates(
  excludedIds: number[],
  currentPlaylistSongIds: number[],
): Promise<SongCandidate[]> {
  const excludeAll = [...new Set([...excludedIds, ...currentPlaylistSongIds])];

  if (excludeAll.length === 0) {
    const rows = await sql<SongCandidate[]>`
      select id_song, title, artist, duration_ms, tempo, energy, danceability,
             happiness, popularity, acousticness, instrumentalness, speechiness
      from songs
      where duration_ms > 0
    `;
    return rows.map(normalizeRow);
  }

  const rows = await sql<SongCandidate[]>`
    select id_song, title, artist, duration_ms, tempo, energy, danceability,
           happiness, popularity, acousticness, instrumentalness, speechiness
    from songs
    where duration_ms > 0
      and id_song not in ${sql(excludeAll)}
  `;
  return rows.map(normalizeRow);
}

// findReplacements — cari lagu terbaik untuk mengisi gap durasi
function findReplacements(
  ranked: ReturnType<typeof runEdasRanking>,
  gapSec: number,
): ReplacementSong[] {
  if (gapSec <= 0) return [];

  const candidates = ranked
    .map((r) => ({
      id_song: r.candidate.id_song,
      title: r.candidate.title,
      artist: r.candidate.artist,
      durationSec: Math.max(0, Math.round(r.candidate.duration_ms / 1000)),
      appraisalScore: r.appraisalScore,
    }))
    .filter((c) => c.durationSec > 0);

  if (candidates.length === 0) return [];

  return selectRankedSongsForDuration(candidates, {
    targetSec: gapSec,
    candidateLimit: 60,
    maxSongs: Math.max(1, Math.min(5, Math.ceil(gapSec / 150))),
    overshootToleranceSec: Math.max(45, Math.round(gapSec * 0.2)),
    preferFewerSongs: true,
  });
}

// POST — terima request replace lagu, ranking dengan EDAS, pilih pengganti terbaik
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReplaceRequest;
    const { excludedIds, answers, currentPlaylistSongIds, gapDurationSec } = body;

    const candidates = await loadCandidates(excludedIds, currentPlaylistSongIds);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada kandidat lagu pengganti yang tersedia." },
        { status: 404 },
      );
    }

    const normalizedAnswers = normalizeQuestionnaireAnswers(answers);
    const safeAnswers = normalizedAnswers.length > 0 ? normalizedAnswers : new Array(14).fill(3);
    const preferences = mapQuestionnaireToPreferences(safeAnswers);
    const ranked = runEdasRanking(candidates, preferences);

    const replacements = findReplacements(ranked, gapDurationSec);
    const replacedDurationSec = replacements.reduce((sum, r) => sum + r.durationSec, 0);

    return NextResponse.json({
      replacements,
      gapDurationSec,
      replacedDurationSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
