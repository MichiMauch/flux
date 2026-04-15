export function BentoNotesTile({ notes }: { notes: string | null }) {
  if (!notes || !notes.trim()) return null;
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4">
      <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] mb-2">
        Notizen
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d4d4d4]">
        {notes}
      </p>
    </div>
  );
}
