import { NextResponse } from "next/server";

import sql from "@/server/db";

// Ambil riwayat rekomendasi berdasarkan client_id
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId")?.trim();

    if (!clientId) {
      return NextResponse.json({ error: "clientId wajib diisi." }, { status: 400 });
    }

    const sessions = await sql<{
      id_session: number;
      activity: string;
      time_category: string;
      mood: string;
      duration_target: number;
      created_at: string;
    }[]>`
      select id_session, activity, time_category, mood, duration_target, created_at
      from recommendation_session
      where client_id = ${clientId}
      order by created_at desc
      limit 5
    `;

    if (sessions.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const sessionIds = sessions.map((session) => session.id_session);

    const songs = await sql<{
      id_session: number;
      id_song: number;
      rank_order: number;
      appraisal_score: number;
      title: string;
      artist: string;
    }[]>`
      select rs.id_session, rs.id_song, rs.rank_order, rs.appraisal_score, s.title, s.artist
      from recommendation_song rs
      join songs s on s.id_song = rs.id_song
      where rs.id_session in ${sql(sessionIds)}
      order by rs.id_session desc, rs.rank_order asc
    `;

    // Mapping lagu ke sesi rekomendasi
    const songMap = new Map<number, (typeof songs)[number][]>();
    for (const song of songs) {
      const existing = songMap.get(song.id_session);
      if (existing) {
        existing.push(song);
      } else {
        songMap.set(song.id_session, [song]);
      }
    }

    const history = sessions.map((session) => ({
      ...session,
      songs: songMap.get(session.id_session) ?? [],
    }));

    return NextResponse.json({ history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
