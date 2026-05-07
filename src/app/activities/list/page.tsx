import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getActivityListPage,
  getActivityMonthCounts,
  getAvailableSports,
} from "@/lib/cache/activity-filters";
import { BentoPageShell } from "../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../components/bento/bento-page-header";
import { BentoSyncButton } from "../../components/bento/home/bento-sync-button";
import { spaceMono } from "../../components/bento/bento-fonts";
import { ActivitiesSportFilter } from "../activities-sport-filter";
import { ActivitiesDateFilter } from "../activities-date-filter";
import { ActivitiesFeed } from "../activities-feed";
import { parseMonthKey, parseSport } from "../filters";

const INITIAL_PAGE_SIZE = 15;

export default async function ActivitiesListPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const sport = parseSport(params.sport);
  const monthKey = parseMonthKey(params.month);

  const [listRows, availableSports, monthRows] = await Promise.all([
    getActivityListPage(userId, sport, monthKey, INITIAL_PAGE_SIZE),
    getAvailableSports(userId),
    getActivityMonthCounts(userId, sport),
  ]);

  const hasMore = listRows.length > INITIAL_PAGE_SIZE;
  const initial = hasMore ? listRows.slice(0, INITIAL_PAGE_SIZE) : listRows;

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Aktivitäten"
        title="Aktivitäten"
        right={
          <div className="flex items-center gap-3">
            <Link
              href="/activities"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ❏ Editorial
            </Link>
            <Link
              href="/"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Dashboard
            </Link>
            <BentoSyncButton />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="min-w-0 md:max-w-[55%]">
          <ActivitiesSportFilter
            sport={sport}
            availableSports={availableSports}
            basePath="/activities/list"
          />
        </div>
        <div className="min-w-0 flex-1">
          <ActivitiesDateFilter
            months={monthRows}
            monthKey={monthKey}
            basePath="/activities/list"
            sport={sport}
          />
        </div>
      </div>

      <ActivitiesFeed
        initial={initial}
        initialHasMore={hasMore}
        sport={sport}
        monthKey={monthKey}
      />
    </BentoPageShell>
  );
}
