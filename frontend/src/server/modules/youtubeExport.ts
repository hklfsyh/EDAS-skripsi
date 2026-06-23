import { NextResponse } from "next/server";
import { getYouTubeProjectAccessToken } from "@/lib/youtube";

type ExportTrack = {
  title: string;
  artist: string;
};

type ExportRequestBody = {
  playlistName: string;
  tracks: ExportTrack[];
};

type AddVideoFailure = {
  videoId: string;
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

// cari video youtube dari judul + artis
async function youtubeSearchVideoId(track: ExportTrack, accessToken: string): Promise<string | null> {
  const queries = [`${track.title} ${track.artist}`, `${track.title}`];

  for (const query of queries) {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "1",
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      items?: Array<{ id?: { videoId?: string } }>;
    };

    const videoId = payload.items?.[0]?.id?.videoId;
    if (videoId) {
      return videoId;
    }
  }

  return null;
}

async function youtubeAddVideos(
  playlistId: string,
  videoIds: string[],
  accessToken: string,
): Promise<{ addedVideoIds: string[]; failedVideoIds: AddVideoFailure[] }> {
  const addedVideoIds: string[] = [];
  const failedVideoIds: AddVideoFailure[] = [];

  for (const videoId of videoIds) {
    const response = await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await getResponseTextSafe(response);
      failedVideoIds.push({
        videoId,
        status: response.status,
        detail,
      });
      continue;
    }

    addedVideoIds.push(videoId);
  }

  return { addedVideoIds, failedVideoIds };
}

async function resolveVideoIds(
  tracks: ExportTrack[],
  accessToken: string,
): Promise<{ foundVideoIds: string[]; missingTracks: ExportTrack[] }> {
  const foundVideoIds: string[] = [];
  const missingTracks: ExportTrack[] = [];

  for (let index = 0; index < tracks.length; index += SEARCH_CONCURRENCY) {
    const chunk = tracks.slice(index, index + SEARCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (track) => {
        const videoId = await youtubeSearchVideoId(track, accessToken);
        return { track, videoId };
      }),
    );

    for (const item of chunkResults) {
      if (item.videoId) {
        foundVideoIds.push(item.videoId);
      } else {
        missingTracks.push(item.track);
      }
    }
  }

  return { foundVideoIds, missingTracks };
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

// bikin playlist publik di akun project youtube
async function youtubeCreatePublicPlaylist(playlistName: string, accessToken: string): Promise<{ id: string }> {
  const response = await fetch("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        title: playlistName,
        description: "Playlist rekomendasi hasil metode EDAS.",
      },
      status: {
        privacyStatus: "public",
      },
    }),
  });

  if (!response.ok) {
    const detail = await getResponseTextSafe(response);
    throw new Error(`youtube_create_playlist_failed:${response.status}:${detail}`);
  }

  return (await response.json()) as { id: string };
}

export async function handleYouTubeProjectExport(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ExportRequestBody;
    if (!Array.isArray(body.tracks) || body.tracks.length === 0) {
      return NextResponse.json(
        { status: "error", platform: "youtube", title: null, publicUrl: null, error: "Payload export YouTube tidak valid." },
        { status: 400 },
      );
    }

    const sanitizedTracks = body.tracks
      .filter((t) => t?.title?.trim() && t?.artist?.trim())
      .slice(0, MAX_EXPORT_TRACKS)
      .map((t) => ({ title: t.title.trim(), artist: t.artist.trim() }));

    if (sanitizedTracks.length === 0) {
      return NextResponse.json(
        { status: "error", platform: "youtube", title: null, publicUrl: null, error: "Daftar lagu kosong setelah validasi." },
        { status: 400 },
      );
    }

    const accessToken = await getYouTubeProjectAccessToken();
    const playlistName = body.playlistName?.trim() || formatPlaylistTitle();
    const playlist = await youtubeCreatePublicPlaylist(playlistName, accessToken);

    const { foundVideoIds } = await resolveVideoIds(sanitizedTracks, accessToken);

    const addResult = foundVideoIds.length > 0
      ? await youtubeAddVideos(playlist.id, foundVideoIds, accessToken)
      : { addedVideoIds: [] as string[], failedVideoIds: [] as AddVideoFailure[] };
    const { addedVideoIds } = addResult;

    const publicUrl = `https://www.youtube.com/playlist?list=${playlist.id}`;

    return NextResponse.json({
      status: "success",
      platform: "youtube",
      title: playlistName,
      publicUrl,
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";

    const youtubeStatusMatch = /youtube_[^:]+_failed:(\d+):/.exec(message);
    if (youtubeStatusMatch) {
      const status = Number(youtubeStatusMatch[1]);

      if (message.includes("youtubeSignupRequired")) {
        return NextResponse.json(
          {
            status: "error",
            platform: "youtube",
            title: null,
            publicUrl: null,
            error: "Akun Google (kalskripdas@gmail.com) belum memiliki channel YouTube. Buat channel di youtube.com, lalu pastikan YouTube Data API v3 sudah diaktifkan di Google Cloud Console.",
          },
          { status: 401 },
        );
      }

      return NextResponse.json(
        { status: "error", platform: "youtube", title: null, publicUrl: null, error: message },
        { status: Number.isFinite(status) ? status : 500 },
      );
    }

    if (message.includes("YOUTUBE_PROJECT_REFRESH_TOKEN")) {
      return NextResponse.json(
        { status: "error", platform: "youtube", title: null, publicUrl: null, error: "Token project YouTube belum dikonfigurasi." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { status: "error", platform: "youtube", title: null, publicUrl: null, error: message },
      { status: 500 },
    );
  }
}
