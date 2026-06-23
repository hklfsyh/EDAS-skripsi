// export playlist ke youtube pake akun project
import { handleYouTubeProjectExport } from "@/server/modules/youtubeExport";

// endpoint buat export playlist ke youtube
export async function POST(request: Request) {
  return handleYouTubeProjectExport(request);
}
