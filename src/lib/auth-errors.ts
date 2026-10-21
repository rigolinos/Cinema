// Mensagens de erro do login e do cadastro em português, pelo código que o Supabase devolve.

const BY_CODE: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed: "Falta confirmar o seu e-mail. Abra o link que enviamos e entre de novo.",
  user_already_exists: "Já existe uma conta com este e-mail. Tente entrar.",
  email_exists: "Já existe uma conta com este e-mail. Tente entrar.",
  weak_password: "Senha fraca. Use uma senha mais longa, misturando letras e números.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_email_send_rate_limit: "Muitos e-mails enviados agora. Espere alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas seguidas. Espere um pouco e tente de novo.",
  signup_disabled: "Os cadastros estão fechados no momento.",
  email_address_invalid: "Este e-mail não parece válido.",
  validation_failed: "Confira o e-mail e a senha.",
};

const BY_MESSAGE: [RegExp, string][] = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/already registered|already exists/i, BY_CODE.user_already_exists],
  [/password should be|weak password/i, BY_CODE.weak_password],
  [/rate limit/i, BY_CODE.over_request_rate_limit],
  [/fetch|network/i, "Sem conexão. Confira a internet e tente de novo."],
];

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Algo deu errado. Tente de novo.";
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const match = BY_MESSAGE.find(([re]) => re.test(error.message ?? ""));
  return match ? match[1] : "Algo deu errado. Tente de novo.";
}

// Para onde o link do e-mail volta: a rota que troca o código pela sessão.
export function authCallbackUrl(origin: string, next: string): string {
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(next)}`;
}

// Só aceita voltar para dentro do próprio app.
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/inicio";
}
