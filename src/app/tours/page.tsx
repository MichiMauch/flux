import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { spaceMono } from "../components/bento/bento-fonts";
import { listToursForUser } from "./data";
import { formatDistanceAuto } from "@/lib/activity-format";

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "—";
  const fmt = (d: Date) =>
    d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  if (start && end) {
    if (start.getTime() === end.getTime()) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }
  return fmt((start ?? end)!);
}

export default async function ToursPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const tours = await listToursForUser(userId);

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Touren"
        title="Aktivitäts-Touren"
        right={
          <div className="flex items-center gap-3">
            <Link
              href="/tours/new"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#ff6a00] bg-[#ff6a00] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030]`}
            >
              + Neue Tour
            </Link>
            <Link
              href="/"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Dashboard
            </Link>
          </div>
        }
      />

      {tours.length === 0 ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-10 text-center">
          <p className="text-lg text-white">Noch keine Touren angelegt.</p>
          <p className="mt-2 text-sm text-[#a3a3a3]">
            Bündle mehrere Aktivitäten zu einer Tour — z.B. eine
            Mehrtages-Reise oder einen Trainingsblock.
          </p>
          <Link
            href="/tours/new"
            className={`${spaceMono.className} mt-6 inline-flex items-center gap-1 rounded-md border border-[#ff6a00] bg-[#ff6a00] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030]`}
          >
            Erste Tour anlegen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((g) => (
            <Link
              key={g.id}
              href={`/tours/${g.id}`}
              className="group overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] transition-colors hover:border-[#4a4a4a]"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1a1a1a]">
                {g.coverPhotoPath ? (
                  <Image
                    src={g.coverPhotoPath}
                    alt={g.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    unoptimized
                    className="object-cover transition-transform group-hover:scale-105"
                    style={{
                      objectPosition: `${g.coverOffsetX}% ${g.coverOffsetY}%`,
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#404040]">
                    <span
                      className={`${spaceMono.className} text-xs uppercase tracking-[0.14em]`}
                    >
                      Kein Cover
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                {g.sharedFromPartner && g.ownerName ? (
                  <span
                    className={`${spaceMono.className} absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-white backdrop-blur`}
                  >
                    Von {g.ownerName}
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <h2 className="line-clamp-1 text-lg font-semibold text-white">
                  {g.name}
                </h2>
                {g.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[#a3a3a3]">
                    {g.description}
                  </p>
                ) : null}
                <div
                  className={`${spaceMono.className} mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
                >
                  <span>
                    <span className="text-white">{g.count ?? 0}</span> Aktivität
                    {g.count === 1 ? "" : "en"}
                  </span>
                  <span>
                    <span className="text-white">
                      {formatDistanceAuto(g.totalDistance ?? 0, 1)}
                    </span>
                  </span>
                  {g.totalAscent ? (
                    <span>
                      <span className="text-white">
                        {Math.round(g.totalAscent)}
                      </span>{" "}
                      m ↑
                    </span>
                  ) : null}
                </div>
                <div
                  className={`${spaceMono.className} mt-1 text-[10px] uppercase tracking-[0.14em] text-[#666]`}
                >
                  {formatDateRange(
                    g.startDate ?? g.firstActivityStart,
                    g.endDate ?? g.lastActivityStart
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BentoPageShell>
  );
}
