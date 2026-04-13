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
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

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
        <h2 className="font-semibold">Persönliche Angaben</h2>
        <Field label="Name">
          <input
            name="name"
            type="text"
            defaultValue={initial.name ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Geburtstag">
          <input
            name="birthday"
            type="date"
            defaultValue={initial.birthday ?? ""}
            className={inputCls}
          />
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
        <h2 className="font-semibold">Herzfrequenz-Schwellen</h2>
        <p className="text-xs text-muted-foreground">
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

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">Gespeichert.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-4">
      <label className="text-sm">{label}</label>
      {children}
    </div>
  );
}
