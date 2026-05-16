import { handleDummyPlaylistGet, handleDummyPlaylistPost } from "@/server/modules/dummyPlaylist";

// Ambil playlist rekomendasi (dummy) melalui API
export async function GET(request: Request) {
  return handleDummyPlaylistGet(request);
}

// Proses playlist rekomendasi (dummy) melalui API
export async function POST(request: Request) {
  return handleDummyPlaylistPost(request);
}
