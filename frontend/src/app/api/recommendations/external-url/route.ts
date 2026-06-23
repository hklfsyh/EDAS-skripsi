// NextResponse buat kirim response api, sql buat query database
import { NextResponse } from "next/server";
import sql from "@/server/db";

// platform yang didukung cuma spotify sama youtube
const VALID_PLATFORMS = ["spotify", "youtube"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

// validasi platform
function isPlatform(value: string): value is Platform {
  return VALID_PLATFORMS.includes(value as Platform);
}

// ambil url playlist yang udah diexport buat sesi tertentu
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSession = searchParams.get("id_session");
    const platform = searchParams.get("platform");

    const id_session = Number(rawSession);

    if (!Number.isFinite(id_session) || id_session <= 0) {
      return NextResponse.json({ error: "id_session tidak valid." }, { status: 400 });
    }

    if (!platform || !isPlatform(platform)) {
      return NextResponse.json({ error: "Platform harus 'spotify' atau 'youtube'." }, { status: 400 });
    }

    // ambil url dari kolom sesuai platform (spotify/youtube)
    if (platform === "spotify") {
      const rows = await sql<Array<{ spotify_playlist_url: string | null; spotify_playlist_title: string | null; spotify_exported_at: string | null }>>`
        select spotify_playlist_url, spotify_playlist_title, spotify_exported_at
        from recommendation_session
        where id_session = ${id_session}
      `;
      const row = rows[0];
      return NextResponse.json({
        url: row?.spotify_playlist_url ?? null,
        title: row?.spotify_playlist_title ?? null,
        exportedAt: row?.spotify_exported_at ?? null,
      });
    }

    const rows = await sql<Array<{ youtube_playlist_url: string | null; youtube_playlist_title: string | null; youtube_exported_at: string | null }>>`
      select youtube_playlist_url, youtube_playlist_title, youtube_exported_at
      from recommendation_session
      where id_session = ${id_session}
    `;
    const row = rows[0];
    return NextResponse.json({
      url: row?.youtube_playlist_url ?? null,
      title: row?.youtube_playlist_title ?? null,
      exportedAt: row?.youtube_exported_at ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// simpan url playlist hasil export ke database
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id_session?: number;
      platform?: string;
      url?: string;
      title?: string;
    };

    const rawId = body.id_session;
    const platform = body.platform;
    const url = body.url;
    const title = body.title;

    if (!Number.isFinite(rawId) || (rawId as number) <= 0) {
      return NextResponse.json({ error: "id_session tidak valid." }, { status: 400 });
    }
    const id_session = rawId as number;

    if (!platform || !isPlatform(platform)) {
      return NextResponse.json({ error: "Platform harus 'spotify' atau 'youtube'." }, { status: 400 });
    }

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return NextResponse.json({ error: "URL wajib diisi." }, { status: 400 });
    }

    const sessions = await sql<{ id_session: number }[]>`
      select id_session from recommendation_session where id_session = ${id_session}
    `;

    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session tidak ditemukan." }, { status: 404 });
    }

    const trimmedUrl = url.trim();
    const trimmedTitle = title?.trim() ?? null;

    // update kolom sesuai platform tujuannya
    if (platform === "spotify") {
      await sql`
        update recommendation_session
        set spotify_playlist_url = ${trimmedUrl}, spotify_playlist_title = ${trimmedTitle}, spotify_exported_at = now()
        where id_session = ${id_session}
      `;
    } else {
      await sql`
        update recommendation_session
        set youtube_playlist_url = ${trimmedUrl}, youtube_playlist_title = ${trimmedTitle}, youtube_exported_at = now()
        where id_session = ${id_session}
      `;
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
