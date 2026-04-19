import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { StatsFilterBar } from "./stats-filter-bar";
import { StatsActivityTiles } from "./stats-activity-tiles";
import { StatsHealthTiles } from "./stats-health-tiles";
import { pickDailyBucket } from "./bucket-utils";
import { parseRange, parseSport } from "./filters";
import {
  getActivityTotals,
  getActivitiesBySport,
  getAvailableSports,
  getAvailableYears,
  getActivitiesTimeSeries,
  getSleepData,
  getRechargeData,
  getWeightData,
  getBloodPressureData,
  getDailyActivityData,
  pickBucket,
} from "./data";
import {
  buildActivityBars,
  buildBpSeries,
  buildKpis,
  buildRecoverySeries,
  buildSleepChartData,
  buildSportSlices,
  buildStatsLabels,
  buildStepsBars,
  buildWeightLine,
} from "./prepare-stats-data";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; sport?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const range = parseRange(params.range);
  const sport = parseSport(params.sport);
  const bucket = pickBucket(range);
  const dailyBucket = pickDailyBucket(range);

  const [
    availableSports,
    availableYears,
    totals,
    bySport,
    timeSeries,
    sleep,
    recharge,
    weight,
    bp,
    daily,
  ] = await Promise.all([
    getAvailableSports(userId),
    getAvailableYears(userId),
    getActivityTotals(userId, range, sport),
    getActivitiesBySport(userId, range),
    getActivitiesTimeSeries(userId, range, sport, bucket),
    getSleepData(userId, range),
    getRechargeData(userId, range),
    getWeightData(userId, range),
    getBloodPressureData(userId, range),
    getDailyActivityData(userId, range),
  ]);

  const kpis = buildKpis(totals);
  const sportSlices = buildSportSlices(bySport);
  const labels = buildStatsLabels(range, sport, bucket, dailyBucket);
  const { distance: distanceBars, duration: durationBars } =
    buildActivityBars(timeSeries, bucket);
  const sleepData = buildSleepChartData(sleep, dailyBucket);
  const recovery = buildRecoverySeries(recharge, dailyBucket);
  const weightLine = buildWeightLine(weight, dailyBucket);
  const bpData = buildBpSeries(bp, dailyBucket);
  const stepsBars = buildStepsBars(daily, dailyBucket);

  return (
    <BentoPageShell>
      <BentoPageHeader section="Stats" title="Statistiken" />

      <div className="pb-1">
        <StatsFilterBar
          range={range}
          sport={sport}
          availableSports={availableSports}
          availableYears={availableYears}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        <StatsActivityTiles
          kpis={kpis}
          sportSlices={sportSlices}
          distanceBars={distanceBars}
          durationBars={durationBars}
          totalDistance={totals.totalDistance}
          activityTileLabel={labels.activityTile}
          bucketLabelSuffix={labels.bucketSuffix}
          showSportDonut={!sport && sportSlices.length > 0}
        />
        <StatsHealthTiles
          sleepLine={sleepData.line}
          sleepPhases={sleepData.phases}
          avgSleepCenter={sleepData.avgSleepCenter}
          recoveryLabels={recovery.labels}
          recoverySeries={recovery.series}
          weightLine={weightLine}
          bpLabels={bpData.labels}
          bpSeries={bpData.series}
          stepsBars={stepsBars}
          stepsTitle={labels.stepsTitle}
        />
      </div>
    </BentoPageShell>
  );
}
