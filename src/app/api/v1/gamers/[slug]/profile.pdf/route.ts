import { createReadStream } from "node:fs";
import { apiProblem } from "@/lib/api";
import { env } from "@/lib/env";
import { buildGamerProfilePdf } from "@/lib/gamer-profile-pdf";
import { getPublicGamer } from "@/lib/public-gamer-data";
import { resolveUploadedPdf } from "@/lib/uploaded-profile-pdf";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gamer = await getPublicGamer(slug);
  if (!gamer) return apiProblem(404, "GAMER_NOT_FOUND", "Gamer not found", "The requested public gamer profile does not exist.");

  const filename = `${gamer.slug}-efightersarena-profile.pdf`;
  const uploaded = await resolveUploadedPdf(gamer.profilePdfUrl);
  if (uploaded) {
    const stream = createReadStream(uploaded.file) as unknown as ReadableStream;
    return new Response(stream, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(uploaded.size),
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  }

  const bytes = await buildGamerProfilePdf(gamer, env.NEXT_PUBLIC_APP_URL);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
