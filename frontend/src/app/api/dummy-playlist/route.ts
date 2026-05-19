// handleDummyPlaylistGet / handleDummyPlaylistPost — logika playlist dummy untuk pengujian
import { handleDummyPlaylistGet, handleDummyPlaylistPost } from "@/server/modules/dummyPlaylist";

// GET — ambil playlist rekomendasi dummy melalui API
export async function GET(request: Request) {
  return handleDummyPlaylistGet(request);
}

// POST — proses playlist rekomendasi dummy melalui API
export async function POST(request: Request) {
  return handleDummyPlaylistPost(request);
}
