import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activities, activityPhotos, activityVideos } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
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

  // Fotos der Aktivität für das Foto-Design, in Aufnahmereihenfolge — dieselbe
  // Reihenfolge wie in der Share-Card-Route, damit "das erste" dasselbe meint.
  const photos = await db
    .select({ id: activityPhotos.id })
    .from(activityPhotos)
    .where(eq(activityPhotos.activityId, row.id))
    .orderBy(asc(activityPhotos.takenAt), asc(activityPhotos.id));

  // Nur fertig umgewandelte Videos taugen für ein Story-Video.
  const videos = await db
    .select({ id: activityVideos.id })
    .from(activityVideos)
    .where(
      and(eq(activityVideos.activityId, row.id), eq(activityVideos.status, "ready"))
    )
    .orderBy(asc(activityVideos.createdAt));

  return (
    <ShareActivityClient
      activityId={row.id}
      activityName={row.name}
      initialToken={row.shareToken}
      photoIds={photos.map((p) => p.id)}
      videoIds={videos.map((v) => v.id)}
    />
  );
}
