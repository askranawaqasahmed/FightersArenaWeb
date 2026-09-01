import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { gamerProfiles, mediaAssets } from "@/db/schema";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { apiData, apiProblem } from "@/lib/api";
import { getRequestGamer } from "@/lib/request-auth";
import {
  allowedAttachmentTypes,
  allowedImageTypes,
  createObjectKey,
  mediaUrlForKey,
  ObjectStorageConfigurationError,
  putMediaObject,
  type MediaPurpose,
} from "@/lib/object-storage";

export const runtime = "nodejs";

const purposeSchema = z.enum(["slider", "event-image", "event-gallery", "profile-picture", "attachment"]);
const imagePurposes = new Set<MediaPurpose>(["slider", "event-image", "event-gallery", "profile-picture"]);

export async function POST(request: Request) {
  const admin = await getRequestAdmin(request);
  const gamer = admin ? null : await getRequestGamer(request);
  if (!admin && !gamer) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in before uploading media.");

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const parsedPurpose = purposeSchema.safeParse(formData.get("purpose"));
    const altText = String(formData.get("altText") ?? "").trim() || null;

    if (!(file instanceof File) || !parsedPurpose.success) {
      return apiProblem(422, "UPLOAD_INVALID", "Invalid upload", "Provide a file and a supported media purpose.");
    }

    const purpose = parsedPurpose.data;
    if (gamer && purpose !== "profile-picture" && purpose !== "attachment") {
      return apiProblem(403, "UPLOAD_FORBIDDEN", "Upload not allowed", "Player accounts cannot upload administrative media.");
    }

    const allowedTypes = imagePurposes.has(purpose) ? allowedImageTypes : allowedAttachmentTypes;
    const maximumBytes = imagePurposes.has(purpose) ? 8_000_000 : 20_000_000;
    if (!allowedTypes.has(file.type)) {
      return apiProblem(415, "FILE_TYPE_UNSUPPORTED", "Unsupported file type", "Upload a supported image, PDF, document, spreadsheet, text, or CSV file.");
    }
    if (file.size < 1 || file.size > maximumBytes) {
      return apiProblem(413, "FILE_TOO_LARGE", "File is too large", `The maximum upload size is ${maximumBytes / 1_000_000} MB.`);
    }

    const key = createObjectKey(purpose, file.type);
    await putMediaObject({ key, bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type });
    const url = mediaUrlForKey(key);
    const ownerUserId = admin?.userId ?? gamer?.userId ?? null;

    await db.insert(mediaAssets).values({
      ownerUserId,
      objectKey: key,
      mimeType: file.type,
      sizeBytes: file.size,
      altText,
      moderationStatus: admin ? "approved" : "pending",
    });

    if (gamer && purpose === "profile-picture") {
      await db.update(gamerProfiles)
        .set({ avatarUrl: url, updatedAt: new Date() })
        .where(eq(gamerProfiles.userId, gamer.userId));
    }

    return apiData({ key, url, originalName: file.name, mimeType: file.type, sizeBytes: file.size }, { status: 201 });
  } catch (error) {
    if (error instanceof ObjectStorageConfigurationError) {
      return apiProblem(503, "STORAGE_NOT_CONFIGURED", "Storage is not configured", error.message);
    }
    console.error("Media upload failed", error);
    return apiProblem(500, "UPLOAD_FAILED", "Upload failed", "The file could not be stored. Please try again.");
  }
}
