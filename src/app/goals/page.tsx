import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoalCard } from "@/app/components/goal-card";
import { NewGoalButton } from "@/app/components/goal-form";
import { type Goal } from "@/lib/goals";
import { computeGoalProgress } from "@/lib/goals-server";
import { Target } from "lucide-react";

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
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">Ziele</h1>
          <NewGoalButton />
        </div>

        {withProgress.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-2">
            <Target className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Noch keine Ziele</p>
            <p className="text-sm text-muted-foreground">
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
      </main>
    </>
  );
}
