import { Download } from "lucide-react";

const NEON = "#FF6A00";

export function BentoGpxTile({ activityId }: { activityId: string }) {
  return (
    <a
      href={`/api/activities/${activityId}/gpx`}
      download
      className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4 flex flex-col gap-2 hover:border-[#2a2a2a] hover:bg-[#151515] transition-colors"
    >
      <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b]">
        Export
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${NEON}1a`, color: NEON }}
        >
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-white">GPX herunterladen</div>
          <div className="[font-family:var(--bento-mono)] text-[10px] text-[#6b6b6b] uppercase tracking-[0.14em]">
            Route · Höhe · Zeit
          </div>
        </div>
      </div>
    </a>
  );
}
