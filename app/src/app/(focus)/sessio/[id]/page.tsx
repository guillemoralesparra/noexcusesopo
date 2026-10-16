import { notFound, redirect } from "next/navigation";
import { ExamRunner } from "@/components/ExamRunner";
import { PracticeRunner } from "@/components/PracticeRunner";
import { requireUser } from "@/lib/auth";
import { getSessionView } from "@/lib/practice";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const view = await getSessionView(user.id, id);
  if (!view) notFound();
  if (view.finishedAt) redirect(`/sessio/${id}/resultat`);
  return view.immediateFeedback ? <PracticeRunner view={view} /> : <ExamRunner view={view} />;
}
