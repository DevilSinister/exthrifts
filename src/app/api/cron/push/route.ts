import { secretMatches } from "@/lib/auth";
import { dispatchDue } from "@/lib/push/outbox";

// Retries order alerts that couldn't be sent immediately. Called every 5
// minutes by an hPanel cron job:
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/push
async function handle(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : new URL(request.url).searchParams.get("key");
  if (!secretMatches(given, process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await dispatchDue(100);
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
