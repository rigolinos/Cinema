// Pessoas do vídeo: funções, o termo de uso de imagem e o convite pelo link.

export type PersonRole = "eu" | "ator" | "filma" | "equipe";

export const ROLES: Record<PersonRole, { label: string; as: string }> = {
  eu: { label: "Eu", as: "criador" },
  ator: { label: "Aparece no vídeo", as: "para aparecer no vídeo" },
  filma: { label: "Quem filma", as: "para filmar" },
  equipe: { label: "Ajuda no set", as: "para ajudar no set" },
};

// Versão do termo: se o texto mudar, a versão sobe e quem já aceitou continua com a versão antiga guardada.
export const CONSENT_VERSION = "imagem-v1";

// Texto-base do termo de uso de imagem. Precisa de revisão jurídica antes do lançamento.
export function consentText(creator: string, title: string): string[] {
  return [
    `Autorizo ${creator} a usar, sem cobrar nada, a minha imagem e a minha voz gravadas para o vídeo “${title}”.`,
    "O vídeo pode ser publicado em redes sociais e plataformas de vídeo, inteiro ou em trechos, inclusive em divulgação do próprio vídeo.",
    "Posso pedir a qualquer momento para não aparecer em publicações novas. O que já foi publicado antes do pedido pode continuar no ar.",
    "Declaro que tenho 18 anos ou mais.",
  ];
}

export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/p/${token}`;
}

// Uma pessoa pode ter mais de um papel (atua e filma). O primeiro, nesta ordem, é o principal.
export type GuestRole = Exclude<PersonRole, "eu">;
export const GUEST_ROLES: GuestRole[] = ["ator", "filma", "equipe"];

export function sortRoles(roles: readonly GuestRole[]): GuestRole[] {
  return GUEST_ROLES.filter((r) => roles.includes(r));
}

// "para aparecer no vídeo e filmar"
const VERBS: Record<GuestRole, string> = { ator: "aparecer no vídeo", filma: "filmar", equipe: "ajudar no set" };
export function rolesAs(roles: readonly GuestRole[]): string {
  const v = sortRoles(roles).map((r) => VERBS[r]);
  return `para ${v.length > 1 ? `${v.slice(0, -1).join(", ")} e ${v.at(-1)}` : (v[0] ?? "ajudar")}`;
}

// "você aparece e filma", para a linha de cima do link
const YOU: Record<GuestRole, string> = { ator: "aparece", filma: "filma", equipe: "ajuda no set" };
export function rolesYou(roles: readonly GuestRole[]): string {
  const v = sortRoles(roles).map((r) => YOU[r]);
  return `você ${v.length > 1 ? `${v.slice(0, -1).join(", ")} e ${v.at(-1)}` : (v[0] ?? "ajuda")}`;
}

// Mensagem pronta para mandar pelo WhatsApp (a pessoa escolhe o contato no próprio WhatsApp).
export function inviteMessage(name: string, roles: readonly GuestRole[], title: string, url: string): string {
  const acts = roles.includes("ator");
  const crew = roles.some((r) => r !== "ator");
  const what = acts && crew ? "suas falas, o roteiro e os planos" : acts ? "suas falas e cenas" : "o roteiro e os planos";
  return `Oi, ${name.trim().split(/\s+/)[0]}! Vou gravar “${title}” e você está no time. Aqui estão ${what}: ${url}`;
}

export function whatsappLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Nome para o termo: pelo menos nome e sobrenome.
export function validConsentName(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter((p) => p.length >= 2);
  return parts.length >= 2 && name.trim().length <= 120;
}

export function formatShootDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
