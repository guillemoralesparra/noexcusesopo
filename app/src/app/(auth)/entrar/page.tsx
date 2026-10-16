import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <>
      <AuthForm
        action={login}
        submit="Entrar"
        fields={[
          { name: "username", label: "Usuari", autoComplete: "username" },
          { name: "password", label: "Contrasenya", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="mt-4 text-center text-[15px] text-ink-2">
        Tens un codi d&apos;invitació?{" "}
        <Link href="/registre" className="font-semibold text-glaze underline">
          Crea el teu compte
        </Link>
      </p>
    </>
  );
}
