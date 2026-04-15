import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type CsvTrack = {
  artist: string;
  title: string;
  durationSec: number;
  popularity: number;
};

type PlaylistItem = {
  rank: number;
  title: string;
  artist: string;
  durationSec: number;
  appraisalScore: number;
};

function parseDurationToSeconds(durationRaw: string): number {
  const [minutes, seconds] = durationRaw.trim().split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return 0;
  }
  return minutes * 60 + seconds;
}

function parseCsvRows(csvText: string): CsvTrack[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  const artistIndex = headers.indexOf("artist");
  const titleIndex = headers.indexOf("title");
  const durationIndex = headers.indexOf("duration");
  const statusIndex = headers.indexOf("status");
  const popularityIndex = headers.indexOf("popularity");

  if (
    artistIndex === -1 ||
    titleIndex === -1 ||
    durationIndex === -1 ||
    statusIndex === -1 ||
    popularityIndex === -1
  ) {
    throw new Error("Kolom wajib di output.csv tidak lengkap.");
  }

  const tracks: CsvTrack[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = lines[lineIndex].split(",");
    if (values.length !== headers.length) {
      continue;
    }

    const status = values[statusIndex].trim().toLowerCase();
    if (status !== "ok") {
      continue;
    }

    const durationSec = parseDurationToSeconds(values[durationIndex]);
    if (durationSec <= 0) {
      continue;
    }

    tracks.push({
      artist: values[artistIndex].trim(),
      title: values[titleIndex].trim(),
      durationSec,
      popularity: Number(values[popularityIndex]) || 0,
    });
  }

  return tracks;
}

function shuffleTracks(tracks: CsvTrack[]): CsvTrack[] {
  const shuffled = [...tracks];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function buildPlaylistFromCsv(tracks: CsvTrack[], targetMinutes: number): PlaylistItem[] {
  const shuffledTracks = shuffleTracks(tracks);
  const targetSec = Math.max(15, targetMinutes) * 60;
  const maxItems = Math.min(50, shuffledTracks.length);
  const items: PlaylistItem[] = [];
  let totalSec = 0;
  let index = 0;

  while (index < maxItems && totalSec < targetSec) {
    const track = shuffledTracks[index];
    const appraisalScore = Number((Math.max(0, track.popularity) / 100).toFixed(4));

    items.push({
      rank: index + 1,
      title: track.title,
      artist: track.artist,
      durationSec: track.durationSec,
      appraisalScore,
    });

    totalSec += track.durationSec;
    index += 1;
  }

  return items;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetMinutes = Number(searchParams.get("targetMinutes") ?? 30);
    const csvPath = path.resolve(process.cwd(), "..", "data", "output.csv");

    const csvText = await readFile(csvPath, "utf-8");
    const tracks = parseCsvRows(csvText);
    const playlist = buildPlaylistFromCsv(tracks, Number.isFinite(targetMinutes) ? targetMinutes : 30);

    return NextResponse.json({
      source: csvPath,
      totalTracks: tracks.length,
      playlist,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat playlist dummy dari data/output.csv" },
      { status: 500 },
    );
  }
}
