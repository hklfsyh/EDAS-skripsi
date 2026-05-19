// handleSpotifyProjectExport — logika export playlist ke Spotify (akun project)
import { handleSpotifyProjectExport } from "@/server/modules/spotifyExport";

// POST — endpoint untuk mengekspor playlist ke Spotify
export async function POST(request: Request) {
  return handleSpotifyProjectExport(request);
}
