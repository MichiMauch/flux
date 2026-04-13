import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Navbar } from "@/app/components/navbar";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) redirect("/login");

  const birthdayStr = user.birthday
    ? new Date(user.birthday).toISOString().slice(0, 10)
    : null;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Profil</h1>
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
    </>
  );
}
