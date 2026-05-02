import Link from "next/link";
import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { userTrophies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getTrophy } from "@/lib/trophies";
import { TrophyIcon } from "./trophy-icon";

export async function EarnedTrophies({ userId }: { userId: string }) {
  const rows = await db
    .select({
      code: userTrophies.trophyCode,
      unlockedAt: userTrophies.unlockedAt,
    })
    .from(userTrophies)
    .where(eq(userTrophies.userId, userId))
    .orderBy(desc(userTrophies.unlockedAt));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Trophy className="h-3 w-3" /> Trophäen
        </span>
        <Link
          href="/trophies"
          className="text-[11px] font-semibold text-brand hover:underline"
        >
          Alle ansehen →
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {rows.map((r) => {
          const def = getTrophy(r.code);
          if (!def) return null;
          return (
            <Link
              key={r.code}
              href="/trophies"
              title={`${def.title} · ${new Date(r.unlockedAt).toLocaleDateString("de-CH")}`}
              className="flex aspect-square items-center justify-center rounded-md bg-background border border-border hover:bg-surface transition-colors"
            >
              <TrophyIcon
                code={def.code}
                alt={def.title}
                className="h-6 w-6"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
