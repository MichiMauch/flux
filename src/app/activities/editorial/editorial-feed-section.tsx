import { getActivityListPage } from "@/lib/cache/activity-filters";
import { EditorialFeed } from "./editorial-feed";

interface Props {
  userId: string;
  sport: string | null;
  monthKey: string | null;
  pageSize: number;
}

export async function EditorialFeedSection({
  userId,
  sport,
  monthKey,
  pageSize,
}: Props) {
  const rows = await getActivityListPage(userId, sport, monthKey, pageSize);
  const hasMore = rows.length > pageSize;
  const initial = hasMore ? rows.slice(0, pageSize) : rows;
  return (
    <EditorialFeed
      initial={initial}
      initialHasMore={hasMore}
      sport={sport}
      monthKey={monthKey}
    />
  );
}
