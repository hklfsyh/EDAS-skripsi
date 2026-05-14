import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import sql from "@/server/db";

type SaveRequest = {
  clientId?: string;
  context?: {
    activity?: string;
    timeOfDay?: string;
    mood?: string;
    durationMinutes?: number;
  };
  answers?: number[] | Record<number, number>;
  playlist?: Array<{
    id_song?: number;
    rank?: number;
    appraisalScore?: number;
  }>;
};

type FingerprintInput = {
  context: {
    activity: string;
    timeOfDay: string;
    mood: string;
    durationMinutes: number;
  };
  answers: number[];
  playlist: Array<{
    id_song: number;
    rank: number;
  }>;
};

function normalizeAnswers(raw?: number[] | Record<number, number>) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(Number);
  }

  return Object.keys(raw)
    .map(Number)
    .sort((a, b) => a - b)
    .map((key) => Number(raw[key]));
}

function computeFingerprint(input: FingerprintInput) {
  const payload = JSON.stringify(input);
  return createHash("sha256").update(payload).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveRequest;
    const clientId = body.clientId?.trim();
    const context = body.context;
    const playlist = body.playlist ?? [];
    const answers = normalizeAnswers(body.answers);

    if (!clientId || !context || playlist.length === 0) {
      return NextResponse.json({ error: "Payload tidak lengkap." }, { status: 400 });
    }

    const activity = context.activity?.trim() ?? "";
    const timeCategory = context.timeOfDay?.trim() ?? "";
    const mood = context.mood?.trim() ?? "";
    const durationTarget = Number(context.durationMinutes ?? 0);

    if (!activity || !timeCategory || !mood || !Number.isFinite(durationTarget) || durationTarget <= 0) {
      return NextResponse.json({ error: "Context tidak valid." }, { status: 400 });
    }

    const normalizedPlaylist = playlist.map((item) => ({
      id_song: Number(item.id_song),
      rank_order: Number(item.rank),
      appraisal_score: Number(item.appraisalScore),
    }));

    const fingerprintPayload: FingerprintInput = {
      context: {
        activity,
        timeOfDay: timeCategory,
        mood,
        durationMinutes: durationTarget,
      },
      answers,
      playlist: normalizedPlaylist
        .map((item) => ({
          id_song: item.id_song,
          rank: item.rank_order,
        }))
        .sort((a, b) => a.rank - b.rank),
    };

    const fingerprint = computeFingerprint(fingerprintPayload);

    if (normalizedPlaylist.some((item) => !Number.isFinite(item.id_song) || item.id_song <= 0)) {
      return NextResponse.json({ error: "Playlist tidak menyertakan id_song yang valid." }, { status: 400 });
    }

    const lastSessions = await sql<{
      id_session: number;
      created_at: string;
    }[]>`
      select id_session, created_at
      from recommendation_session
      where client_id = ${clientId} and fingerprint = ${fingerprint}
      order by created_at desc
      limit 1
    `;

    const last = lastSessions[0];
    if (last) {
      const lastCreated = new Date(last.created_at).getTime();
      const now = Date.now();
      const isRecent = Number.isFinite(lastCreated) && now - lastCreated < 2 * 60 * 1000;
      if (isRecent) {
        return NextResponse.json({
          status: "ok",
          id_session: last.id_session,
          deduped: true,
        });
      }
    }

    const insertedSessions = await sql<{ id_session: number }[]>`
      insert into recommendation_session (client_id, activity, time_category, mood, duration_target, fingerprint)
      values (${clientId}, ${activity}, ${timeCategory}, ${mood}, ${durationTarget}, ${fingerprint})
      returning id_session
    `;

    const sessionId = insertedSessions[0]?.id_session;
    if (!sessionId) {
      return NextResponse.json({ error: "Gagal menyimpan sesi rekomendasi." }, { status: 500 });
    }

    const songRows = normalizedPlaylist.map((item) => ({
      id_session: sessionId,
      id_song: item.id_song,
      rank_order: item.rank_order,
      appraisal_score: item.appraisal_score,
    }));

    await sql`
      insert into recommendation_song ${sql(songRows, "id_session", "id_song", "rank_order", "appraisal_score")}
      on conflict (id_session, id_song) do nothing
    `;

    return NextResponse.json({ status: "ok", id_session: sessionId, deduped: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
