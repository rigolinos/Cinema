// Modo set: o que a tela de gravação precisa saber, sem depender de banco ou de tela.

export interface ChecklistItem {
  id: string;
  label: string;
  tip: string;
}

// Antes de gravar: um minuto aqui evita refazer tudo depois.
export const CHECKLIST: ChecklistItem[] = [
  { id: "luz", label: "Luz de frente", tip: "Fique de frente para a janela ou a luz, nunca de costas." },
  { id: "som", label: "Som sem eco", tip: "Lugar fechado, sem ventilador, celular perto da boca ou microfone de lapela." },
  { id: "lente", label: "Lente limpa", tip: "Passe a camiseta na lente: marca de dedo deixa tudo embaçado." },
  { id: "silencio", label: "Não perturbe ligado", tip: "Notificação no meio do take obriga a gravar de novo." },
  { id: "espaco", label: "Bateria e espaço", tip: "Pelo menos metade da bateria e espaço para alguns minutos de vídeo." },
];

export interface SetShot {
  id: string;
  position: number;
  shoot_order: number | null;
  location: string;
  wardrobe: string;
  recorded: boolean;
  good_take: boolean;
  takes: number;
}

// Ordem do dia: a ordem de gravação montada nos Planos; sem ela, a do roteiro.
export function setOrder<T extends Pick<SetShot, "position" | "shoot_order">>(shots: T[]): T[] {
  return [...shots].sort((a, b) => (a.shoot_order ?? a.position + 1000) - (b.shoot_order ?? b.position + 1000) || a.position - b.position);
}

// Próximo plano ainda não gravado depois de `from` (dá a volta e retoma os pulados). -1 = acabou.
export function nextPending(shots: Pick<SetShot, "recorded">[], from: number): number {
  for (let step = 1; step <= shots.length; step++) {
    const i = (from + step) % shots.length;
    if (!shots[i].recorded) return i;
  }
  return -1;
}

export function firstPending(shots: Pick<SetShot, "recorded">[]): number {
  return shots.findIndex((s) => !s.recorded);
}

// Aviso quando o próximo plano é em outro lugar ou com outra roupa.
export function setupChange(prev: Pick<SetShot, "location" | "wardrobe"> | undefined, next: Pick<SetShot, "location" | "wardrobe">): string | null {
  if (!prev) return null;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const parts: string[] = [];
  if (!same(prev.location, next.location) && next.location.trim()) parts.push(`vá para ${next.location.trim()}`);
  if (!same(prev.wardrobe, next.wardrobe) && next.wardrobe.trim()) parts.push(`troque para ${next.wardrobe.trim()}`);
  return parts.length ? `Troca de cenário: ${parts.join(" e ")}.` : null;
}

export function progress(shots: Pick<SetShot, "recorded" | "good_take">[]) {
  const recorded = shots.filter((s) => s.recorded).length;
  return {
    total: shots.length,
    recorded,
    good: shots.filter((s) => s.good_take).length,
    missing: shots.length - recorded,
    done: shots.length > 0 && recorded === shots.length,
  };
}
