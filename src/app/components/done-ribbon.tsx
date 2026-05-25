import { spaceMono } from "./bento/bento-fonts";

export function DoneRibbon() {
  return (
    <div
      aria-label="Tour abgeschlossen"
      className="pointer-events-none absolute top-0 right-0 h-20 w-20 overflow-hidden"
    >
      <span
        className={`${spaceMono.className} absolute top-[18px] right-[-32px] block w-[120px] rotate-45 bg-[#ff6a00] py-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-black shadow-md`}
      >
        Done
      </span>
    </div>
  );
}
