import { stat } from "node:fs/promises";
import path from "node:path";

/**
 * A player may have a designed PDF supplied for them. When one is set it is served
 * instead of the generated profile, because the uploaded document is the one the
 * player wants people to receive.
 *
 * Only files directly inside public/profiles are served. The stored value is a
 * site-relative path, so it is reduced to its basename and re-resolved under that
 * directory: a stray or hand-edited value cannot reach the rest of the filesystem.
 */
export const PROFILE_PDF_ROOT = path.join(process.cwd(), "public", "profiles");

export async function resolveUploadedPdf(profilePdfUrl: string | null) {
  if (!profilePdfUrl) return null;
  const name = path.basename(profilePdfUrl);
  if (!name.toLowerCase().endsWith(".pdf")) return null;
  const file = path.join(PROFILE_PDF_ROOT, name);
  if (path.relative(PROFILE_PDF_ROOT, file).startsWith("..")) return null;
  try {
    const info = await stat(file);
    return info.isFile() ? { file, size: info.size } : null;
  } catch {
    // A missing file must not break the download: fall back to the generated PDF.
    return null;
  }
}
