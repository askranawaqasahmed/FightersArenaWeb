import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export type MediaPurpose = "slider" | "event-image" | "event-gallery" | "profile-picture" | "attachment";

export class ObjectStorageConfigurationError extends Error {
  constructor() {
    super("S3 object storage is not configured. Add the AWS_* values from .env.example.");
    this.name = "ObjectStorageConfigurationError";
  }
}

function getStorageConfiguration() {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET_NAME) {
    throw new ObjectStorageConfigurationError();
  }

  return {
    endpoint: env.AWS_ENDPOINT_URL,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    bucket: env.AWS_S3_BUCKET_NAME,
    region: env.AWS_DEFAULT_REGION,
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE === "true",
  };
}

let storageClient: S3Client | undefined;

function getStorageClient() {
  const configuration = getStorageConfiguration();
  storageClient ??= new S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: configuration.forcePathStyle,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
  return { client: storageClient, bucket: configuration.bucket };
}

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const allowedAttachmentTypes = new Set([
  ...allowedImageTypes,
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function createObjectKey(purpose: MediaPurpose, mimeType: string) {
  const extension = extensionByMimeType[mimeType] ?? "bin";
  const date = new Date().toISOString().slice(0, 10);
  return `${purpose}/${date}/${crypto.randomUUID()}.${extension}`;
}

export function mediaUrlForKey(key: string) {
  return `/api/v1/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function putMediaObject(input: { key: string; bytes: Uint8Array; contentType: string }) {
  const { client, bucket } = getStorageClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.bytes,
    ContentType: input.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}

export async function getMediaObject(key: string) {
  const { client, bucket } = getStorageClient();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}
