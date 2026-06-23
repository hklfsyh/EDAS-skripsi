import { NextResponse } from "next/server";
import { getSpotifyProjectAccessToken } from "@/lib/spotify";

type ExportTrack = {
  title: string;
  artist: string;
};

type ExportRequestBody = {
  playlistName: string;
  tracks: ExportTrack[];
};

type AddTrackFailure = {
  uri: string;
  status: number;
  detail: string;
};

const MAX_EXPORT_TRACKS = 50;
const SEARCH_CONCURRENCY = 5;

async function getResponseTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

// cari uri track spotify dari judul + artis
async function spotifySearchTrackUri(track: ExportTrack, accessToken: string): Promise<string | null> {
  const queries = [
    `track:"${track.title}" artist:"${track.artist}"`,
    `${track.title} ${track.artist}`,
    `track:"${track.title}"`,
  ];

  for (const query of queries) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "1",
    });

    const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      tracks?: { items?: Array<{ uri: string }> };
    };

    const uri = payload.tracks?.items?.[0]?.uri;
    if (uri) {
      return uri;
    }
  }

  return null;
}

// tambahin track ke playlist spotify
async function spotifyAddTracks(
  playlistId: string,
  uris: string[],
  accessToken: string,
): Promise<{ addedUris: string[]; failedUris: AddTrackFailure[] }> {
  const addedUris: string[] = [];
  const failedUris: AddTrackFailure[] = [];

  for (let index = 0; index < uris.length; index += 100) {
    const chunk = uris.slice(index, index + 100);
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: chunk }),
    });

    if (!response.ok) {
      if (response.status !== 403 || chunk.length === 1) {
        const detail = await getResponseTextSafe(response);
        throw new Error(`spotify_add_tracks_failed:${response.status}:${detail}`);
      }

      for (const uri of chunk) {
        const singleResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [uri] }),
        });

        if (singleResponse.ok) {
          addedUris.push(uri);
        } else {
          const singleDetail = await getResponseTextSafe(singleResponse);
          failedUris.push({
            uri,
            status: singleResponse.status,
            detail: singleDetail,
          });
        }
      }

      continue;
    }

    addedUris.push(...chunk);
  }

  return { addedUris, failedUris };
}

// resolve uri buat semua track yang mau diexport
async function resolveTrackUris(
  tracks: ExportTrack[],
  accessToken: string,
): Promise<{ foundUris: string[]; missingTracks: ExportTrack[] }> {
  const foundUris: string[] = [];
  const missingTracks: ExportTrack[] = [];

  for (let index = 0; index < tracks.length; index += SEARCH_CONCURRENCY) {
    const chunk = tracks.slice(index, index + SEARCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (track) => {
        const uri = await spotifySearchTrackUri(track, accessToken);
        return { track, uri };
      }),
    );

    for (const item of chunkResults) {
      if (item.uri) {
        foundUris.push(item.uri);
      } else {
        missingTracks.push(item.track);
      }
    }
  }

  return { foundUris, missingTracks };
}

// ============================================================
// EXPORT PAKE AKUN PROJECT (server-side, kalskripdas@gmail.com)
// token dari env, bukan cookie oauth user
// ============================================================

function formatPlaylistTitle(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `Rekomendasi Playlist - ${dd}/${mm}/${yyyy}`;
}

export type ProjectExportResponse = {
  status: "success" | "error";
  platform: "spotify" | "youtube";
  title: string | null;
  publicUrl: string | null;
  error: string | null;
};

// bikin playlist publik di akun project spotify
async function spotifyCreatePublicPlaylist(playlistName: string, accessToken: string): Promise<{ id: string; external_urls?: { spotify?: string } }> {
  const response = await fetch("https://api.spotify.com/v1/me/playlists", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: playlistName,
      description: "Playlist rekomendasi hasil metode EDAS.",
      public: true,
    }),
  });

  if (!response.ok) {
    const detail = await getResponseTextSafe(response);
    throw new Error(`spotify_create_playlist_failed:${response.status}:${detail}`);
  }

  return (await response.json()) as { id: string; external_urls?: { spotify?: string } };
}

export async function handleSpotifyProjectExport(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ExportRequestBody;
    if (!Array.isArray(body.tracks) || body.tracks.length === 0) {
      return NextResponse.json(
        { status: "error", platform: "spotify", title: null, publicUrl: null, error: "Payload export tidak valid." },
        { status: 400 },
      );
    }

    const sanitizedTracks = body.tracks
      .filter((t) => t?.title?.trim() && t?.artist?.trim())
      .slice(0, MAX_EXPORT_TRACKS)
      .map((t) => ({ title: t.title.trim(), artist: t.artist.trim() }));

    if (sanitizedTracks.length === 0) {
      return NextResponse.json(
        { status: "error", platform: "spotify", title: null, publicUrl: null, error: "Daftar lagu kosong setelah validasi." },
        { status: 400 },
      );
    }

    const accessToken = await getSpotifyProjectAccessToken();
    const playlistName = body.playlistName?.trim() || formatPlaylistTitle();
    const playlist = await spotifyCreatePublicPlaylist(playlistName, accessToken);

    const { foundUris, missingTracks } = await resolveTrackUris(sanitizedTracks, accessToken);

    const addResult = foundUris.length > 0
      ? await spotifyAddTracks(playlist.id, foundUris, accessToken)
      : { addedUris: [] as string[], failedUris: [] as AddTrackFailure[] };
    const { addedUris } = addResult;

    const publicUrl = playlist.external_urls?.spotify ?? null;

    return NextResponse.json({
      status: "success",
      platform: "spotify",
      title: playlistName,
      publicUrl,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    const spotifyStatusMatch = /spotify_[^:]+_failed:(\d+):/.exec(message);
    if (spotifyStatusMatch) {
      const status = Number(spotifyStatusMatch[1]);
      return NextResponse.json(
        { status: "error", platform: "spotify", title: null, publicUrl: null, error: message },
        { status: Number.isFinite(status) ? status : 500 },
      );
    }

    if (message.includes("SPOTIFY_PROJECT_REFRESH_TOKEN")) {
      return NextResponse.json(
        { status: "error", platform: "spotify", title: null, publicUrl: null, error: "Token project Spotify belum dikonfigurasi." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { status: "error", platform: "spotify", title: null, publicUrl: null, error: message },
      { status: 500 },
    );
  }
}
