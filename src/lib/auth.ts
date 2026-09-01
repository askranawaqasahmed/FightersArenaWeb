import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const jwtKey = new TextEncoder().encode(env.JWT_PRIVATE_SECRET);

export type AdminRole = "super_admin" | "admin";

export const isAdminRole = (role: unknown): role is AdminRole => role === "super_admin" || role === "admin";

export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");
export const createOpaqueToken = () => randomBytes(48).toString("base64url");

export async function createAccessToken(
  userId: string,
  sessionId: string,
  accountType: "gamer" | "admin" = "gamer",
  adminRole?: AdminRole,
) {
  return new SignJWT({ sid: sessionId, accountType, ...(adminRole ? { adminRole } : {}) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT", kid: "local-v1" })
    .setIssuer("efightersarena")
    .setAudience("efightersarena-api")
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("15m")
    .sign(jwtKey);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwtKey, {
    issuer: "efightersarena",
    audience: "efightersarena-api",
    algorithms: ["HS256"],
  });
  return payload;
}
