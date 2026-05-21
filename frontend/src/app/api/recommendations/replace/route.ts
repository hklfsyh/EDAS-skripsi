// NextResponse untuk respons API, sql untuk database, preferenceMapping + edas untuk ranking
import { NextResponse } from "next/server";
import sql from "@/server/db";
import {
  mapQuestionnaireToPreferences,
  normalizeQuestionnaireAnswers,
} from "@/server/utils/preferenceMapping";
import {
  buildEdasDebugSummary,
  createDurationSelectionOptions,
  MIN_PLAYLIST_SONG_DURATION_MS,
  runEdasRanking,
  selectRankedSongsForDurationDetailed,
  selectRankedSongsForDuration,
  type SongCandidate,
} from "@/server/utils/edas";

// ReplaceRequest — tipe payload request untuk mengganti lagu
type ReplaceRequest = {
  excludedIds: number[];
  answers?: number[] | Record<number, number>;
  currentPlaylistSongIds: number[];
  gapDurationSec: number;
  debug?: boolean;
  currentPlaylistDurationSec?: number;
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

// Menyiapkan kandidat replacement dari database dengan dua aturan awal:
// mengecualikan lagu yang sudah terpakai dan menyaring lagu di bawah durasi minimum.
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
      where duration_ms >= ${MIN_PLAYLIST_SONG_DURATION_MS}
    `;
    return rows.map(normalizeRow);
  }

  const rows = await sql<SongCandidate[]>`
    select id_song, title, artist, duration_ms, tempo, energy, danceability,
           happiness, popularity, acousticness, instrumentalness, speechiness
    from songs
    where duration_ms >= ${MIN_PLAYLIST_SONG_DURATION_MS}
      and id_song not in ${sql(excludeAll)}
  `;
  return rows.map(normalizeRow);
}

// Memilih lagu pengganti dari kandidat teratas hasil reranking EDAS
// dengan mempertimbangkan gap durasi sesi yang sedang diperbaiki.
function findReplacements(
  ranked: ReturnType<typeof runEdasRanking>,
  gapSec: number,
  debug = false,
): {
  replacements: ReplacementSong[];
  debug: null | ReturnType<typeof selectRankedSongsForDurationDetailed<ReplacementSong>>["debug"];
} {
  if (gapSec <= 0) {
    return { replacements: [], debug: null };
  }

  const candidates = ranked
    .map((r) => ({
      id_song: r.candidate.id_song,
      title: r.candidate.title,
      artist: r.candidate.artist,
      durationSec: Math.max(0, Math.round(r.candidate.duration_ms / 1000)),
      appraisalScore: r.appraisalScore,
    }))
    .filter((c) => c.durationSec > 0);

  if (candidates.length === 0) {
    return { replacements: [], debug: null };
  }

  const selectionOptions = createDurationSelectionOptions(gapSec, "replacement");
  const selection = debug
    ? selectRankedSongsForDurationDetailed(candidates, {
        ...selectionOptions,
      })
    : {
        selected: selectRankedSongsForDuration(candidates, {
          ...selectionOptions,
        }),
        debug: null,
      };

  return { replacements: selection.selected, debug: selection.debug };
}

// Menjaga mode debug tetap development-only agar data audit tidak terekspos pada mode produksi.
function isDebugEnabled(raw: string | null | undefined, bodyDebug: boolean | undefined): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (bodyDebug === true) {
    return true;
  }

  if (!raw) {
    return false;
  }

  return raw === "1" || raw.toLowerCase() === "true";
}

// Endpoint replacement: memuat kandidat yang layak, menghitung ulang ranking EDAS,
// lalu memilih kombinasi pengganti yang paling sesuai terhadap gap durasi.
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = (await request.json()) as ReplaceRequest;
    const {
      excludedIds,
      answers,
      currentPlaylistSongIds,
      gapDurationSec,
      debug: bodyDebug,
      currentPlaylistDurationSec,
    } = body;
    const debug = isDebugEnabled(url.searchParams.get("debug"), bodyDebug);

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
    const ranked = runEdasRanking(candidates, preferences, { debug });

    const { replacements, debug: selectionDebug } = findReplacements(ranked, gapDurationSec, debug);
    const replacedDurationSec = replacements.reduce((sum, r) => sum + r.durationSec, 0);
    const durationDeltaSec = gapDurationSec - replacedDurationSec;
    const totalDurationAfterReplace =
      Number.isFinite(currentPlaylistDurationSec)
        ? Number(currentPlaylistDurationSec) - gapDurationSec + replacedDurationSec
        : undefined;

    return NextResponse.json({
      replacements,
      gapDurationSec,
      replacedDurationSec,
      ...(debug
        ? {
            debug: {
              enabled: true,
              normalizedAnswers: safeAnswers,
              preferences,
              candidateCountAfterFilter: candidates.length,
              excludedIds: [...new Set(excludedIds)],
              currentPlaylistSongIds: [...new Set(currentPlaylistSongIds)],
              targetReplacementDurationSec: gapDurationSec,
              topEdasCandidates: buildEdasDebugSummary(ranked, 10),
              replacementSelection: selectionDebug,
              selectedReplacements: replacements,
              durationDeltaSec,
              totalDurationBeforeReplace: Number.isFinite(currentPlaylistDurationSec)
                ? Number(currentPlaylistDurationSec)
                : undefined,
              totalDurationAfterReplace,
            },
          }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
