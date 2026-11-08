import { BLOCK_KINDS, type ScriptBlock } from "./roteiro";
import { PLATFORMS, RESOURCES, type Platform, type Resource } from "./ideas";
import { isMe } from "./convidado";
import { firstNameOf, onCamera } from "./pessoas";

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
  person_ids?: string[]; // quem aparece neste plano
}

type CastPerson = { id: string; name: string; role: string; roles?: string[] | null };

// Quem pode estar num plano, com o nome curto: quem criou o vídeo primeiro e quem aparece no vídeo.
// Quem só filma ou ajuda no set fica de fora. Dois com o mesmo primeiro nome vão com o nome inteiro.
export function castOf(people: CastPerson[]): { id: string; label: string }[] {
  const cast = people.filter(onCamera);
  const ordered = [...cast.filter((p) => p.role === "eu"), ...cast.filter((p) => p.role !== "eu")];
  const short = (p: CastPerson) => (p.name.trim() && p.name.trim() !== "Eu" ? firstNameOf(p.name) : "Você");
  return ordered.map((p) => ({
    id: p.id,
    label: ordered.filter((o) => short(o) === short(p)).length > 1 ? p.name.trim() : short(p),
  }));
}

// Os nomes de quem está no plano. Vídeo com uma pessoa só não precisa dizer quem é.
export function shotPeople(shot: Pick<Shot, "person_ids">, people: CastPerson[]): string[] {
  const cast = castOf(people);
  if (cast.length < 2) return [];
  const ids = shot.person_ids ?? [];
  return cast.filter((c) => ids.includes(c.id)).map((c) => c.label);
}

// Os nomes que a IA trouxe viram as pessoas do vídeo; nome que não é de ninguém do vídeo é ignorado.
function castIds(value: unknown, people: CastPerson[]): string[] {
  const cast = castOf(people);
  if (cast.length < 2 || !Array.isArray(value)) return [];
  const names = value.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  return cast
    .filter(({ id }) => {
      const person = people.find((p) => p.id === id)!;
      return names.some((n) => isMe(n, person.name) || (person.role === "eu" && /^(eu|voc[eê])$/i.test(n.trim())));
    })
    .map((c) => c.id);
}

// O que mudou por último no roteiro.
export function newestChange(blocks: { updated_at?: string }[]): string {
  return blocks.reduce((latest, b) => ((b.updated_at ?? "") > latest ? (b.updated_at ?? "") : latest), "");
}

