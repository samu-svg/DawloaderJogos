/** Mensagens de autenticação — nunca expõem o provedor por trás do login. */

export const SIGNUP_CONFIRM_MESSAGE =
  "Conta criada. Enviamos um código para seu e-mail — cole-o abaixo para entrar.";

export const CONFIRM_EMAIL_PENDING_MESSAGE =
  "Confirme o e-mail para entrar. Cole o código que já enviamos ou peça outro.";

export const CONFIRM_EMAIL_SENT_MESSAGE =
  "Se este e-mail precisar de confirmação, enviamos um código. Confira também a caixa de spam.";

export const FORGOT_PASSWORD_SENT_MESSAGE =
  "Se este e-mail estiver cadastrado, enviamos um código (e, se o modelo do e-mail tiver botão, um link). Confira também a caixa de spam.";

export function isEmailNotConfirmedMessage(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("email not confirmed") ||
    lower.includes("email_not_confirmed")
  );
}

export function authErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();

  if (
    lower.includes("não foi possível") ||
    lower.includes("origem não permitida") ||
    lower.includes("já está cadastrado") ||
    lower.includes("informe nome") ||
    lower.includes("verifique os dados") ||
    lower.includes("aguarde um instante")
  ) {
    return raw;
  }

  if (
    lower.includes("email not confirmed") ||
    lower.includes("not confirmed") ||
    lower.includes("confirmation")
  ) {
    return "Digite o código que enviamos por e-mail para confirmar a conta.";
  }

  if (lower.includes("muitas tentativas") || lower.includes("too many")) {
    return "Muitas tentativas. Aguarde um instante.";
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

  if (
    lower.includes("password") &&
    (lower.includes("12") || lower.includes("6"))
  ) {
    return "A senha precisa ter pelo menos 12 caracteres.";
  }

  if (
    lower.includes("same as") ||
    lower.includes("different from the old") ||
    lower.includes("should be different")
  ) {
    return "A nova senha precisa ser diferente da atual.";
  }

  if (lower.includes("e-mail válido") || lower.includes("informe um e-mail")) {
    return "Informe um e-mail válido.";
  }

  if (lower.includes("não coincidem") || lower.includes("do not match")) {
    return "As senhas não coincidem.";
  }

  if (lower.includes("igual ao e-mail")) {
    return "A senha não pode ser igual ao e-mail.";
  }

  if (
    lower.includes("código inválido") ||
    (lower.includes("token") && lower.includes("otp"))
  ) {
    return "Código inválido ou expirado. Peça outro e-mail.";
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
