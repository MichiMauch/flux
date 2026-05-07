import { getActivityListPage } from "@/lib/cache/activity-filters";
import { ActivitiesFeed } from "./activities-feed";

interface Props {
  userId: string;
  sport: string | null;
  monthKey: string | null;
  pageSize: number;
}

export async function ActivitiesFeedSection({
  userId,
  sport,
  monthKey,
  pageSize,
}: Props) {
  const rows = await getActivityListPage(userId, sport, monthKey, pageSize);
  const hasMore = rows.length > pageSize;
  const initial = hasMore ? rows.slice(0, pageSize) : rows;
  return (
    <ActivitiesFeed
      initial={initial}
      initialHasMore={hasMore}
      sport={sport}
      monthKey={monthKey}
    />
  );
}
