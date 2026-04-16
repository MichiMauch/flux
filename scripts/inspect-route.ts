import "dotenv/config";
import { db } from "../src/lib/db";
import { activities } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [a] = await db
    .select()
    .from(activities)
    .where(eq(activities.id, "ed90448c-fc3e-4e04-aed1-1139bfd2f713"))
    .limit(1);
  const r = (a?.routeData as Record<string, unknown>[] | null) ?? [];
  console.log("len:", r.length);
  console.log("first:", JSON.stringify(r[0]));
  console.log("keys:", r[0] ? Object.keys(r[0]) : "none");
  process.exit(0);
}
main();
