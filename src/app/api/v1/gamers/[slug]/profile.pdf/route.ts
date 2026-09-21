import { apiProblem } from "@/lib/api";
import { env } from "@/lib/env";
import { buildGamerProfilePdf } from "@/lib/gamer-profile-pdf";
import { getPublicGamer } from "@/lib/public-gamer-data";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gamer = await getPublicGamer(slug);
  if (!gamer) return apiProblem(404, "GAMER_NOT_FOUND", "Gamer not found", "The requested public gamer profile does not exist.");

  const bytes = await buildGamerProfilePdf(gamer, env.NEXT_PUBLIC_APP_URL);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${gamer.slug}-efightersarena-profile.pdf"`,
      "cache-control": "no-store",
    },
  });
}
