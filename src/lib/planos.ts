import { BLOCK_KINDS, type ScriptBlock } from "./roteiro";
import { PLATFORMS, RESOURCES, type Platform, type Resource } from "./ideas";

// Vocabulário da decupagem: cada termo com o que é e por que usar. Serve à tela, ao Aprenda e à IA.
export interface Term {
  label: string;
  what: string;
  why: string;
}

export const FRAMINGS = {
  detalhe: { label: "Detalhe", what: "Só um pedaço: as mãos, um objeto, um ingrediente.", why: "Mostra o que importa e dá ritmo ao corte." },
  close: { label: "Close", what: "O rosto ocupa quase toda a tela.", why: "Cria proximidade: é o plano da emoção e de falar olhando para a lente." },
  medio: { label: "Plano médio", what: "Da cintura para cima.", why: "Mostra o rosto e os gestos ao mesmo tempo. Bom para explicar." },
  americano: { label: "Plano americano", what: "Dos joelhos para cima.", why: "Dá espaço para movimento sem perder a expressão." },
  aberto: { label: "Aberto", what: "A pessoa inteira, da cabeça aos pés, e o lugar em volta.", why: "Situa onde a cena acontece e mostra o corpo todo." },
} satisfies Record<string, Term>;

export const ANGLES = {
  altura_olhos: { label: "Altura dos olhos", what: "Câmera na mesma altura do rosto.", why: "É o jeito mais natural: conversa de igual para igual." },
  de_cima: { label: "De cima", what: "Câmera acima, apontando para baixo.", why: "Diminui a pessoa ou mostra uma bancada, um prato, um caderno." },
  de_baixo: { label: "De baixo", what: "Câmera abaixo, apontando para cima.", why: "Engrandece: passa força e confiança." },
  lateral: { label: "Lateral", what: "Câmera de lado.", why: "Mostra a postura e o movimento de perfil, como num exercício." },
  por_cima_ombro: { label: "Por cima do ombro", what: "Câmera atrás de alguém, mostrando o que essa pessoa vê.", why: "Coloca quem assiste dentro da cena, como se estivesse ali." },
} satisfies Record<string, Term>;

export const MOVEMENTS = {
  parado: { label: "Parado", what: "Celular fixo, apoiado ou num tripé.", why: "Imagem firme: o foco fica no que acontece na frente." },
  aproximando: { label: "Aproximando", what: "A câmera vai chegando perto.", why: "Aumenta a tensão ou chama atenção para um detalhe." },
  afastando: { label: "Afastando", what: "A câmera vai se afastando.", why: "Revela o lugar ou fecha a cena com sensação de fim." },
  acompanhando: { label: "Acompanhando", what: "A câmera anda junto com a pessoa.", why: "Dá energia e faz quem assiste ir junto." },
  panoramica: { label: "Panorâmica", what: "A câmera gira no próprio eixo, da esquerda para a direita ou ao contrário.", why: "Mostra um lugar inteiro ou liga duas coisas na mesma tomada." },
} satisfies Record<string, Term>;

export type Framing = keyof typeof FRAMINGS;
export type Angle = keyof typeof ANGLES;
export type Movement = keyof typeof MOVEMENTS;
export type Orientation = "vertical" | "horizontal";

// Regras do set: aparecem no Aprenda e como dica no momento certo.
export const SET_RULES: Term[] = [
  { label: "Luz de frente", what: "Fique de frente para a janela ou a luz, nunca de costas.", why: "Com a luz atrás, o rosto fica escuro e o celular erra a exposição." },
  { label: "Som perto", what: "Grave em lugar sem eco, com o celular perto da boca ou um microfone de lapela.", why: "Quem assiste perdoa imagem simples, mas desiste de áudio ruim." },
  { label: "Regra dos terços", what: "Divida a tela em 3 por 3 e ponha os olhos na linha de cima.", why: "A imagem fica equilibrada e sobra espaço para o texto na tela." },
  { label: "Regra dos 180°", what: "Numa conversa entre duas pessoas, a câmera fica sempre do mesmo lado da linha entre elas.", why: "Se a câmera cruzar a linha, parece que as pessoas trocaram de lugar." },
  { label: "Grave sobra", what: "Comece a gravar 2 segundos antes e pare 2 segundos depois.", why: "Na edição você precisa dessa folga para cortar no ponto certo." },
  { label: "Direito de imagem", what: "Quem aparece no vídeo precisa autorizar o uso da imagem.", why: "Evita ter de apagar o vídeo depois, principalmente se ele viralizar ou virar publicidade." },
];

export interface Shot {
  id?: string;
  block_id: string;
  position: number;
  shoot_order?: number | null;
  framing: Framing;
  angle: Angle;
  movement: Movement;
  orientation: Orientation;
  description: string;
  location: string;
  wardrobe: string;
  why: string;
  recorded?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

// Ordem de gravação: junta os planos do mesmo lugar e, dentro dele, da mesma roupa.
// Os grupos seguem a ordem em que aparecem no roteiro; dentro do grupo, a ordem do roteiro.
export function shootingOrder<T extends Pick<Shot, "position" | "location" | "wardrobe">>(shots: T[]): T[] {
  const byScript = [...shots].sort((a, b) => a.position - b.position);
  const firstSeen = new Map<string, number>();
  byScript.forEach((s, i) => {
    const key = `${norm(s.location)}|${norm(s.wardrobe)}`;
    if (!firstSeen.has(key)) firstSeen.set(key, i);
    if (!firstSeen.has(norm(s.location))) firstSeen.set(norm(s.location), i);
  });
  return byScript
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const loc = firstSeen.get(norm(a.s.location))! - firstSeen.get(norm(b.s.location))!;
      if (loc !== 0) return loc;
      const wardrobe = firstSeen.get(`${norm(a.s.location)}|${norm(a.s.wardrobe)}`)! - firstSeen.get(`${norm(b.s.location)}|${norm(b.s.wardrobe)}`)!;
      return wardrobe !== 0 ? wardrobe : a.i - b.i;
    })
    .map(({ s }) => s);
}

