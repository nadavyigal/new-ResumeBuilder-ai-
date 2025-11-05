import { handleHistoryNavigation } from "../undo/route";

export const runtime = "nodejs";

export async function POST() {
  return handleHistoryNavigation("redo");
}
