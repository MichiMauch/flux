"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";

interface ProfileFormProps {
  initial: {
    name: string | null;
    birthday: string | null;
    sex: string | null;
    heightCm: number | null;
    maxHeartRate: number | null;
    restHeartRate: number | null;
    aerobicThreshold: number | null;
    anaerobicThreshold: number | null;
  };
}

const inputCls =
  "w-full rounded-md border border-[#3a3128] bg-black/40 px-3 py-2 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#FF6A00]/60 focus:outline-none";

export function ProfileForm({ initial }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { ok?: boolean; error?: string } | undefined, formData: FormData) => {
      return await updateProfile(formData);
    },
    undefined
  );

  return (
    <form action={formAction} className="space-y-6 max-w-xl">
      <section className="space-y-4">
        <h2 className="font-semibold text-white">Persönliche Angaben</h2>
        <Field label="Name">
          <input
            name="name"
            type="text"
            defaultValue={initial.name ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Geburtstag">
          <div>
            <input
              type="text"
              value={formatDateDe(initial.birthday)}
              readOnly
              className={`${inputCls} cursor-default`}
            />
            <input
              type="hidden"
              name="birthday"
              value={initial.birthday ?? ""}
            />
          </div>
        </Field>
        <Field label="Geschlecht">
          <select
            name="sex"
            defaultValue={initial.sex ?? ""}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="male">Männlich</option>
            <option value="female">Weiblich</option>
          </select>
        </Field>
        <Field label="Körpergrösse (cm)">
          <input
            name="heightCm"
            type="number"
            min={50}
            max={260}
            defaultValue={initial.heightCm ?? ""}
            className={inputCls}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-white">Herzfrequenz-Schwellen</h2>
        <p className="text-xs text-[#d0c5ba]">
          Wird für TRIMP (Cardio Load) verwendet. Ohne Angabe: HRmax wird aus
          Alter (Tanaka: 208 − 0.7·Alter) geschätzt, HRrest = 60.
        </p>
        <Field label="Maximale Herzfrequenz (bpm)">
          <input
            name="maxHeartRate"
            type="number"
            min={100}
            max={230}
            defaultValue={initial.maxHeartRate ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Ruhe-Herzfrequenz (bpm)">
          <input
            name="restHeartRate"
            type="number"
            min={30}
            max={120}
            defaultValue={initial.restHeartRate ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Aerobe Schwelle (bpm)">
          <input
            name="aerobicThreshold"
            type="number"
            min={80}
            max={220}
            defaultValue={initial.aerobicThreshold ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Anaerobe Schwelle (bpm)">
          <input
            name="anaerobicThreshold"
            type="number"
            min={80}
            max={220}
            defaultValue={initial.anaerobicThreshold ?? ""}
            className={inputCls}
          />
        </Field>
      </section>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-400">Gespeichert.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-[#FF6A00] px-4 py-2 text-sm font-bold uppercase tracking-[0.1em] text-black hover:bg-[#FF8533] disabled:opacity-50"
      >
        {isPending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4">
      <label className="text-sm text-[#d0c5ba]">{label}</label>
      {children}
    </div>
  );
}

function formatDateDe(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}
