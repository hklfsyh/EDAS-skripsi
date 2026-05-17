import { handleSpotifyProjectExport } from "@/server/modules/spotifyExport";

export async function POST(request: Request) {
  return handleSpotifyProjectExport(request);
}
