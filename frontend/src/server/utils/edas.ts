import type { PreferenceParameter, PreferenceResult } from "@/server/utils/preferenceMapping";

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

type ScoreRow = {
  candidate: SongCandidate;
  sp: number;
  sn: number;
  nsp: number;
  nsn: number;
  appraisalScore: number;
};

// Daftar parameter audio untuk perhitungan EDAS
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

// Hitung average solution dan average deviation
function calculateCriterionStats(candidates: SongCandidate[]): Record<PreferenceParameter, CriterionStats> {
  const stats = {} as Record<PreferenceParameter, CriterionStats>;

  for (const parameter of PARAMETERS) {
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

// Perhitungan PDA dan NDA untuk benefit/cost
function computePdaNda(
  value: number,
  average: number,
  criterion: "benefit" | "cost",
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

// Perhitungan PDA/NDA untuk kriteria netral
function computeNeutralPdaNda(value: number, averageDeviation: number, average: number) {
  const deviation = Math.abs(value - average);
  if (!Number.isFinite(averageDeviation) || averageDeviation === 0) {
    return { pda: 0, nda: 0 };
  }

  return {
    pda: Math.max(0, (averageDeviation - deviation) / averageDeviation),
    nda: Math.max(0, (deviation - averageDeviation) / averageDeviation),
  };
}

// Normalisasi SP dan SN
function normalizeSpSn(spValues: number[], snValues: number[]) {
  const maxSp = Math.max(...spValues);
  const maxSn = Math.max(...snValues);

  const nsp = spValues.map((value) => (maxSp > 0 ? value / maxSp : 0));
  const nsn = snValues.map((value) => (maxSn > 0 ? 1 - value / maxSn : 1));

  return { nsp, nsn, maxSp, maxSn };
}

export function runEdasRanking(
  candidates: SongCandidate[],
  preferences: PreferenceResult,
): ScoreRow[] {
  // Perhitungan appraisal score dan ranking EDAS
  if (candidates.length === 0) {
    return [];
  }

  const criterionStats = calculateCriterionStats(candidates);

  const rows = candidates.map((candidate) => {
    let sp = 0;
    let sn = 0;

    for (const parameter of PARAMETERS) {
      // Agregasi PDA/NDA berbobot
      const weight = preferences.weights[parameter] ?? 0;
      const criterion = preferences.criteria[parameter] ?? "neutral";
      const value = normalizeValue(candidate[parameter]);
      const { average, averageDeviation } = criterionStats[parameter];

      let pda = 0;
      let nda = 0;

      if (criterion === "neutral") {
        ({ pda, nda } = computeNeutralPdaNda(value, averageDeviation, average));
      } else {
        ({ pda, nda } = computePdaNda(value, average, criterion));
      }

      sp += weight * pda;
      sn += weight * nda;
    }

    return {
      candidate,
      sp,
      sn,
      nsp: 0,
      nsn: 0,
      appraisalScore: 0,
    };
  });

  const spList = rows.map((row) => row.sp);
  const snList = rows.map((row) => row.sn);

  const { nsp: nspList, nsn: nsnList } = normalizeSpSn(spList, snList);

  return rows
    .map((row, index) => {
      // Appraisal score final
      const nsp = nspList[index];
      const nsn = nsnList[index];
      const appraisalScore = Number(((nsp + nsn) / 2).toFixed(6));
      return {
        ...row,
        nsp,
        nsn,
        appraisalScore,
      };
    })
    .sort((a, b) => b.appraisalScore - a.appraisalScore);
}

export function buildPlaylistFromRanking(
  ranked: ScoreRow[],
  targetMinutes: number,
): EdasRankedSong[] {
  // Pembentukan playlist berdasarkan target durasi
  const targetSec = Math.max(15, targetMinutes) * 60;
  const items: EdasRankedSong[] = [];
  let totalSec = 0;

  for (const row of ranked) {
    if (totalSec >= targetSec) {
      break;
    }

    const candidate = row.candidate;
    const durationSec = Math.max(0, Math.round(candidate.duration_ms / 1000));
    if (durationSec <= 0) {
      continue;
    }

    items.push({
      rank: items.length + 1,
      id_song: candidate.id_song,
      title: candidate.title,
      artist: candidate.artist,
      durationSec,
      appraisalScore: row.appraisalScore,
    });

    totalSec += durationSec;
  }

  return items;
}
