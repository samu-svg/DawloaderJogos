import { redirect } from "next/navigation";

/** Cadastro público desativado — use /login com a conta de administrador. */
export default function CadastroPage() {
  redirect("/login?cadastro=fechado");
}
