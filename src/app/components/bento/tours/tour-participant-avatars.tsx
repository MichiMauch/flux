import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TourActivity, TourParticipant } from "@/app/tours/data";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** True, sobald Etappen von mehr als einer Person in der Liste stecken. */
export function hasMultipleParticipants(members: TourActivity[]): boolean {
  const ids = new Set<string>();
  for (const m of members) for (const p of m.participants) ids.add(p.id);
  return ids.size > 1;
}

export function TourParticipantAvatars({
  participants,
}: {
  participants: TourParticipant[];
}) {
  const label = participants.map((p) => p.name ?? "Unbekannt").join(" & ");
  return (
    <div className="flex shrink-0 -space-x-1.5" title={label} aria-label={label}>
      {participants.map((p) => (
        <Avatar key={p.id} className="h-6 w-6 ring-2 ring-[#0f0f0f]">
          {p.image ? <AvatarImage src={p.image} alt={p.name ?? ""} /> : null}
          <AvatarFallback className="bg-[#2a2a2a] text-[9px] font-bold text-white">
            {getInitials(p.name)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}
