import type { CriterionType, PreferenceParameter, PreferenceResult } from "@/server/utils/preferenceMapping";

export const MIN_PLAYLIST_SONG_DURATION_MS = 90_000;
export const MIN_PLAYLIST_SONG_DURATION_SEC = 90;

export type SongCandidate = {
  id_song?: number;
  title: string;
  artist: string;
  duration_ms: number;
  tempo: number | null;
  energy: number | null;
  danceability: number | null;
  happiness: number | null;
  popularity: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  speechiness: number | null;
};

export type EdasRankedSong = {
  rank: number;
  id_song?: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

type CriterionStats = {
  average: number;
  averageDeviation: number;
};

export type EdasParameterDebug = {
  parameter: PreferenceParameter;
  value: number;
  average: number;
  averageDeviation: number;
  weight: number;
  criterion: CriterionType | null;
  pda: number;
  nda: number;
  weightedPda: number;
  weightedNda: number;
};

export type EdasSongDebug = {
  rank: number;
  id_song?: number;
  title: string;
  artist: string;
  durationSec: number;
  parameters: EdasParameterDebug[];
  sp: number;
  sn: number;
  nsp: number;
  nsn: number;
  appraisalScore: number;
};

export type EdasScoreRow = {
  candidate: SongCandidate;
  sp: number;
  sn: number;
  nsp: number;
  nsn: number;
  appraisalScore: number;
  debug?: {
    parameters: EdasParameterDebug[];
  };
};

type DurationSelectable = {
  durationSec: number;
  appraisalScore: number;
};

type DurationSelectionOptions = {
  targetSec: number;
  candidateLimit: number;
  maxSongs: number;
  overshootToleranceSec: number;
  preferFewerSongs?: boolean;
};

export type DurationSelectionCandidate = DurationSelectable & {
  id_song?: number;
  title: string;
  artist: string;
};

export type DurationSelectionCombination<T extends DurationSelectionCandidate> = {
  objective: number;
  averageAppraisalScore: number;
  totalDurationSec: number;
  durationDiffSec: number;
  coverage: number;
  durationFit: number;
  count: number;
  songs: T[];
};

export type DurationSelectionDebug<T extends DurationSelectionCandidate> = {
  targetSec: number;
  candidateLimit: number;
  maxSongs: number;
  overshootToleranceSec: number;
  topCandidates: T[];
  consideredCombinations: Array<DurationSelectionCombination<T>>;
  selectedCombination: DurationSelectionCombination<T> | null;
};

type DurationState = {
  sumScore: number;
  actualTotalSec: number;
  previousTotalKey: number;
  previousCount: number;
  pickedIndex: number;
};

type DurationSelectionProfile = "playlist" | "replacement";

const PARAMETERS: PreferenceParameter[] = [
  "tempo",
  "energy",
  "danceability",
  "happiness",
  "popularity",
  "acousticness",
  "instrumentalness",
  "speechiness",
];

function normalizeValue(value: number | null): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value ?? 0);
}

function calculateCriterionStats(
  candidates: SongCandidate[],
  activeParameters: PreferenceParameter[],
): Record<PreferenceParameter, CriterionStats> {
  const stats = {} as Record<PreferenceParameter, CriterionStats>;

  for (const parameter of activeParameters) {
    const values = candidates.map((candidate) => normalizeValue(candidate[parameter]));
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviations = values.map((value) => Math.abs(value - average));
    const averageDeviation =
      deviations.reduce((sum, value) => sum + value, 0) / deviations.length;

    stats[parameter] = {
      average,
      averageDeviation,
    };
  }

  return stats;
}

function computePdaNda(
  value: number,
  average: number,
  criterion: CriterionType,
): { pda: number; nda: number } {
  if (!Number.isFinite(average) || average === 0) {
    return { pda: 0, nda: 0 };
  }

  if (criterion === "benefit") {
    return {
      pda: Math.max(0, (value - average) / average),
      nda: Math.max(0, (average - value) / average),
    };
  }

  return {
    pda: Math.max(0, (average - value) / average),
    nda: Math.max(0, (value - average) / average),
  };
}

function normalizeSpSn(spValues: number[], snValues: number[]) {
  const maxSp = Math.max(...spValues);
  const maxSn = Math.max(...snValues);

  const nsp = spValues.map((value) => (maxSp > 0 ? value / maxSp : 0));
  const nsn = snValues.map((value) => (maxSn > 0 ? 1 - value / maxSn : 1));

  return { nsp, nsn, maxSp, maxSn };
}

