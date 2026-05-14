import { handleDummyPlaylistGet, handleDummyPlaylistPost } from "@/server/modules/dummyPlaylist";

export async function GET(request: Request) {
  return handleDummyPlaylistGet(request);
}

export async function POST(request: Request) {
  return handleDummyPlaylistPost(request);
}
