import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ProfileForm } from "./profile-form";
import { PortraitUpload } from "./portrait-upload";
import { computeLevel } from "@/lib/trophies-server";
import { formatXp } from "@/lib/trophies";
import { Trophy } from "lucide-react";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) redirect("/login");

  const level = await computeLevel(user.id);

  const birthdayStr = user.birthday
    ? new Date(user.birthday).toISOString().slice(0, 10)
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profil</h1>
          <Link
            href="/trophies"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/40 px-3 py-1.5 text-xs font-semibold hover:bg-surface transition-colors"
          >
            <Trophy className="h-3.5 w-3.5 text-brand" />
            Level {level.level}
            <span className="text-muted-foreground font-normal tabular-nums">
              {formatXp(level.totalXp)}
            </span>
          </Link>
        </div>
        <PortraitUpload
          userId={user.id}
          hasPortrait={!!user.image}
          initials={
            (user.name ?? "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?"
          }
        />
        <ProfileForm
          initial={{
            name: user.name ?? null,
            birthday: birthdayStr,
            sex: user.sex ?? null,
            heightCm: user.heightCm ?? null,
            maxHeartRate: user.maxHeartRate ?? null,
            restHeartRate: user.restHeartRate ?? null,
            aerobicThreshold: user.aerobicThreshold ?? null,
            anaerobicThreshold: user.anaerobicThreshold ?? null,
          }}
        />
    </main>
  );
}
