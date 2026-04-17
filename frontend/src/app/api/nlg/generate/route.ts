import { handleNlgGeneratePost } from "@/server/modules/nlg";

export async function POST(request: Request) {
  return handleNlgGeneratePost(request);
}
