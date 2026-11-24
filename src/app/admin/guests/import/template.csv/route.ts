import { requireHost } from "@/lib/auth";
import { templateCsv } from "@/lib/guests/csv";

export async function GET() {
  await requireHost();
  return new Response(templateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="guest-list-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
