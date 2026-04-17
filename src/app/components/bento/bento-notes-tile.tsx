export function BentoNotesTile({ notes }: { notes: string | null }) {
  if (!notes || !notes.trim()) return null;
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4">
      <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2">
        Notizen
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#d4d4d4]">
        {notes}
      </p>
    </div>
  );
}
