import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "rasd_session";
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || "insecure-dev-secret");

export async function createSession(user: string) {
  return new SignJWT({ sub: user }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
