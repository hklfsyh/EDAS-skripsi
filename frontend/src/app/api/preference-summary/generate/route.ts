import { handlePreferenceSummaryGeneratePost } from "@/server/modules/preferenceSummaryNlg";

export async function POST(request: Request) {
  return handlePreferenceSummaryGeneratePost(request);
}
