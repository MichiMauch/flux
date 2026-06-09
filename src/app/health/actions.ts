"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function setTargetWeight(
  value: number | null
): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet" };

  let target: number | null = null;
  if (value != null && Number.isFinite(value) && value > 0) {
    // auf eine Nachkommastelle begrenzen, plausibler Bereich
    target = Math.round(Math.min(Math.max(value, 20), 500) * 10) / 10;
  }

  await db
    .update(users)
    .set({ targetWeightKg: target })
    .where(eq(users.id, session.user.id));

  revalidatePath("/health");
  return { ok: true };
}
