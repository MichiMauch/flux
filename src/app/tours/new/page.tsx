import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BentoPageShell } from "../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../components/bento/bento-page-header";
import { spaceMono } from "../../components/bento/bento-fonts";
import { createTour } from "../actions";

export default async function NewTourPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  async function action(formData: FormData) {
    "use server";
    const id = await createTour(formData);
    redirect(`/tours/${id}/edit`);
  }

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Touren"
        title="Neue Tour"
        right={
          <Link
            href="/tours"
            className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
          >
            ← Zurück
          </Link>
        }
      />

      <form
        action={action}
        className="max-w-xl space-y-5 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6"
      >
        <div className="space-y-2">
          <label
            htmlFor="name"
            className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={120}
            placeholder="z.B. Sommerferien Norwegen 2026"
            className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="description"
            className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Beschreibung (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="Worum geht es bei dieser Tour?"
            className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label
              htmlFor="startDate"
              className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
            >
              Start (optional)
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="endDate"
              className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
            >
              Ende (optional)
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
            />
          </div>
        </div>

        <p className={`${spaceMono.className} text-[10px] uppercase tracking-[0.14em] text-[#666]`}>
          Cover-Bild und Aktivitäten kommen im nächsten Schritt.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/tours"
            className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#2a2a2a] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#ff6a00] bg-[#ff6a00] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030]`}
          >
            Tour anlegen
          </button>
        </div>
      </form>
    </BentoPageShell>
  );
}
