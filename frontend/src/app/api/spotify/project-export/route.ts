// export playlist ke spotify pake akun project
import { handleSpotifyProjectExport } from "@/server/modules/spotifyExport";

// endpoint buat export playlist ke spotify
export async function POST(request: Request) {
  return handleSpotifyProjectExport(request);
}
