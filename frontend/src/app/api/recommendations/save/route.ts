// NextResponse buat response api, createHash buat fingerprint sesi, sql buat database
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import sql from "@/server/db";

// data yang dikirim pas nyimpen rekomendasi
type SaveRequest = {
  clientId?: string;
  context?: {
    activity?: string;
    time_category?: string;
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

// data yang dihash buat deteksi duplikasi sesi
type FingerprintInput = {
  context: {
    activity: string;
    time_category: string;
    mood: string;
    durationMinutes: number;
  };
  answers: number[];
  playlist: Array<{
    id_song: number;
    rank: number;
  }>;
};

// normalisasi jawaban kuesioner sebelum disimpen
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

// bikin fingerprint sesi biar ga dobel
function computeFingerprint(input: FingerprintInput) {
  const payload = JSON.stringify(input);
  return createHash("sha256").update(payload).digest("hex");
}

// simpen hasil rekomendasi ke database
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
    const timeCategory = (context.time_category ?? context.timeOfDay ?? "").trim();
    const mood = context.mood?.trim() ?? "";
    const durationTarget = Number(context.durationMinutes ?? 0);

    if (!activity || !timeCategory || !mood || !Number.isFinite(durationTarget) || durationTarget <= 0) {
      return NextResponse.json({ error: "Context tidak valid." }, { status: 400 });
    }

    // Validasi context value ke tabel context_option
    const validContexts = await sql<{ category: string; value: string }[]>`
      SELECT category, value FROM context_option
      WHERE is_active = true
        AND (
          (category = 'activity' AND value = ${activity})
          OR (category = 'time_category' AND value = ${timeCategory})
          OR (category = 'mood' AND value = ${mood})
        )
    `;

    const validSet = new Set(validContexts.map((r) => `${r.category}:${r.value}`));
    const contextErrors: string[] = [];
    if (!validSet.has(`activity:${activity}`)) contextErrors.push(`activity "${activity}"`);
    if (!validSet.has(`time_category:${timeCategory}`)) contextErrors.push(`time_category "${timeCategory}"`);
    if (!validSet.has(`mood:${mood}`)) contextErrors.push(`mood "${mood}"`);

    if (contextErrors.length > 0) {
      return NextResponse.json(
        { error: `Nilai konteks tidak valid: ${contextErrors.join(", ")}.` },
        { status: 400 },
      );
    }

    const normalizedPlaylist = playlist.map((item) => ({
      id_song: Number(item.id_song),
      rank_order: Number(item.rank),
      appraisal_score: Number(item.appraisalScore),
    }));

    // bikin fingerprint biar ga dobel
    const fingerprintPayload: FingerprintInput = {
      context: {
        activity,
        time_category: timeCategory,
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

    // cek apa ada sesi dengan fingerprint yang sama dalam 2 menit terakhir
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

    // masukin sesi baru ke recommendation_session
    const insertedSessions = await sql<{ id_session: number }[]>`
      insert into recommendation_session (client_id, activity, time_category, mood, duration_target, fingerprint)
      values (${clientId}, ${activity}, ${timeCategory}, ${mood}, ${durationTarget}, ${fingerprint})
      returning id_session
    `;

    const sessionId = insertedSessions[0]?.id_session;
    if (!sessionId) {
      return NextResponse.json({ error: "Gagal menyimpan sesi rekomendasi." }, { status: 500 });
    }

    // masukin lagu hasil rekomendasi ke recommendation_song
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