// O roteiro mudou depois de os planos serem feitos? Conta a criação, não a edição: mexer num plano não atualiza o roteiro.
export function plansOutdated(blocks: { updated_at?: string }[], shots: { created_at?: string }[]): boolean {
  const newest = Date.parse(newestChange(blocks));
  const made = shots.map((s) => Date.parse(s.created_at ?? "")).filter((t) => !Number.isNaN(t));
  if (Number.isNaN(newest) || made.length === 0) return false;
  return newest > Math.min(...made);
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

// Etiquetas do cartão: o enquadramento sempre; ângulo e movimento só quando fogem do padrão.
// A orientação já aparece no desenho do enquadramento.
export function shotTags(shot: Pick<Shot, "framing" | "angle" | "movement">): string[] {
  return [
    FRAMINGS[shot.framing].label,
    shot.angle !== "altura_olhos" ? ANGLES[shot.angle].label : "",
    shot.movement !== "parado" ? MOVEMENTS[shot.movement].label : "",
  ].filter(Boolean);
}

// O enquadramento em palavras de todo dia, para a folha do vídeo; a edição do plano mantém os termos técnicos.
export const FRAMING_PLAIN: Record<Framing, string> = {
  detalhe: "Detalhe",
  close: "De perto",
  medio: "Meio corpo",
  americano: "Do joelho para cima",
  aberto: "De longe",
};

export function shotPlainTags(shot: Pick<Shot, "framing" | "angle" | "movement">): string[] {
  return [
    FRAMING_PLAIN[shot.framing],
    shot.angle !== "altura_olhos" ? ANGLES[shot.angle].label : "",
    shot.movement !== "parado" ? MOVEMENTS[shot.movement].label : "",
  ].filter(Boolean);
}

// Lugar e roupa só no plano em que mudam (o primeiro sempre mostra): repetir em todo cartão vira ruído.
export function setupLabel(shots: Pick<Shot, "location" | "wardrobe">[], index: number): string {
  const shot = shots[index];
  const prev = shots[index - 1];
  if (prev && norm(prev.location) === norm(shot.location) && norm(prev.wardrobe) === norm(shot.wardrobe)) return "";
  return [shot.location, shot.wardrobe].map((x) => x.trim()).filter(Boolean).join(" · ");
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

// Quantos planos cabem no vídeo: mais ou menos um a cada 3,5 segundos, entre 4 e 24.
export function maxShots(durationS: number | null): number {
  return Math.min(24, Math.max(4, Math.round((durationS ?? 30) / 3.5)));
}

// Gravando sozinho: o celular fica apoiado, não há quem ande com a câmera.
export function isSolo(resources: Resource[]): boolean {
  return resources.includes("sozinho") && !resources.includes("com_alguem");
}

export function shotsPrompt(
  blocks: (Pick<ScriptBlock, "kind" | "label" | "speech" | "on_screen" | "action"> & { id: string })[],
  ctx: { title: string; platform: Platform | null; resources: Resource[]; durationS: number | null },
): string {
  const roteiro = blocks
    .map((b, i) => `${i + 1}. [${b.label || BLOCK_KINDS[b.kind].label}] FALA: ${b.speech} | TELA: ${b.on_screen} | CENA: ${b.action}`)
    .join("\n");
  const limit = maxShots(ctx.durationS);
  return `Vídeo: ${ctx.title}
Plataforma: ${ctx.platform ? PLATFORMS[ctx.platform] : "não informada"} (orientação padrão: ${defaultOrientation(ctx.platform)})
Duração: cerca de ${ctx.durationS ?? 30} segundos
Recursos: ${ctx.resources.map((r) => RESOURCES[r]).join(", ") || "não informado"}

Roteiro:
${roteiro}

Crie os planos de cada bloco: blocos curtos ficam com 1 plano, os mais longos com 2. No total, NO MÁXIMO ${limit} planos.
${isSolo(ctx.resources) ? 'A pessoa grava SOZINHA, com o celular apoiado: nada de "acompanhando"; prefira câmera parada. Movimentos só em detalhes que ela mesma filma com o celular na mão.\n' : ""}Use só estes valores:
framing: ${list(FRAMINGS)}
angle: ${list(ANGLES)}
movement: ${list(MOVEMENTS)}
orientation: vertical ou horizontal
O gancho começa num plano que prende (close ou detalhe, de preferência).
"location" é o lugar (ex.: "Sala", "Cozinha", "Rua"); use o mesmo nome quando for o mesmo lugar.
"wardrobe": deixe vazio em todos os planos, a não ser que a roupa mude durante o vídeo; se mudar, preencha em todos.
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

// Roupa: com um visual só (ou nenhum), o campo fica vazio em todos, para não inventar troca de cenário.
// Com mais de um, quem ficou em branco herda a roupa do plano anterior.
export function normalizeWardrobe<T extends { wardrobe: string }>(shots: T[]): T[] {
  const looks = new Set(shots.map((s) => s.wardrobe.trim().toLowerCase()).filter(Boolean));
  if (looks.size <= 1) return shots.map((s) => ({ ...s, wardrobe: "" }));
  let last = shots.find((s) => s.wardrobe.trim())?.wardrobe.trim() ?? "";
  return shots.map((s) => {
    if (s.wardrobe.trim()) last = s.wardrobe.trim();
    return { ...s, wardrobe: last };
  });
}

// "Sala" e "Sala de estar" no mesmo vídeo são o mesmo lugar: fica o nome mais completo.
// Se o nome curto cabe em dois lugares diferentes ("Sala de estar" e "Sala de jantar"), não junta.
// Maiúscula e acento diferentes também viram o mesmo lugar.
export function unifyPlaces<T extends { location: string }>(shots: T[]): T[] {
  const fold = (s: string) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
  const shown = new Map<string, string>();
  for (const s of shots) {
    const name = s.location.trim();
    if (name && !shown.has(fold(name))) shown.set(fold(name), name);
  }
  const keys = [...shown.keys()];
  const target = new Map<string, string>();
  for (const k of keys) {
    const inside = new RegExp(`(^| )${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);
    const wider = keys.filter((o) => o !== k && inside.test(o));
    target.set(k, wider.length === 1 ? wider[0] : k);
  }
  return shots.map((s) => (s.location.trim() ? { ...s, location: shown.get(target.get(fold(s.location))!)! } : s));
}

// Palavras que contam numa descrição de plano: sem acento, sem as pequenas ("a", "de", "com"),
// e pelo começo, para "sorri" e "sorrindo" contarem como a mesma.
const SMALL_WORDS = new Set("a o as os e de da do das dos em na no nas nos um uma uns umas com para pra por que se ao aos à às sua seu suas seus ela ele".split(" "));
function descriptionWords(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 1 && !SMALL_WORDS.has(w))
      .map((w) => w.slice(0, 5)),
  );
}

