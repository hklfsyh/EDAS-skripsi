import { handleYouTubeExportPost } from "@/server/modules/youtubeExport";

export async function POST(request: Request) {
  return handleYouTubeExportPost(request);
}
