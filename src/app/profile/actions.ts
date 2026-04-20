"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function updateProfile(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet" };

  const name = String(formData.get("name") ?? "").trim() || null;
  const birthdayStr = String(formData.get("birthday") ?? "").trim();
  const birthday = birthdayStr ? new Date(birthdayStr) : null;
  const sexRaw = String(formData.get("sex") ?? "").trim();
  const sex = sexRaw === "male" || sexRaw === "female" ? sexRaw : null;
  const heightCm = parseIntOrNull(formData.get("heightCm"));
  const maxHeartRate = parseIntOrNull(formData.get("maxHeartRate"));
  const restHeartRate = parseIntOrNull(formData.get("restHeartRate"));
  const aerobicThreshold = parseIntOrNull(formData.get("aerobicThreshold"));
  const anaerobicThreshold = parseIntOrNull(formData.get("anaerobicThreshold"));

  await db
    .update(users)
    .set({
      name,
      birthday,
      sex,
      heightCm,
      maxHeartRate,
      restHeartRate,
      aerobicThreshold,
      anaerobicThreshold,
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}

export async function setPartnerPushEnabled(enabled: boolean): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet" };

  await db
    .update(users)
    .set({ partnerPushEnabled: enabled })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true };
}
