import { apiProblem } from "@/lib/api";
import { getMediaObject, ObjectStorageConfigurationError } from "@/lib/object-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await context.params;
  const key = parts.join("/");

  try {
    const object = await getMediaObject(key);
    if (!object.Body) return apiProblem(404, "MEDIA_NOT_FOUND", "Media not found", "The requested media object does not exist.");
    const bytes = await object.Body.transformToByteArray();
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "content-type": object.ContentType ?? "application/octet-stream",
        "content-length": String(object.ContentLength ?? bytes.byteLength),
        "cache-control": object.CacheControl ?? "public, max-age=31536000, immutable",
        etag: object.ETag ?? "",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ObjectStorageConfigurationError) {
      return apiProblem(503, "STORAGE_NOT_CONFIGURED", "Storage is not configured", error.message);
    }
    if (error && typeof error === "object" && "name" in error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
      return apiProblem(404, "MEDIA_NOT_FOUND", "Media not found", "The requested media object does not exist.");
    }
    console.error("Media download failed", error);
    return apiProblem(502, "MEDIA_UNAVAILABLE", "Media unavailable", "The media object could not be retrieved.");
  }
}
