// handle dummy playlist buat pengujian
import { handleDummyPlaylistGet, handleDummyPlaylistPost } from "@/server/modules/dummyPlaylist";

// ambil playlist rekomendasi dummy lewat api
export async function GET(request: Request) {
  return handleDummyPlaylistGet(request);
}

// proses playlist rekomendasi dummy lewat api
export async function POST(request: Request) {
  return handleDummyPlaylistPost(request);
}
