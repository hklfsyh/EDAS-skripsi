import { NextResponse } from "next/server";
import sql from "@/server/db";
import { mapQuestionnaireToPreferences } from "@/server/utils/preferenceMapping";
import { runEdasRanking, type SongCandidate } from "@/server/utils/edas";

type ReplaceRequest = {
  excludedIds: number[];
  answers: number[];
  currentPlaylistSongIds: number[];
  gapDurationSec: number;
};

type ReplacementSong = {
  id_song?: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

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

function computeScore(
  edasQuality: number,
  durationDiff: number,
  gapSec: number,
  numSongs: number,
): number {
  const durationFit = Math.max(0, 1 - durationDiff / Math.max(gapSec, 1));
  const simplicity = numSongs === 1 ? 1 : 1 / Math.sqrt(numSongs);
  return durationFit * 0.4 + edasQuality * 0.4 + simplicity * 0.2;
}

function findReplacements(
  ranked: ReturnType<typeof runEdasRanking>,
  gapSec: number,
): ReplacementSong[] {
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

  if (candidates.length === 1) return [candidates[0]];

  let bestSingle = candidates[0];
  let bestSingleDiff = Math.abs(candidates[0].durationSec - gapSec);
  for (const c of candidates) {
    const diff = Math.abs(c.durationSec - gapSec);
    if (diff < bestSingleDiff || (diff === bestSingleDiff && c.appraisalScore > bestSingle.appraisalScore)) {
      bestSingle = c;
      bestSingleDiff = diff;
    }
  }

  const multiResult: ReplacementSong[] = [];
  let multiTotal = 0;
  const tolerance = Math.max(gapSec * 0.15, 30);

  for (const c of candidates) {
    if (multiTotal >= gapSec - 5) break;
    if (multiTotal + c.durationSec <= gapSec + tolerance) {
      multiResult.push(c);
      multiTotal += c.durationSec;
    }
  }

  if (multiResult.length === 0) return [bestSingle];

  const multiDiff = Math.abs(multiTotal - gapSec);
  const multiAvgScore = multiResult.reduce((s, r) => s + r.appraisalScore, 0) / multiResult.length;

  const singleScore = computeScore(bestSingle.appraisalScore, bestSingleDiff, gapSec, 1);
  const multiScore = computeScore(multiAvgScore, multiDiff, gapSec, multiResult.length);

  return multiScore > singleScore ? multiResult : [bestSingle];
}

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

    const preferences = mapQuestionnaireToPreferences(answers);
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
