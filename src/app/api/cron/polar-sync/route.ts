/**
 * POST /api/cron/polar-sync — VERALTET.
 *
 * Der Sweep bedient längst beide Quellen und heisst deshalb /api/cron/sync.
 * Dieser Pfad bleibt als Weiterleitung bestehen, damit der Coolify Scheduled
 * Task nicht ins Leere läuft, solange er noch auf den alten Namen zeigt.
 *
 * Sobald der Task umgehängt ist, kann diese Datei ersatzlos weg — im Log steht
 * dann keine Warnung mehr.
 */

import type { NextRequest } from "next/server";
import { POST as sweep } from "../sync/route";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  console.warn(
    "[cron/polar-sync] veralteter Pfad aufgerufen — Coolify Scheduled Task auf /api/cron/sync umstellen"
  );
  return sweep(req);
}
