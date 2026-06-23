// generate narasi nlg dari hasil rekomendasi
import { handleNlgGeneratePost } from "@/server/modules/nlg";

// endpoint buat generate teks narasi rekomendasi playlist
export async function POST(request: Request) {
  return handleNlgGeneratePost(request);
}