// Dois planos dizem quase o mesmo: a maior parte das palavras é igual, ou um está todo dentro do outro.
export function similarDescriptions(a: string, b: string): boolean {
  const x = descriptionWords(a);
  const y = descriptionWords(b);
  if (x.size === 0 || y.size === 0) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / new Set([...x, ...y]).size >= 0.6 || shared === Math.min(x.size, y.size);
}

// Plano repetido sai: mesma cena ou a vizinha, mesmo enquadramento, ângulo e pessoas, e quase a mesma descrição.
// Fica o primeiro, e nenhuma cena fica sem plano por causa disso.
export function dropNearDuplicates<T extends Pick<Shot, "block_id" | "framing" | "angle" | "description" | "person_ids">>(shots: T[], blockIds: string[]): T[] {
  const kept: T[] = [];
  const samePeople = (a: T, b: T) => [...(a.person_ids ?? [])].sort().join() === [...(b.person_ids ?? [])].sort().join();
  shots.forEach((s, i) => {
    const near = (o: T) => Math.abs(blockIds.indexOf(o.block_id) - blockIds.indexOf(s.block_id)) <= 1;
    const twin = kept.find((o) => near(o) && o.framing === s.framing && o.angle === s.angle && samePeople(o, s) && similarDescriptions(o.description, s.description));
    const lastOfScene = !kept.some((o) => o.block_id === s.block_id) && !shots.slice(i + 1).some((o) => o.block_id === s.block_id);
    if (!twin || lastOfScene) kept.push(s);
  });
  return kept;
}

// Confere a decupagem da IA: só blocos que existem, valores válidos, no máximo `max` planos
// (todo bloco garante pelo menos um), e nada de câmera andando para quem grava sozinho.
export function normalizeShots(
  raw: unknown,
  blockIds: string[],
  opts: { orientation: Orientation; max: number; solo: boolean; people?: CastPerson[] },
): Omit<Shot, "position">[] {
  const items = (raw as { shots?: unknown })?.shots;
  if (!Array.isArray(items)) return [];
  const all: Omit<Shot, "position">[] = [];
  for (const item of items) {
    const s = (item ?? {}) as Record<string, unknown>;
    const block = blockIds[Math.round(Number(s.block)) - 1];
    if (!block) continue;
    const movement = pick<Movement>(s.movement, MOVEMENTS, "parado");
    all.push({
      block_id: block,
      framing: pick(s.framing, FRAMINGS, "medio"),
      angle: pick(s.angle, ANGLES, "altura_olhos"),
      movement: opts.solo && movement === "acompanhando" ? "parado" : movement,
      orientation: s.orientation === "horizontal" || s.orientation === "vertical" ? s.orientation : opts.orientation,
      description: clip(s.description, 300),
      location: clip(s.location, 80),
      wardrobe: clip(s.wardrobe, 80),
      why: clip(s.why, 300),
      person_ids: castIds(s.people, opts.people ?? []),
    });
  }
  // A ordem do roteiro manda: planos agrupados pelo bloco, na ordem dos blocos.
  const ordered = dropNearDuplicates(
    all.sort((a, b) => blockIds.indexOf(a.block_id) - blockIds.indexOf(b.block_id)),
    blockIds,
  );

  // Primeiro o primeiro plano de cada bloco; depois os outros, na ordem, até o limite.
  const keep = new Set<number>();
  const seenBlock = new Set<string>();
  ordered.forEach((s, i) => {
    if (!seenBlock.has(s.block_id) && keep.size < opts.max) {
      seenBlock.add(s.block_id);
      keep.add(i);
    }
  });
  ordered.forEach((_, i) => {
    if (keep.size < opts.max) keep.add(i);
  });
  return normalizeWardrobe(unifyPlaces(ordered.filter((_, i) => keep.has(i))));
}

// Plano em poucas palavras ("Médio, Altura dos olhos, Parado"), para a memória do criador.
export function shotTerms(shot: Pick<Shot, "framing" | "angle" | "movement" | "description">): string {
  const terms = [FRAMINGS[shot.framing]?.label, ANGLES[shot.angle]?.label, MOVEMENTS[shot.movement]?.label].filter(Boolean).join(", ");
  return shot.description ? `${terms}: ${shot.description}` : terms;
}
