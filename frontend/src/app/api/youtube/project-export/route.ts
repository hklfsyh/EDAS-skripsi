// handleYouTubeProjectExport — logika export playlist ke YouTube (akun project)
import { handleYouTubeProjectExport } from "@/server/modules/youtubeExport";

// POST — endpoint untuk mengekspor playlist ke YouTube
export async function POST(request: Request) {
  return handleYouTubeProjectExport(request);
}
