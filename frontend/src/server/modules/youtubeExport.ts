import { NextResponse } from "next/server";
import {
  refreshYouTubeToken,
  YOUTUBE_ACCESS_COOKIE,
  YOUTUBE_EXPIRES_COOKIE,
  YOUTUBE_REFRESH_COOKIE,
} from "@/lib/youtube";
import { readCookie } from "@/server/utils/cookies";

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

async function getValidAccessToken(request: Request): Promise<{
  accessToken: string;
  setCookies?: Array<{ name: string; value: string; maxAge: number }>;
}> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const accessToken = readCookie(cookieHeader, YOUTUBE_ACCESS_COOKIE);
  const refreshToken = readCookie(cookieHeader, YOUTUBE_REFRESH_COOKIE);
  const expiresAtRaw = readCookie(cookieHeader, YOUTUBE_EXPIRES_COOKIE);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

  if (accessToken && expiresAt > Date.now()) {
    return { accessToken };
  }

  if (!refreshToken) {
    throw new Error("not_authenticated");
  }

  const refreshed = await refreshYouTubeToken(refreshToken);
  const nextCookies: Array<{ name: string; value: string; maxAge: number }> = [
    {
      name: YOUTUBE_ACCESS_COOKIE,
      value: refreshed.access_token,
      maxAge: refreshed.expires_in,
    },
    {
      name: YOUTUBE_EXPIRES_COOKIE,
      value: String(Date.now() + refreshed.expires_in * 1000),
      maxAge: refreshed.expires_in,
    },
  ];

  if (refreshed.refresh_token) {
    nextCookies.push({
      name: YOUTUBE_REFRESH_COOKIE,
      value: refreshed.refresh_token,
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return {
    accessToken: refreshed.access_token,
    setCookies: nextCookies,
  };
}

async function youtubeCreatePlaylist(playlistName: string, accessToken: string): Promise<{ id: string }> {
  const response = await fetch("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        title: playlistName,
        description: "Eksperimen export playlist dari hasil dummy EDAS.",
      },
      status: {
        privacyStatus: "private",
      },
    }),
  });

  if (!response.ok) {
    const detail = await getResponseTextSafe(response);
    throw new Error(`youtube_create_playlist_failed:${response.status}:${detail}`);
  }

  return (await response.json()) as { id: string };
}

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

export async function handleYouTubeExportPost(request: Request) {
  try {
    const body = (await request.json()) as ExportRequestBody;
    if (!body.playlistName || !Array.isArray(body.tracks) || body.tracks.length === 0) {
      return NextResponse.json({ error: "Payload export YouTube tidak valid." }, { status: 400 });
    }

    const sanitizedTracks = body.tracks
      .filter((track) => track?.title?.trim() && track?.artist?.trim())
      .slice(0, MAX_EXPORT_TRACKS)
      .map((track) => ({
        title: track.title.trim(),
        artist: track.artist.trim(),
      }));

    if (sanitizedTracks.length === 0) {
      return NextResponse.json({ error: "Daftar lagu kosong setelah validasi." }, { status: 400 });
    }

    const { accessToken, setCookies } = await getValidAccessToken(request);
    const playlist = await youtubeCreatePlaylist(body.playlistName, accessToken);

    const { foundVideoIds, missingTracks } = await resolveVideoIds(sanitizedTracks, accessToken);
    const { addedVideoIds, failedVideoIds } =
      foundVideoIds.length > 0
        ? await youtubeAddVideos(playlist.id, foundVideoIds, accessToken)
        : { addedVideoIds: [], failedVideoIds: [] as AddVideoFailure[] };

    if (foundVideoIds.length > 0 && addedVideoIds.length === 0 && failedVideoIds.length > 0) {
      return NextResponse.json(
        {
          error: "youtube_add_videos_all_failed",
          hint: "Playlist YouTube berhasil dibuat, tapi semua video gagal ditambahkan. Coba reconnect YouTube agar token + scope segar, lalu ulangi export.",
          totalResolvedVideoIds: foundVideoIds.length,
          sampleFailures: failedVideoIds.slice(0, 3),
        },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      playlistId: playlist.id,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`,
      totalRequested: sanitizedTracks.length,
      totalAdded: addedVideoIds.length,
      totalMissing: missingTracks.length,
      missingTracks,
      totalFailedToAdd: failedVideoIds.length,
      failedToAddSample: failedVideoIds.slice(0, 3),
      cappedByServer: body.tracks.length > MAX_EXPORT_TRACKS,
    });

    if (setCookies) {
      for (const cookie of setCookies) {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
          maxAge: cookie.maxAge,
        });
      }
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message === "not_authenticated") {
      return NextResponse.json({ error: "YouTube belum terhubung." }, { status: 401 });
    }

    const youtubeStatusMatch = /youtube_[^:]+_failed:(\d+):/.exec(message);
    if (youtubeStatusMatch) {
      const status = Number(youtubeStatusMatch[1]);
      return NextResponse.json(
        {
          error: message,
        },
        { status: Number.isFinite(status) ? status : 500 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
