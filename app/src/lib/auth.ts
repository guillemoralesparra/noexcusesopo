import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "opo_session";
const MAX_AGE_S = 60 * 60 * 24 * 60; // 60 dies: s'estudia de manera irregular, no volem fer iniciar sessió sovint

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("Cal SESSION_SECRET (≥32 caràcters)");
    return new TextEncoder().encode("dev-secret-dev-secret-dev-secret-dev");
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = { id: number; username: string; displayName: string; role: "admin" | "student" };

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function startSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const db = await getDb();
    const [u] = await db.select().from(users).where(eq(users.id, Number(payload.uid)));
    return u ? { id: u.id, username: u.username, displayName: u.displayName, role: u.role } : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/entrar");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}