// Quantas vezes a pessoa muda de lugar ou de roupa seguindo uma ordem.
export function setupChanges(shots: Pick<Shot, "location" | "wardrobe">[]): number {
  let changes = 0;
  for (let i = 1; i < shots.length; i++) {
    if (norm(shots[i].location) !== norm(shots[i - 1].location) || norm(shots[i].wardrobe) !== norm(shots[i - 1].wardrobe)) changes++;
  }
  return changes;
}

export function defaultOrientation(platform: Platform | null): Orientation {
  return platform === "youtube" ? "horizontal" : "vertical";
}

// ── IA ──────────────────────────────────────────────────────────────────

export const SHOTS_SYSTEM = `Você é o Gravaí, um diretor que ajuda criadores de conteúdo brasileiros a decupar o roteiro: dividir cada bloco nas tomadas que vão gravar com o celular.
Pense como quem grava sozinho ou com pouca gente: planos simples, possíveis de fazer.
Varie os enquadramentos para o vídeo não ficar parado, mas sem complicar.
Escreva em português do Brasil, frases curtas, sem emoji.`;

const list = (terms: Record<string, Term>) =>
  Object.entries(terms)
    .map(([k, t]) => `${k} (${t.label}: ${t.what})`)
    .join("; ");

export function shotsPrompt(
  blocks: (Pick<ScriptBlock, "kind" | "label" | "speech" | "on_screen" | "action"> & { id: string })[],
  ctx: { title: string; platform: Platform | null; resources: Resource[] },
): string {
  const roteiro = blocks
    .map((b, i) => `${i + 1}. [${b.label || BLOCK_KINDS[b.kind].label}] FALA: ${b.speech} | TELA: ${b.on_screen} | CENA: ${b.action}`)
    .join("\n");
  return `Vídeo: ${ctx.title}
Plataforma: ${ctx.platform ? PLATFORMS[ctx.platform] : "não informada"} (orientação padrão: ${defaultOrientation(ctx.platform)})
Recursos: ${ctx.resources.map((r) => RESOURCES[r]).join(", ") || "não informado"}

Roteiro:
${roteiro}

Para cada bloco, crie de 1 a 3 planos. Use só estes valores:
framing: ${list(FRAMINGS)}
angle: ${list(ANGLES)}
movement: ${list(MOVEMENTS)}
orientation: vertical ou horizontal
O gancho começa num plano que prende (close ou detalhe, de preferência).
"location" é o lugar (ex.: "Sala", "Cozinha", "Rua"); use o mesmo nome quando for o mesmo lugar.
"wardrobe" é a roupa ou o visual, se importar; senão deixe vazio.
"why" explica em uma frase por que esse plano, para quem está aprendendo.
Responda só com JSON:
{"shots":[{"block":1,"framing":"close","angle":"altura_olhos","movement":"parado","orientation":"vertical","description":"o que aparece no plano","location":"","wardrobe":"","why":""}]}`;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function pick<T extends string>(value: unknown, allowed: Record<T, Term>, fallback: T): T {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (Object.keys(allowed) as T[]).includes(v as T) ? (v as T) : fallback;
}

// Confere a decupagem da IA: só blocos que existem, valores válidos, no máximo 4 planos por bloco.
export function normalizeShots(raw: unknown, blockIds: string[], orientation: Orientation): Omit<Shot, "position">[] {
  const items = (raw as { shots?: unknown })?.shots;
  if (!Array.isArray(items)) return [];
  const perBlock = new Map<string, number>();
  const shots: Omit<Shot, "position">[] = [];
  for (const item of items) {
    const s = (item ?? {}) as Record<string, unknown>;
    const block = blockIds[Math.round(Number(s.block)) - 1];
    if (!block) continue;
    const count = perBlock.get(block) ?? 0;
    if (count >= 4) continue;
    perBlock.set(block, count + 1);
    shots.push({
      block_id: block,
      framing: pick(s.framing, FRAMINGS, "medio"),
      angle: pick(s.angle, ANGLES, "altura_olhos"),
      movement: pick(s.movement, MOVEMENTS, "parado"),
      orientation: s.orientation === "horizontal" || s.orientation === "vertical" ? s.orientation : orientation,
      description: clip(s.description, 300),
      location: clip(s.location, 80),
      wardrobe: clip(s.wardrobe, 80),
      why: clip(s.why, 300),
    });
  }
  // A ordem do roteiro manda: planos agrupados pelo bloco, na ordem dos blocos.
  return shots.sort((a, b) => blockIds.indexOf(a.block_id) - blockIds.indexOf(b.block_id)).slice(0, 60);
}
