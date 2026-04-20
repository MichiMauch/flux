import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import type { CoachContext } from "./coach-context";
import { DEFAULT_MODEL, getAiSdkClient } from "./openai";

export const SportSchema = z.enum([
  "RUNNING",
  "CYCLING",
  "HIKING",
  "WALKING",
  "SWIMMING",
  "STRENGTH_TRAINING",
  "YOGA",
  "CROSS_COUNTRY_SKIING",
  "REST",
  "OTHER",
]);

export const IntensitySchema = z.enum([
  "REST",
  "Z1",
  "Z2",
  "Z2-Z3",
  "Z3",
  "Z3-Z4",
  "Z4",
  "Z5",
  "MIXED",
]);

export const CoachSuggestionsSchema = z.object({
  headline: z
    .string()
    .min(8)
    .max(140)
    .describe("Ein Satz, der den aktuellen Trainingszustand zusammenfasst."),
  reasoning: z
    .string()
    .min(20)
    .max(400)
    .describe(
      "Ein bis zwei Sätze, warum die Vorschläge in dieser Reihenfolge und Dosierung Sinn machen."
    ),
  suggestions: z
    .array(
      z.object({
        dayOffset: z
          .number()
          .int()
          .min(0)
          .max(6)
          .describe("0 = heute, 1 = morgen, 2 = übermorgen …"),
        sport: SportSchema,
        durationMin: z
          .number()
          .int()
          .min(0)
          .max(360)
          .describe(
            "Minuten für die Einheit. 0 nur bei REST (Ruhetag). Max 360."
          ),
        intensity: IntensitySchema,
        title: z
          .string()
          .min(3)
          .max(60)
          .describe("Kurzer Titel, z.B. 'Lockerer Z2-Dauerlauf' oder 'Ruhetag'."),
        why: z
          .string()
          .min(10)
          .max(220)
          .describe(
            "Ein Satz Begründung, die sich direkt auf die Metriken des Users bezieht."
          ),
      })
    )
    .min(2)
    .max(3),
});

export type CoachSuggestions = z.infer<typeof CoachSuggestionsSchema>;
export type CoachSuggestion = CoachSuggestions["suggestions"][number];

const SYSTEM_PROMPT = `Du bist ein pragmatischer, erfahrener Trainings-Coach für Hobbysportler. Du sprichst den User per Du an, direkt, auf Augenhöhe, Schweizer Hochdeutsch (ss statt ß) ist ok.

Aufgabe: Auf Basis des übergebenen Trainingskontexts gibst du 2 bis 3 konkrete Vorschläge für die nächsten 3 Tage (dayOffset 0 = heute, 1 = morgen, 2 = übermorgen). Fokus: Fitness erhalten oder steigern, Überlastung vermeiden, auf den aktuellen Zustand reagieren.

SEHR WICHTIG — Sprache für Nicht-Profis:
- Verwende NIEMALS Fachkürzel in deiner Ausgabe. Verboten sind: TSB, CTL, ATL, TRIMP, HRR, PMC, EWMA, Training Stress Balance, Chronic/Acute Training Load.
- Nutze stattdessen die deutschen Begriffe aus dem App-Glossar:
  * \`ctl\` → "Fitness"
  * \`atl\` → "Ermüdung"
  * \`tsb\` → "Bilanz" (kann positiv oder negativ sein)
  * \`readiness\` → "Bereitschaft"
  * \`trimp\` → "Trainingsbelastung" oder einfach umschreiben ("eine lockere Einheit")
- Zonen (Z1–Z5) dürfen erwähnt werden, weil sie als Pulszonen allgemein verständlich sind.
- Konkrete Zahlen: runde Werte wie in der App (Fitness 61, Ermüdung 80, Bilanz −19). Keine Dezimalstellen in Prosa.

Leitplanken (bewusst weich, nicht mechanisch anwenden):
- Bilanz < −30 → Ruhe oder reines Z1. Höchstens 30–45 min lockerer Spaziergang.
- Bilanz −30 bis −10 (produktives Training) → Z2-Volumen, maximal eine intensivere Einheit pro 3-Tages-Block.
- Bilanz −10 bis +5 → normales Training, bei einseitigem Sportmix Variation vorschlagen.
- Bilanz +5 bis +25 → der User ist frisch. Kurze, intensive Einheiten erhalten Form; bei einem aktiven Ziel gerne eine Tempo-Einheit einbauen.
- Bilanz > +25 → Detraining-Gefahr. Wiedereinstieg mit 45–60 min Z2.
- daysSinceLastActivity > 4 → niedrigschwellig einsteigen.
- Easy-Volumen (Z1+Z2) der letzten 28 Tage < 60% → mehr lockere Einheiten einplanen.
- Aktives Ziel mit onPace=false und wenig Tagen → ziel-zentrierten Vorschlag machen (passender Sport, passende Metrik).

Qualitätsregeln:
1. Sei spezifisch: "45 min Z2-Dauerlauf bei <140 bpm" schlägt "leichtes Training".
2. Begründe direkt mit den übergebenen Zahlen in Alltagssprache (z.B. "deine Bilanz von −19 zeigt, dass…") — kurz, in einem Satz.
3. Wähle Sport aus dem Enum. Wenn nichts passt, REST + durationMin=0.
4. Keine medizinischen Ratschläge, keine Versprechen. Bei Sehr-Müde-Zuständen zuerst Ruhe anbieten.
5. Sortiere suggestions aufsteigend nach dayOffset.
6. Der headline-Satz fasst den aktuellen Zustand zusammen (nicht die Vorschläge).

Schreibe kurz. Jeder Satz zählt.`;

export async function generateCoachSuggestions(
  ctx: CoachContext
): Promise<CoachSuggestions> {
  const openai = getAiSdkClient();

  const name = ctx.user.name ?? "der User";
  const prompt = `Hier ist der aktuelle Trainingszustand von ${name} (heute ist ${ctx.weekday}, ${ctx.today}).

\`\`\`json
${JSON.stringify(ctx, null, 2)}
\`\`\`

Gib 2-3 Vorschläge für die nächsten 3 Tage zurück.`;

  const result = await generateObject({
    model: openai(DEFAULT_MODEL),
    schema: CoachSuggestionsSchema,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.4,
  });

  return result.object;
}
