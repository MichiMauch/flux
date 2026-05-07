import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoSyncButton } from "../components/bento/home/bento-sync-button";
import { FeedSkeleton } from "../activities/feed-skeleton";
import { StreamFeedSection } from "./stream-feed-section";

export default async function StreamPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Aktivitäten"
        title="Stream"
        right={<BentoSyncButton />}
      />

      <Suspense fallback={<FeedSkeleton variant="editorial" />}>
        <StreamFeedSection userId={userId} />
      </Suspense>
    </BentoPageShell>
  );
}