function scoreDurationSelection(
  sumScore: number,
  actualTotalSec: number,
  count: number,
  targetSec: number,
  preferFewerSongs: boolean,
): number {
  if (count <= 0 || targetSec <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const averageScore = sumScore / count;
  const durationFit = Math.max(0, 1 - Math.abs(actualTotalSec - targetSec) / targetSec);
  const coverage = Math.min(actualTotalSec / targetSec, 1);
  const simplicity = preferFewerSongs ? 1 / Math.sqrt(count) : Math.min(count / 8, 1);
  const underCoveragePenalty = actualTotalSec < targetSec * 0.8 ? 0.15 : 0;

  return (averageScore * 0.4) + (durationFit * 0.4) + (coverage * 0.15) + (simplicity * 0.05) - underCoveragePenalty;
}

function buildDurationCombination<T extends DurationSelectionCandidate>(
  songs: T[],
  targetSec: number,
  preferFewerSongs: boolean,
): DurationSelectionCombination<T> {
  const totalDurationSec = songs.reduce((sum, song) => sum + song.durationSec, 0);
  const averageAppraisalScore =
    songs.length > 0
      ? songs.reduce((sum, song) => sum + song.appraisalScore, 0) / songs.length
      : 0;
  const durationDiffSec = Math.abs(totalDurationSec - targetSec);
  const coverage = targetSec > 0 ? Math.min(totalDurationSec / targetSec, 1) : 0;
  const durationFit = targetSec > 0 ? Math.max(0, 1 - durationDiffSec / targetSec) : 0;
  const objective = scoreDurationSelection(
    averageAppraisalScore * songs.length,
    totalDurationSec,
    songs.length,
    targetSec,
    preferFewerSongs,
  );

  return {
    objective: Number(objective.toFixed(6)),
    averageAppraisalScore: Number(averageAppraisalScore.toFixed(6)),
    totalDurationSec,
    durationDiffSec,
    coverage: Number(coverage.toFixed(6)),
    durationFit: Number(durationFit.toFixed(6)),
    count: songs.length,
    songs,
  };
}

function reconstructDurationSelection<T extends DurationSelectionCandidate>(
  dp: Array<Map<number, DurationState>>,
  count: number,
  totalKey: number,
  candidates: T[],
): T[] {
  const picked: T[] = [];
  let currentCount = count;
  let currentKey = totalKey;

  while (currentCount > 0) {
    const state = dp[currentCount].get(currentKey);
    if (!state || state.pickedIndex < 0) {
      break;
    }

    picked.push(candidates[state.pickedIndex]);
    currentKey = state.previousTotalKey;
    currentCount = state.previousCount;
  }

  return picked.reverse();
}

export function selectRankedSongsForDurationDetailed<T extends DurationSelectionCandidate>(
  candidates: T[],
  options: DurationSelectionOptions,
): { selected: T[]; debug: DurationSelectionDebug<T> } {
  const targetSec = Math.max(1, Math.round(options.targetSec));
  const overshootToleranceSec = Math.max(0, Math.round(options.overshootToleranceSec));
  const maxSongs = Math.max(1, options.maxSongs);
  const topCandidates = candidates
    .filter((candidate) => candidate.durationSec > 0)
    .slice(0, Math.max(1, options.candidateLimit));

  const emptyDebug: DurationSelectionDebug<T> = {
    targetSec,
    candidateLimit: Math.max(1, options.candidateLimit),
    maxSongs,
    overshootToleranceSec,
    topCandidates: topCandidates.slice(0, 10),
    consideredCombinations: [],
    selectedCombination: null,
  };

  if (topCandidates.length === 0) {
    return { selected: [], debug: emptyDebug };
  }

  const stepSec = 5;
  const maxTotalSec = Math.max(
    targetSec,
    Math.min(
      topCandidates.reduce((sum, candidate) => sum + candidate.durationSec, 0),
      targetSec + overshootToleranceSec,
    ),
  );
  const maxTotalKey = Math.max(1, Math.ceil(maxTotalSec / stepSec));
  const dp: Array<Map<number, DurationState>> = Array.from(
    { length: maxSongs + 1 },
    () => new Map<number, DurationState>(),
  );

  dp[0].set(0, {
    sumScore: 0,
    actualTotalSec: 0,
    previousTotalKey: -1,
    previousCount: -1,
    pickedIndex: -1,
  });

  topCandidates.forEach((candidate, candidateIndex) => {
    const durationKey = Math.max(1, Math.round(candidate.durationSec / stepSec));

    for (let count = maxSongs - 1; count >= 0; count -= 1) {
      const states = Array.from(dp[count].entries());
      for (const [totalKey, state] of states) {
        const nextTotalKey = totalKey + durationKey;
        const nextTotalSec = state.actualTotalSec + candidate.durationSec;
        if (nextTotalKey > maxTotalKey || nextTotalSec > maxTotalSec) {
          continue;
        }

        const nextSumScore = state.sumScore + candidate.appraisalScore;
        const existing = dp[count + 1].get(nextTotalKey);
        if (!existing || nextSumScore > existing.sumScore) {
          dp[count + 1].set(nextTotalKey, {
            sumScore: nextSumScore,
            actualTotalSec: nextTotalSec,
            previousTotalKey: totalKey,
            previousCount: count,
            pickedIndex: candidateIndex,
          });
        }
      }
    }
  });

  let bestCount = 0;
  let bestTotalKey = 0;
  let bestObjective = Number.NEGATIVE_INFINITY;

  for (let count = 1; count <= maxSongs; count += 1) {
    for (const [totalKey, state] of dp[count].entries()) {
      const objective = scoreDurationSelection(
        state.sumScore,
        state.actualTotalSec,
        count,
        targetSec,
        options.preferFewerSongs ?? false,
      );
      if (objective > bestObjective) {
        bestObjective = objective;
        bestCount = count;
        bestTotalKey = totalKey;
      }
    }
  }

  const consideredCombinations = [];
  for (let count = 1; count <= maxSongs; count += 1) {
    for (const [totalKey] of dp[count].entries()) {
      const songs = reconstructDurationSelection(dp, count, totalKey, topCandidates);
      if (songs.length === 0) {
        continue;
      }
      consideredCombinations.push(
        buildDurationCombination(songs, targetSec, options.preferFewerSongs ?? false),
      );
    }
  }

  consideredCombinations.sort((a, b) => b.objective - a.objective);

  const fallbackSelected = [topCandidates[0]];
  const selected =
    bestCount === 0
      ? fallbackSelected
      : reconstructDurationSelection(dp, bestCount, bestTotalKey, topCandidates);
  const selectedCombination = buildDurationCombination(
    selected,
    targetSec,
    options.preferFewerSongs ?? false,
  );

  return {
    selected,
    debug: {
      ...emptyDebug,
      consideredCombinations: consideredCombinations.slice(0, 10),
      selectedCombination,
    },
  };
}

export function selectRankedSongsForDuration<T extends DurationSelectionCandidate>(
  candidates: T[],
  options: DurationSelectionOptions,
): T[] {
  return selectRankedSongsForDurationDetailed(candidates, options).selected;
}

export function createDurationSelectionOptions(
  targetSec: number,
  profile: DurationSelectionProfile,
): DurationSelectionOptions {
  const safeTargetSec = Math.max(60, Math.round(targetSec));
  const baseOptions: DurationSelectionOptions = {
    targetSec: safeTargetSec,
    candidateLimit: 90,
    maxSongs: Math.max(1, Math.min(20, Math.ceil(safeTargetSec / 90))),
    overshootToleranceSec: Math.max(90, Math.round(safeTargetSec * 0.12)),
  };

  if (profile === "replacement") {
    return {
      ...baseOptions,
      maxSongs: Math.max(1, Math.min(baseOptions.maxSongs, 12)),
      preferFewerSongs: true,
    };
  }

  return baseOptions;
}

export function runEdasRanking(
  candidates: SongCandidate[],
  preferences: PreferenceResult,
  options?: { debug?: boolean },
): EdasScoreRow[] {
  if (candidates.length === 0) {
    return [];
  }

  const { activeParameters } = preferences;

  if (activeParameters.length === 0) {
    return candidates.map((candidate) => ({
      candidate,
      sp: 0,
      sn: 0,
      nsp: 0,
      nsn: 0,
      appraisalScore: 0,
      debug: options?.debug ? { parameters: [] } : undefined,
    }));
  }

  const criterionStats = calculateCriterionStats(candidates, activeParameters);

  const rows = candidates.map((candidate) => {
    let sp = 0;
    let sn = 0;
    const parameterDebug: EdasParameterDebug[] = [];

    for (const parameter of activeParameters) {
      const weight = preferences.weights[parameter] ?? 0;
      const criterion = preferences.criteria[parameter];
      if (!criterion) continue;

      const value = normalizeValue(candidate[parameter]);
      const { average, averageDeviation } = criterionStats[parameter];

      const { pda, nda } = computePdaNda(value, average, criterion);

      sp += weight * pda;
      sn += weight * nda;

      if (options?.debug) {
        parameterDebug.push({
          parameter,
          value,
          average: Number(average.toFixed(6)),
          averageDeviation: Number(averageDeviation.toFixed(6)),
          weight,
          criterion,
          pda: Number(pda.toFixed(6)),
          nda: Number(nda.toFixed(6)),
          weightedPda: Number((weight * pda).toFixed(6)),
          weightedNda: Number((weight * nda).toFixed(6)),
        });
      }
    }

    return {
      candidate,
      sp,
      sn,
      nsp: 0,
      nsn: 0,
      appraisalScore: 0,
      debug: options?.debug ? { parameters: parameterDebug } : undefined,
    };
  });

  const spList = rows.map((row) => row.sp);
  const snList = rows.map((row) => row.sn);

  const { nsp: nspList, nsn: nsnList } = normalizeSpSn(spList, snList);

  return rows
    .map((row, index) => {
      const nsp = nspList[index];
      const nsn = nsnList[index];
      const appraisalScore = Number(((nsp + nsn) / 2).toFixed(6));
      return {
        ...row,
        sp: Number(row.sp.toFixed(6)),
        sn: Number(row.sn.toFixed(6)),
        nsp: Number(nsp.toFixed(6)),
        nsn: Number(nsn.toFixed(6)),
        appraisalScore,
      };
    })
    .sort((a, b) => b.appraisalScore - a.appraisalScore);
}

export function buildEdasDebugSummary(
  ranked: EdasScoreRow[],
  limit = 10,
): EdasSongDebug[] {
  return ranked.slice(0, Math.max(1, limit)).map((row, index) => ({
    rank: index + 1,
    id_song: row.candidate.id_song,
    title: row.candidate.title,
    artist: row.candidate.artist,
    durationSec: Math.max(0, Math.round(row.candidate.duration_ms / 1000)),
    parameters: row.debug?.parameters ?? [],
    sp: row.sp,
    sn: row.sn,
    nsp: row.nsp,
    nsn: row.nsn,
    appraisalScore: row.appraisalScore,
  }));
}

export function buildPlaylistFromRanking(
  ranked: EdasScoreRow[],
  targetMinutes: number,
): EdasRankedSong[] {
  const targetSec = Math.max(60, Math.round(targetMinutes * 60));
  // dedup id_song sebelum DP — normalisasi pake String() karena PG bisa balikin string
  const seenIds = new Set<string>();
  const rankedItems = ranked
    .filter((row) => {
      const id = row.candidate.id_song;
      if (id == null) return true;
      const key = String(id);
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    })
    .map((row) => {
      const candidate = row.candidate;
      return {
        id_song: candidate.id_song,
        title: candidate.title,
        artist: candidate.artist,
        durationSec: Math.max(0, Math.round(candidate.duration_ms / 1000)),
        appraisalScore: row.appraisalScore,
      };
    })
    .filter((item) => item.durationSec > 0);

  const selected = selectRankedSongsForDuration(
    rankedItems,
    createDurationSelectionOptions(targetSec, "playlist"),
  );

  // safety dedup final + backfill (tanpa rank, rank di-set di map akhir)
  const finalSeen = new Set<string>();
  const picked: DurationSelectionCandidate[] = [];

  for (const item of selected) {
    const key = item.id_song != null ? String(item.id_song) : `_${item.title}_${item.artist}`;
    if (!finalSeen.has(key)) {
      finalSeen.add(key);
      picked.push(item);
    }
  }

  // backfill dari rankedItems berikutnya kalau durasi masih kurang dari target
  const finalTotal = picked.reduce((s, i) => s + i.durationSec, 0);
  if (finalTotal < targetSec * 0.9) {
    for (const candidate of rankedItems) {
      if (picked.length >= 20) break;
      const key = candidate.id_song != null ? String(candidate.id_song) : `_${candidate.title}_${candidate.artist}`;
      if (!finalSeen.has(key)) {
        finalSeen.add(key);
        picked.push(candidate);
        if (picked.reduce((s, i) => s + i.durationSec, 0) >= targetSec) break;
      }
    }
  }

  return picked.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));
}
