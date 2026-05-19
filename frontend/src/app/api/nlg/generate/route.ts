// handleNlgGeneratePost — logika untuk menghasilkan narasi NLG dari hasil rekomendasi
import { handleNlgGeneratePost } from "@/server/modules/nlg";

// POST — endpoint untuk menghasilkan teks narasi rekomendasi playlist
export async function POST(request: Request) {
  return handleNlgGeneratePost(request);
}
