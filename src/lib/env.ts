import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgresql://postgres:123@localhost:5432/comp"),
  JWT_PRIVATE_SECRET: z.string().min(32).default("local-development-secret-change-before-production"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DEV_OTP_CODE: z.string().regex(/^\d{6}$/).default("123456"),
  AWS_ENDPOINT_URL: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_S3_BUCKET_NAME: z.string().min(1).optional(),
  AWS_DEFAULT_REGION: z.string().min(1).default("us-east-1"),
  AWS_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_PRIVATE_SECRET: process.env.JWT_PRIVATE_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DEV_OTP_CODE: process.env.DEV_OTP_CODE,
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL || undefined,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || undefined,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || undefined,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || undefined,
  AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
  AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE,
  NODE_ENV: process.env.NODE_ENV,
});
