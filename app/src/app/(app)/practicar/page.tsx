import { redirect } from "next/navigation";

/** Ruta antiga: cada mode té ara la seva pàgina. */
export default async function PracticeRedirect({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = (await searchParams).mode;
  redirect(mode === "exam" ? "/simulacres" : mode === "mistakes" ? "/fallades" : "/temari");
}
