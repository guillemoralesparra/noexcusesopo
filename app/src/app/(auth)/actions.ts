"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { invites, users } from "@/db/schema";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Omple l'usuari i la contrasenya." };
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.username, parsed.data.username));
  if (!u || !(await verifyPassword(parsed.data.password, u.passwordHash))) {
    return { error: "Usuari o contrasenya incorrectes." };
  }
  await startSession(u.id);
  redirect("/");
}

const registerSchema = z.object({
  code: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "L'usuari ha de tenir 3-30 caràcters: lletres, números, punt, guió."),
  password: z.string().min(8, "La contrasenya ha de tenir almenys 8 caràcters."),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dades no vàlides." };
  const { code, displayName, username, password } = parsed.data;
  const db = await getDb();
  const passwordHash = await hashPassword(password);

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (taken) return { error: "Aquest nom d'usuari ja existeix." };

  const userId = await db.transaction(async (tx) => {
    // Consumeix una plaça del codi de manera atòmica
    const [inv] = await tx
      .update(invites)
      .set({ usesLeft: sql`${invites.usesLeft} - 1` })
      .where(sql`${invites.code} = ${code} and ${invites.usesLeft} > 0`)
      .returning();
    if (!inv) return null;
    const [u] = await tx
      .insert(users)
      .values({ username, displayName, passwordHash, role: inv.role })
      .returning({ id: users.id });
    return u.id;
  });

  if (userId === null) return { error: "El codi d'invitació no és vàlid o ja s'ha fet servir." };
  await startSession(userId);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/entrar");
}
