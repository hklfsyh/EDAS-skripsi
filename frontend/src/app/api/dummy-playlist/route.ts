import { handleDummyPlaylistGet } from "@/server/modules/dummyPlaylist";

export async function GET(request: Request) {
  return handleDummyPlaylistGet(request);
}
