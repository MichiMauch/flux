import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import type { CoachContext } from "./coach-context";
import type { WeeklyRecap } from "./weekly-recap";
import { IntensitySchema, SportSchema } from "./coach-prompt";
import { DEFAULT_MODEL, getAiSdkClient } from "./openai";

export const WeeklyBriefingSchema = z.object({
  summary: z
    .string()
    .min(40)
    .max(600)
    .describe(
      "2–4 Sätze: Rückblick auf die letzte Woche in Alltagssprache. Was lief, wie steht die Form, wo die Reise hingeht."
    ),
  highlights: z
    .array(z.string().min(5).max(180))
    .min(0)
    .max(4)
    .describe(
      "0 bis 4 positive Punkte aus der letzten Woche als kurze Stichpunkte."
    ),
  warnings: z
    .array(
      z.object({
        severity: z.enum(["info", "warning", "alert"]),
        message: z.string().min(8).max(220),
      })
    )
    .min(0)
    .max(3)
    .describe(
      "0 bis 3 Warnhinweise (Überlastung, auffälliger Schlaf, lange Pause)."
    ),
  suggestions: z
    .array(
      z.object({
        dayOffset: z
          .number()
          .int()
          .min(0)
          .max(6)
          .describe(
            "0 = kommender Montag, 1 = Dienstag, … 6 = Sonntag der nächsten Woche."
          ),
        weekday: z.enum([
          "Montag",
          "Dienstag",
          "Mittwoch",
          "Donnerstag",
          "Freitag",
          "Samstag",
          "Sonntag",
        ]),
        sport: SportSchema,
        durationMin: z
          .number()
          .int()
          .min(0)
          .max(360)
          .describe("0 nur bei REST. Maximal 360 Minuten."),
        intensity: IntensitySchema,
        title: z
          .string()
          .min(3)
          .max(60)
          .describe(
            "Kurzer Titel, z.B. 'Lockerer Z2-Dauerlauf' oder 'Ruhetag'."
          ),
        reasoning: z
          .string()
          .min(8)
          .max(220)
          .describe(
            "Ein Satz Begründung, die sich auf Form, Schlaf, Volumen oder Ziele bezieht."
          ),
        isRestDay: z.boolean(),
      })
    )
    .length(7)
    .describe(
      "Genau 7 Vorschläge, einer pro Wochentag Mo–So, aufsteigend nach dayOffset. Ruhetage sind erlaubt und erwünscht."
    ),
});

export type WeeklyBriefing = z.infer<typeof WeeklyBriefingSchema>;
export type WeeklyBriefingSuggestion = WeeklyBriefing["suggestions"][number];
export type WeeklyBriefingWarning = WeeklyBriefing["warnings"][number];

