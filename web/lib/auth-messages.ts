/** Mensagens de autenticação — nunca expõem o provedor por trás do login. */

export const SIGNUP_CONFIRM_MESSAGE =
  "Conta criada. Enviamos um código para seu e-mail — confirme para entrar.";

export function authErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();

  if (
    lower.includes("email not confirmed") ||
    lower.includes("not confirmed") ||
    lower.includes("confirmation")
  ) {
    return "Enviamos um código para seu e-mail. Confirme antes de entrar.";
  }

  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid email or password")
  ) {
    return "E-mail ou senha incorretos.";
  }

  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already registered")
  ) {
    return "Este e-mail já está cadastrado.";
  }

  if (lower.includes("password") && lower.includes("6")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  if (
    lower.includes("supabase") ||
    lower.includes("postgres") ||
    lower.includes("database") ||
    lower.includes("sql") ||
    lower.includes("jwt")
  ) {
    return "Não foi possível concluir. Tente novamente em instantes.";
  }

  return "Não foi possível concluir. Verifique os dados e tente novamente.";
}
