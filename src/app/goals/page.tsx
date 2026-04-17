import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoalCard } from "@/app/components/goal-card";
import { NewGoalButton } from "@/app/components/goal-form";
import { type Goal } from "@/lib/goals";
import { computeGoalProgress } from "@/lib/goals-server";
import { Target } from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, session.user.id))
    .orderBy(desc(goals.createdAt));

  const withProgress = await Promise.all(
    rows.map(async (g) => ({
      goal: g as Goal,
      progress: await computeGoalProgress(g as Goal),
    }))
  );

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Ziele"
        title="Ziele"
        right={<NewGoalButton />}
      />

      {withProgress.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#0f0f0f] p-10 text-center space-y-2">
          <Target className="h-10 w-10 mx-auto text-[#a3a3a3]" />
          <p className="font-semibold text-white">Noch keine Ziele</p>
          <p className="text-sm text-[#9ca3af]">
            Erstelle dein erstes Ziel — z. B. „1000 km Laufen im Jahr".
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {withProgress.map(({ goal, progress }) => (
            <GoalCard key={goal.id} goal={goal} progress={progress} />
          ))}
        </div>
      )}
    </BentoPageShell>
  );
}
