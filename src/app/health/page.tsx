import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { Heart } from "lucide-react";

export default async function HealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Gesundheit</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <h2 className="font-semibold mb-4">Gewicht</h2>
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">Verbinde Withings, um Gewichtsdaten zu sehen.</p>
            </div>
          </div>

          <div className="rounded-lg border p-6">
            <h2 className="font-semibold mb-4">Blutdruck</h2>
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Heart className="h-8 w-8 mb-2" />
              <p className="text-sm">Blutdruck-Daten werden später importiert.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