const SYSTEM_PROMPT = `Du bist ein pragmatischer, erfahrener Trainings-Coach für Hobbysportler. Du sprichst den User per Du an, direkt, auf Augenhöhe, Schweizer Hochdeutsch (ss statt ß) ist ok.

Aufgabe: Schreibe das wöchentliche Briefing. Zwei Teile:
1. Rückblick auf die letzte abgeschlossene Woche (Mo–So) anhand der Zahlen in \`recap\`.
2. Plan für die kommende Woche — GENAU 7 Vorschläge, einer für jeden Tag Montag bis Sonntag (dayOffset 0 = Mo, 6 = So). Ruhetage sind wichtig und gehören dazu.

SEHR WICHTIG — Sprache für Nicht-Profis:
- Verwende NIEMALS Fachkürzel in deiner Ausgabe. Verboten sind: TSB, CTL, ATL, TRIMP, HRR, PMC, EWMA, Training Stress Balance, Chronic/Acute Training Load.
- Nutze stattdessen die deutschen Begriffe:
  * \`ctl\` → "Fitness"
  * \`atl\` → "Ermüdung"
  * \`tsb\` → "Bilanz"
  * \`readiness\` → "Bereitschaft"
  * \`trimp\` → "Trainingsbelastung" oder einfach umschreiben
- Zonen (Z1–Z5) dürfen erwähnt werden.
- Zahlen runden wie in der App (Fitness 61, Ermüdung 80, Bilanz −19). Keine Dezimalstellen in Prosa.

Leitplanken für die Planung (weich, nicht mechanisch):
- Bilanz < −30 am Wochenende → Mo/Di ruhig, erst ab Mitte Woche wieder Intensität.
- Bilanz −30 bis −10 → ein bis zwei intensivere Einheiten, Rest locker.
- Bilanz −10 bis +5 → normale Woche, auf Vielfalt im Sport achten.
- Bilanz > +5 → User ist frisch, gerne kürzere, knackigere Einheiten einbauen.
- Wenn die letzte Woche viel Volumen hatte (totalTrimp im Recap) → kommende Woche etwas reduzieren.
- Wenn Schlafscore deutlich unter 70 oder deutlich fallend → Warnung + lockere Woche.
- Wenn \`activeDays\` = 0 → freundlicher Wiedereinstieg, nicht zu steil.
- Wenn aktive Ziele (goals mit onPace=false) → mindestens eine zielorientierte Einheit einbauen.
- Ruhetage: 2–3 pro Woche sind normal. Mindestens 1.
- Harte Einheiten nicht direkt hintereinander — einen lockeren oder Ruhetag dazwischen.

Qualitätsregeln:
1. Der Rückblick (\`summary\`) fasst die Woche in 2–4 Sätzen zusammen. Konkret mit Zahlen (z.B. "4 Einheiten, 185 km, Fitness leicht gestiegen von 58 auf 61").
2. \`highlights\` sind kurze positive Stichpunkte (Rekord, erste Woche mit 4 Einheiten, o.Ä.). 0–4 Stück. Nichts erfinden.
3. \`warnings\` nur wenn wirklich etwas auffällt (Überlastungs-Tage, schlechter Schlaf, Pause > 5 Tage, Gewicht-Sprung). 0–3 Stück. Ton freundlich, nicht alarmistisch.
4. \`suggestions\`: GENAU 7, einer pro Tag Mo–So, sortiert nach dayOffset 0..6. Jeder Vorschlag hat \`weekday\` passend zum dayOffset.
5. Ruhetage: \`sport = REST\`, \`durationMin = 0\`, \`intensity = REST\`, \`isRestDay = true\`, Titel z.B. "Ruhetag" oder "Aktiver Spaziergang".
6. Sei spezifisch. "45 min Z2-Dauerlauf bei <140 bpm" schlägt "leichtes Training".
7. Begründe mit Zahlen aus dem Kontext in Alltagssprache.
8. Keine medizinischen Ratschläge. Bei klarer Überlastung: Ruhe zuerst.

Schreibe kurz. Jeder Satz zählt.`;

export async function generateWeeklyBriefing(
  ctx: CoachContext,
  recap: WeeklyRecap
): Promise<WeeklyBriefing> {
  const openai = getAiSdkClient();
  const name = ctx.user.name ?? "der User";

  const prompt = `Erstelle das Wochen-Briefing für ${name}.

Heute ist ${ctx.weekday}, ${ctx.today}. Die abgeschlossene Woche (${recap.weekStart} – ${recap.weekEnd}, KW ${recap.isoWeek}) liegt im \`recap\`. Der aktuelle Trainingszustand (inkl. Schlaf/Gewicht) steht im \`context\`.

\`\`\`json
${JSON.stringify({ context: ctx, recap }, null, 2)}
\`\`\`

Liefere Rückblick + Highlights + Warnungen + GENAU 7 Tagesvorschläge für die kommende Woche Mo–So.`;

  const result = await generateObject({
    model: openai(DEFAULT_MODEL),
    schema: WeeklyBriefingSchema,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.4,
  });

  return result.object;
}
