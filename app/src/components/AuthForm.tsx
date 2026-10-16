"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(auth)/actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string };

export function AuthForm({
  action,
  fields,
  submit,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="panel p-5 space-y-4">
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1 block text-sm font-medium">{f.label}</span>
          <input className="field" name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required />
        </label>
      ))}
      {state?.error && <p className="rounded-lg bg-brick-soft px-3 py-2 text-sm text-brick">{state.error}</p>}
      <button className="btn-glaze w-full" disabled={pending}>
        {pending ? "Un moment…" : submit}
      </button>
    </form>
  );
}
