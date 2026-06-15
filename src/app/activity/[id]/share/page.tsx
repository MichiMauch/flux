import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ShareActivityClient } from "./share-activity-client";

export default async function ActivitySharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const [row] = await db
    .select({
      id: activities.id,
      name: activities.name,
      shareToken: activities.shareToken,
    })
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, session.user.id)))
    .limit(1);

  if (!row) notFound();

  return (
    <ShareActivityClient
      activityId={row.id}
      activityName={row.name}
      initialToken={row.shareToken}
    />
  );
}
