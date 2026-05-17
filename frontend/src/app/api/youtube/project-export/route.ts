import { handleYouTubeProjectExport } from "@/server/modules/youtubeExport";

export async function POST(request: Request) {
  return handleYouTubeProjectExport(request);
}
