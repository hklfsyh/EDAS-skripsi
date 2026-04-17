import { handleSpotifyExportPost } from "@/server/modules/spotifyExport";

export async function POST(request: Request) {
  return handleSpotifyExportPost(request);
}
