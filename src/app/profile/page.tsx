import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ProfileForm } from "./profile-form";
import { PortraitUpload } from "./portrait-upload";
import { PushNotificationsToggle } from "./push-notifications-toggle";
import { computeLevel } from "@/lib/trophies-server";
import { formatXp } from "@/lib/trophies";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { spaceMono } from "../components/bento/bento-fonts";

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
    <BentoPageShell>
      <BentoPageHeader
        section="Profile"
        title="Profil"
        right={
          <Link
            href="/trophies"
            className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
          >
            <Trophy className="h-3.5 w-3.5 text-[#FF6A00]" />
            Level {level.level}
            <span className="text-[#9ca3af] tabular-nums">
              {formatXp(level.totalXp)}
            </span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        <div className="md:col-span-6">
          <BentoTile label="Portrait" title="Dein Bild">
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
          </BentoTile>
        </div>

        <div className="md:col-span-6">
          <BentoTile label="Daten" title="Persönliche Einstellungen">
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
          </BentoTile>
        </div>

        <div className="md:col-span-6">
          <BentoTile label="Benachrichtigungen" title="Push-Benachrichtigungen">
            <PushNotificationsToggle />
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}
