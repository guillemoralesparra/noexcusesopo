import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invites, questions, reports, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { createInviteAction, resolveReportAction, setFudenAccessAction, setQuestionStatusAction } from "../actions";

export default async function AdminPage() {
  await requireAdmin();
  const db = await getDb();
  const [inviteRows, openReports, userRows, suspended] = await Promise.all([
    db.select().from(invites).orderBy(desc(invites.createdAt)),
    db
      .select({ r: reports, stem: questions.stem, user: users.displayName })
      .from(reports)
      .innerJoin(questions, eq(questions.id, reports.questionId))
      .innerJoin(users, eq(users.id, reports.userId))
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt)),
    db.select({ id: users.id, name: users.displayName, username: users.username, role: users.role, fuden: users.fudenAccess }).from(users),
    db.select({ id: questions.id, stem: questions.stem }).from(questions).where(eq(questions.status, "suspended")),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">Administració</h1>

      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">Codis d&apos;invitació</h2>
        <form action={createInviteAction} className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            Usos
            <input name="uses" type="number" min={1} max={50} defaultValue={1} className="field w-20" />
          </label>
          <button className="btn-glaze">Crear codi</button>
        </form>
        <ul className="space-y-1 text-sm">
          {inviteRows.map((i) => (
            <li key={i.code} className={i.usesLeft === 0 ? "text-ink-3 line-through" : ""}>
              <code className="rounded bg-ground px-2 py-0.5">{i.code}</code> · {i.usesLeft} usos restants · {i.role}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">Errors reportats ({openReports.length})</h2>
        {openReports.length === 0 && <p className="text-sm text-ink-3">Cap report pendent.</p>}
        {openReports.map(({ r, stem, user }) => (
          <div key={r.id} className="space-y-2 rounded-lg border border-surface-2 p-3 text-sm">
            <p className="text-ink-3">
              {r.questionId} · {user}
            </p>
            <p className="font-medium">{stem}</p>
            <p className="rounded bg-ochre-soft px-2 py-1 text-ink">{r.message}</p>
            <form action={resolveReportAction} className="flex gap-2">
              <input type="hidden" name="id" value={r.id} />
              <button name="suspend" value="1" className="btn-quiet">
                Suspendre la pregunta
              </button>
              <button name="suspend" value="0" className="btn-quiet">
                Descartar el report
              </button>
            </form>
          </div>
        ))}
      </section>

      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">Preguntes suspeses ({suspended.length})</h2>
        {suspended.map((q) => (
          <form key={q.id} action={setQuestionStatusAction} className="flex items-center gap-2 text-sm">
            <input type="hidden" name="questionId" value={q.id} />
            <input type="hidden" name="status" value="active" />
            <span className="flex-1 truncate">
              <span className="text-ink-3">{q.id}</span> {q.stem}
            </span>
            <button className="btn-quiet">Reactivar</button>
          </form>
        ))}
      </section>

      <section className="panel p-5">
        <h2 className="mb-1 font-semibold">Usuàries ({userRows.length})</h2>
        <p className="mb-3 text-sm text-ink-3">Accés FUDEN: només per a qui sigui alumna de FUDEN (material amb drets d&apos;autor, còpia privada).</p>
        <ul className="space-y-2 text-sm">
          {userRows.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                {u.name} <span className="text-ink-3">@{u.username}</span> {u.role === "admin" && "· admin"}
              </span>
              <form action={setFudenAccessAction}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="value" value={u.fuden ? "0" : "1"} />
                <button className={u.fuden ? "btn-glaze min-h-10 px-3 text-sm" : "btn-quiet min-h-10 px-3 text-sm"}>
                  {u.fuden ? "Accés FUDEN: sí" : "Accés FUDEN: no"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
