import { NextResponse } from "next/server";
import sql from "@/server/db";

type PlaylistItem = {
  id_song: number;
  rank: number;
  appraisalScore: number;
};

type UpdatePlaylistRequest = {
  id_session: number;
  playlist: PlaylistItem[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdatePlaylistRequest;
    const { id_session, playlist } = body;

    if (!Number.isFinite(id_session) || id_session <= 0) {
      return NextResponse.json({ error: "id_session tidak valid." }, { status: 400 });
    }

    if (!Array.isArray(playlist) || playlist.length === 0) {
      return NextResponse.json({ error: "Playlist tidak boleh kosong." }, { status: 400 });
    }

    const normalizedPlaylist: { id_song: number; rank: number; appraisalScore: number }[] = [];

    for (const item of playlist) {
      const idSong = Number(item.id_song);
      const rank = Number(item.rank);
      const appraisalScore = Number(item.appraisalScore);

      if (!Number.isFinite(idSong) || idSong <= 0) {
        return NextResponse.json({ error: "Setiap item playlist harus memiliki id_song valid." }, { status: 400 });
      }
      if (!Number.isFinite(rank) || rank <= 0) {
        return NextResponse.json({ error: "Setiap item playlist harus memiliki rank valid." }, { status: 400 });
      }
      if (!Number.isFinite(appraisalScore)) {
        return NextResponse.json({ error: "Setiap item playlist harus memiliki appraisalScore valid." }, { status: 400 });
      }

      normalizedPlaylist.push({ id_song: idSong, rank, appraisalScore });
    }

    const sessions = await sql<{ id_session: number }[]>`
      select id_session from recommendation_session where id_session = ${id_session}
    `;

    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });
    }

    await sql`delete from recommendation_song where id_session = ${id_session}`;

    const songRows = normalizedPlaylist.map((item) => ({
      id_session,
      id_song: item.id_song,
      rank_order: item.rank,
      appraisal_score: item.appraisalScore,
    }));

    await sql`
      insert into recommendation_song ${sql(songRows, "id_session", "id_song", "rank_order", "appraisal_score")}
    `;

    await sql`
      update recommendation_session set updated_at = now() where id_session = ${id_session}
    `;

    return NextResponse.json({ status: "ok", id_session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
