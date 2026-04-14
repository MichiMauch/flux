import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { SearchClient } from "./search-client";

export default async function SearchPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <>
      <Navbar />
      <SearchClient />
    </>
  );
}
