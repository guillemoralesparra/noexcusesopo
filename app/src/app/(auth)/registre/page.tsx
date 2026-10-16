import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { register } from "../actions";

export default function RegisterPage() {
  return (
    <>
      <AuthForm
        action={register}
        submit="Crear compte"
        fields={[
          { name: "code", label: "Codi d'invitació" },
          { name: "displayName", label: "Nom", autoComplete: "given-name" },
          { name: "username", label: "Usuari", autoComplete: "username" },
          { name: "password", label: "Contrasenya (mínim 8 caràcters)", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p className="mt-4 text-center text-[15px] text-ink-2">
        Ja tens compte?{" "}
        <Link href="/entrar" className="font-semibold text-glaze underline">
          Entra
        </Link>
      </p>
    </>
  );
}
