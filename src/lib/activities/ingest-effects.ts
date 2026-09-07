/**
 * Seiteneffekte beim Anlegen einer Aktivität: schreiben, Push verschicken,
 * Trophäen auswerten, Home-Cache verwerfen.
 *
 * Bewusst getrennt von ingest.ts. Diese Datei zieht über push.ts und
 * trophies-server.ts das Paket `server-only` herein, das nur Next auflösen
 * kann — ein Importskript, das sie einbindet, bricht unter tsx mit
 * MODULE_NOT_FOUND ab. Skripte nutzen deshalb enrichActivity aus ingest.ts und
 * schreiben selbst.
 */

import { db } from "@/lib/db";
import { users, activities } from "@/lib/db/schema";
import { evaluateTrophies } from "@/lib/trophies-server";
import { TROPHIES } from "@/lib/trophies";
import { sendPushToUser, sendActivityPushes } from "@/lib/push";
import { revalidateTag } from "next/cache";
import { homeCacheTag } from "@/lib/cache/home-stats";

type UserRow = typeof users.$inferSelect;

/**
 * Zeile schreiben und die Seiteneffekte auslösen: Push an User und Partner.
 *
 * Trophäen werden hier NICHT ausgewertet — das lohnt sich nur einmal pro
 * Sync-Lauf, nicht pro Aktivität. Dafür gibt es finishIngest.
 */
export async function insertActivity(
  user: Pick<UserRow, "id" | "name" | "partnerId">,
  row: typeof activities.$inferInsert
): Promise<string | null> {
  const [inserted] = await db
    .insert(activities)
    .values(row)
    .returning({ id: activities.id });
  if (!inserted) return null;

  try {
    await sendActivityPushes(
      { id: user.id, name: user.name, partnerId: user.partnerId },
      {
        activityId: inserted.id,
        polarId: row.polarId ?? inserted.id,
        name: row.name,
        distance: row.distance ?? null,
        durationSec: row.duration ?? 0,
      }
    );
  } catch (e) {
    console.error("[ingest] Push fehlgeschlagen:", e);
  }

  return inserted.id;
}

/**
 * Abschluss eines Sync-Laufs: Trophäen auswerten, freigeschaltete melden,
 * Home-Cache verwerfen. Nur aufrufen, wenn tatsächlich etwas dazugekommen ist.
 */
export async function finishIngest(userId: string, userName: string | null): Promise<string[]> {
  let unlocked: string[] = [];
  try {
    unlocked = await evaluateTrophies(userId);
    for (const code of unlocked) {
      const def = TROPHIES.find((t) => t.code === code);
      if (!def) continue;
      try {
        await sendPushToUser(userId, {
          title: "Trophy freigeschaltet",
          body: `${def.title} — ${def.description}`,
          url: "/trophies",
          tag: `trophy-${code}`,
          kind: "trophy",
        });
      } catch (e) {
        console.error("[ingest] Trophy-Push fehlgeschlagen:", e);
      }
    }
    if (unlocked.length > 0) {
      console.log(`[ingest] Trophäen für ${userName ?? userId}: ${unlocked.join(", ")}`);
    }
  } catch (e) {
    console.error("[ingest] Trophäen-Auswertung fehlgeschlagen:", e);
  }

  revalidateTag(homeCacheTag(userId), "default");
  return unlocked;
}
