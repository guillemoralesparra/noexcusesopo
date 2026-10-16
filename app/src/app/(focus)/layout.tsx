import { requireUser } from "@/lib/auth";

/** Mode concentració: sense navegació, com una lliçó. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-dvh bg-ground">{children}</div>;
}
